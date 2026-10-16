import type { DurableSnapshot } from "./durable-write.ts";

/** The durable document an edit observes. Its write command belongs to the domain. */
type EditedDocument<Document> = {
  getSnapshot(): DurableSnapshot<Document>;
  subscribe(listener: () => void): () => void;
  retryLoad(): void;
};

/** A parsed draft: the value to write, or the validation feedback that stops the save. */
export type ParsedDraft<Value, Invalid = string> = { value: Value } | { error: Invalid };

type DocumentEditSnapshot<Document, Draft, Invalid = string> = Readonly<{
  draft: Draft;
  /** This edit's feedback: its draft's validation result or its latest save failure. */
  error: Invalid | string | null;
  /** Editing is unavailable: this edit or another writer holds the document, or it is refreshing. */
  busy: boolean;
  /** A write of this document is running. A background refresh is busy but not saving. */
  saving: boolean;
  /** This edit's latest save succeeded and nothing has changed since. */
  saved: boolean;
  load: DurableSnapshot<Document>["state"];
}>;

// A Document edit owns one entered draft of a durable document and the feedback for
// its saves. The untouched draft comes from the saved document: it fills once and
// never replaces entered text, or it follows each saved replacement until the user
// types. Save parses the draft against the latest saved document and reserves the
// domain's write before observers are notified. A stopped edit's late completion
// reports nothing, and a new edit never shows an older edit's failure.
export function createDocumentEdit<Document, Draft, Value, Invalid = string>({
  document,
  draft: initial,
  seed,
  follow = false,
  parse,
  write,
  failure,
}: {
  document: EditedDocument<Document>;
  /** The draft shown until the document first loads. */
  draft: Draft;
  /** The untouched draft for a saved document. */
  seed: (document: Document) => Draft;
  /** An untouched draft follows later saved documents instead of filling once. */
  follow?: boolean;
  parse: (draft: Draft, latest: Document) => ParsedDraft<Value, Invalid>;
  /** Must reserve the durable write synchronously; resolves true after durable success. */
  write: (value: Value) => Promise<boolean>;
  /** Shown when a failed write leaves no persistence message. */
  failure: string;
}) {
  let active = false;
  let generation = 0;
  let draft = initial;
  let touched = false;
  // The saved document behind an untouched draft.
  let source: { document: Document } | null = null;
  let error: Invalid | string | null = null;
  let saved = false;
  let pending: { generation: number } | null = null;
  let unsubscribe: (() => void) | null = null;
  let notifying = 0;
  const listeners = new Set<() => void>();
  let snapshot = read();

  function read(): DocumentEditSnapshot<Document, Draft, Invalid> {
    const durable = document.getSnapshot();
    const { state } = durable;
    // An unavailable document keeps the last draft until a document loads again.
    if (
      !touched &&
      state.kind === "ready" &&
      (!source || (follow && source.document !== state.document))
    ) {
      source = { document: state.document };
      draft = seed(state.document);
    }
    const busy = pending !== null || durable.saving;
    return {
      draft,
      error,
      busy,
      saving: pending !== null || (durable.saving && !durable.refreshing),
      saved: saved && !busy,
      load: state,
    };
  }
  function publish() {
    const next = read();
    if (
      next.draft === snapshot.draft &&
      next.error === snapshot.error &&
      next.busy === snapshot.busy &&
      next.saving === snapshot.saving &&
      next.saved === snapshot.saved &&
      next.load === snapshot.load
    )
      return;
    snapshot = next;
    notifying++;
    try {
      for (const listener of listeners) listener();
    } finally {
      notifying--;
    }
  }
  function idle() {
    return active && !pending && !document.getSnapshot().saving;
  }
  async function complete(ticket: NonNullable<typeof pending>, writing: Promise<boolean>) {
    let success = false;
    try {
      success = await writing;
    } catch {
      // A rejected write is a failed save.
    }
    if (pending === ticket) pending = null;
    const current = active && ticket.generation === generation;
    if (current && success) {
      saved = true;
      // A following draft resumes following; a filled draft keeps its entered text.
      if (follow) {
        touched = false;
        source = null;
      }
    } else if (current) error = document.getSnapshot().error ?? failure;
    publish();
    return current && success;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (active) return;
      active = true;
      unsubscribe = document.subscribe(publish);
      publish();
    },
    stop() {
      if (!active) return;
      active = false;
      // A detached edit keeps its draft, but its durable write can no longer report back.
      ++generation;
      pending = null;
      unsubscribe?.();
      unsubscribe = null;
      publish();
    },
    retryLoad() {
      document.retryLoad();
    },
    change(next: Draft) {
      if (!idle()) return false;
      draft = next;
      touched = true;
      error = null;
      saved = false;
      publish();
      return true;
    },
    /**
     * Discards the entered draft; it starts again from the latest saved document.
     * Unlike other commands, discarding needs only that this edit is not saving.
     */
    cancel() {
      if (!active || pending) return false;
      touched = false;
      source = null;
      error = null;
      saved = false;
      publish();
      return true;
    },
    /** Resolves true only when this edit's draft was saved and the edit is still current. */
    save(): Promise<boolean> {
      const { state } = document.getSnapshot();
      if (!idle() || notifying || state.kind !== "ready") return Promise.resolve(false);
      saved = false;
      const parsed = parse(draft, state.document);
      if ("error" in parsed) {
        error = parsed.error;
        publish();
        return Promise.resolve(false);
      }
      error = null;
      const ticket = { generation };
      pending = ticket;
      // Reserve persistence before observers can submit a competing write.
      const writing = write(parsed.value);
      publish();
      return complete(ticket, writing);
    },
  };
}

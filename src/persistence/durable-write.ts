export type DurableStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
  /** Subscribe to external durable replacements, without an initial event. */
  subscribeItem?(key: string, listener: () => void): () => void;
};

export type DurableSnapshot<Document> = Readonly<{
  state: { kind: "loading" } | { kind: "error" } | { kind: "ready"; document: Document };
  saving: boolean;
  error: string | null;
  /** A failed external refresh leaves the last valid document mounted. */
  refreshError?: string | null;
}>;

type Change<Document, Value> = { document: Document; value: Value } | { error: string | null };
type Mutation<Document, Value> = Change<Document, Value> | { remove: true; value: Value };

// Internal lifecycle shared by domain persistence modules. Domain code owns each
// mutation, its rejection message, and the value returned after durable success.
export function createDurableWrite<Document>({ storage, key, parse }: {
  storage: DurableStorage;
  key: string;
  parse: (raw: string | null) => Document;
}) {
  let snapshot: DurableSnapshot<Document> = { state: { kind: "loading" }, saving: false, error: null };
  const listeners = new Set<() => void>();
  let active = false;
  let lifecycle = 0;
  let readGeneration = 0;
  let write: { lifecycle: number } | null = null;
  let unsubscribeItem: (() => void) | undefined;
  let reloadAfterWrite = false;
  let externalInvalid = false;
  let backgroundRead: number | null = null;

  function publish(patch: Partial<DurableSnapshot<Document>>) {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  async function load() {
    if (!active || write) return;
    reloadAfterWrite = false;
    const generation = ++readGeneration;
    const background = externalInvalid && snapshot.state.kind === "ready";
    backgroundRead = background ? generation : null;
    const current = () => active && generation === readGeneration;
    if (background) publish({ saving: true, error: null });
    else publish({ state: { kind: "loading" }, saving: false, error: null, refreshError: null });
    // A subscriber may stop or replace this load during publication.
    if (!current()) return;
    try {
      const document = parse(await storage.getItem(key));
      if (current()) {
        externalInvalid = false; backgroundRead = null;
        publish({ state: { kind: "ready", document }, saving: false, refreshError: null });
      }
    } catch {
      if (current()) {
        backgroundRead = null;
        if (background) {
          const error = "Couldn't load your latest saved data. Try again.";
          publish({ saving: false, error, refreshError: error });
        } else publish({ state: { kind: "error" } });
      }
    }
  }

  async function mutate<Value>(
    build: () => Mutation<Document, Value>,
    failureMessage: string,
    recovering = false,
  ): Promise<Value | null> {
    if (!active || write || backgroundRead !== null) return null;
    const ticket = { lifecycle };
    write = ticket;
    ++readGeneration;
    const current = () => active && ticket.lifecycle === lifecycle;
    const writable = () => current() && (recovering || !externalInvalid);
    try {
      publish({ saving: true, error: null });
      if (!writable()) return null;
      const change = build();
      if (!writable()) return null;
      if ("error" in change) {
        if (change.error !== null) publish({ error: change.error });
        return null;
      }
      let canonical: Document;
      if ("remove" in change) {
        // Removal can recover an unreadable record. Validate its empty state
        // before deleting it, and use the same exclusion as ordinary writes.
        canonical = parse(null);
        if (!writable()) return null;
        if (!storage.removeItem) throw new Error("Storage removal is unavailable");
        await storage.removeItem(key);
      } else {
        const serialized = JSON.stringify(change.document);
        canonical = parse(serialized);
        if (!writable()) return null;
        await storage.setItem(key, serialized);
      }
      if (!current()) return null;
      if (!reloadAfterWrite) externalInvalid = false;
      publish({ state: { kind: "ready", document: canonical }, refreshError: null });
      return current() ? change.value : null;
    } catch {
      if (current()) publish({
        state: snapshot.state.kind === "loading" ? { kind: "error" } : snapshot.state,
        error: failureMessage,
      });
      return null;
    } finally {
      // Storage writes cannot be canceled. Keep exclusion across stop/start,
      // then reload durable data before accepting a new lifecycle's mutations.
      write = null;
      if (current()) {
        publish({ saving: false });
        if (reloadAfterWrite && active) void load();
      }
      else if (active) void load();
    }
  }

  return {
    getSnapshot: () => snapshot,
    start() {
      if (active) return;
      active = true;
      const ticket = ++lifecycle;
      const detach = storage.subscribeItem?.(key, () => {
        if (!active || ticket !== lifecycle) return;
        // External hydration can finish while a domain save is pending. Retain
        // its invalidation until the uncancelable write releases exclusion.
        reloadAfterWrite = true;
        externalInvalid = true;
        void load();
      });
      if (!active || ticket !== lifecycle) { detach?.(); return; }
      unsubscribeItem = detach;
      if (write) publish({ state: { kind: "loading" } });
      else void load();
    },
    stop() {
      active = false; ++lifecycle; ++readGeneration;
      unsubscribeItem?.(); unsubscribeItem = undefined;
    },
    retryLoad() { void load(); },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    update<Value>(build: (document: Document) => Change<Document, Value>, failureMessage: string): Promise<Value | null> {
      if (snapshot.state.kind !== "ready" || externalInvalid || backgroundRead !== null) return Promise.resolve(null);
      const previous = snapshot.state.document;
      return mutate(() => build(previous), failureMessage);
    },
    remove(failureMessage: string): Promise<boolean | null> {
      return mutate(() => ({ remove: true, value: true }), failureMessage, true);
    },
  };
}

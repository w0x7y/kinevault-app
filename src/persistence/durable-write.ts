export type DurableStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type DurableSnapshot<Document> = Readonly<{
  state: { kind: "loading" } | { kind: "error" } | { kind: "ready"; document: Document };
  saving: boolean;
  error: string | null;
}>;

type Change<Document, Value> = { document: Document; value: Value } | { error: string | null };

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

  function publish(patch: Partial<DurableSnapshot<Document>>) {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  async function load() {
    if (!active || write) return;
    const generation = ++readGeneration;
    const current = () => active && generation === readGeneration;
    publish({ state: { kind: "loading" }, saving: false, error: null });
    // A subscriber may stop or replace this load during publication.
    if (!current()) return;
    try {
      const document = parse(await storage.getItem(key));
      if (current()) publish({ state: { kind: "ready", document } });
    } catch {
      if (current()) publish({ state: { kind: "error" } });
    }
  }

  async function update<Value>(
    build: (document: Document) => Change<Document, Value>,
    failureMessage: string,
  ): Promise<Value | null> {
    if (!active || write || snapshot.state.kind !== "ready") return null;
    const previous = snapshot.state.document;
    const ticket = { lifecycle };
    write = ticket;
    ++readGeneration;
    const current = () => active && ticket.lifecycle === lifecycle;
    try {
      publish({ saving: true, error: null });
      if (!current()) return null;
      const change = build(previous);
      if (!current()) return null;
      if ("error" in change) {
        if (change.error !== null) publish({ error: change.error });
        return null;
      }
      const serialized = JSON.stringify(change.document);
      const canonical = parse(serialized);
      if (!current()) return null;
      await storage.setItem(key, serialized);
      if (!current()) return null;
      publish({ state: { kind: "ready", document: canonical } });
      return current() ? change.value : null;
    } catch {
      if (current()) publish({ error: failureMessage });
      return null;
    } finally {
      // Storage writes cannot be canceled. Keep exclusion across stop/start,
      // then reload durable data before accepting a new lifecycle's mutations.
      write = null;
      if (current()) publish({ saving: false });
      else if (active) void load();
    }
  }

  return {
    getSnapshot: () => snapshot,
    start() {
      if (active) return;
      active = true;
      ++lifecycle;
      if (write) publish({ state: { kind: "loading" } });
      else void load();
    },
    stop() { active = false; ++lifecycle; ++readGeneration; },
    retryLoad() { void load(); },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    update,
  };
}

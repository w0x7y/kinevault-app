import { parseProfile, type ProfileDocument } from "./model.ts";

export const profileStorageKey = "kinevault-track.profile.v1";
export type ProfileState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; document: ProfileDocument };
export type ProfileSnapshot = Readonly<{
  state: ProfileState;
  saving: boolean;
  error: string | null;
}>;
export type ProfileStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// Storage promises cannot be canceled. Generations prevent old results from
// changing a new lifecycle, while the write ticket protects the durable record.
export function createProfilePersistence(storage: ProfileStorage) {
  let snapshot: ProfileSnapshot = {
    state: { kind: "loading" }, saving: false, error: null,
  };
  const listeners = new Set<() => void>();
  let active = false;
  let lifecycle = 0;
  let readGeneration = 0;
  let write: { lifecycle: number } | null = null;

  function publish(patch: Partial<ProfileSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }
  function currentRead(generation: number) {
    return active && generation === readGeneration;
  }
  async function load() {
    if (!active || write) return;
    const generation = ++readGeneration;
    publish({ state: { kind: "loading" }, saving: false, error: null });
    try {
      const document = parseProfile(await storage.getItem(profileStorageKey));
      if (currentRead(generation)) publish({ state: { kind: "ready", document } });
    } catch {
      if (currentRead(generation)) publish({ state: { kind: "error" } });
    }
  }
  function beginWrite() {
    const ticket = { lifecycle };
    write = ticket;
    ++readGeneration;
    publish({ saving: true, error: null });
    return ticket;
  }
  function currentWrite(ticket: { lifecycle: number }) {
    return active && ticket.lifecycle === lifecycle;
  }
  function finishWrite(ticket: { lifecycle: number }) {
    write = null;
    if (!active) return;
    if (currentWrite(ticket)) publish({ saving: false });
    else void load(); // Restart waits for the uncancelable write before reading.
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() {
      if (active) return;
      active = true;
      ++lifecycle;
      if (write) publish({ state: { kind: "loading" } });
      else void load();
    },
    stop() {
      active = false;
      ++lifecycle;
      ++readGeneration;
    },
    retryLoad() { void load(); },
    async save(document: ProfileDocument): Promise<boolean> {
      if (!active || write || snapshot.state.kind !== "ready") return false;
      const ticket = beginWrite();
      try {
        const serialized = JSON.stringify(document);
        const canonical = parseProfile(serialized);
        await storage.setItem(profileStorageKey, serialized);
        if (!currentWrite(ticket)) return false;
        publish({ state: { kind: "ready", document: canonical } });
        return currentWrite(ticket);
      } catch {
        if (currentWrite(ticket)) publish({ error: "Couldn't save your answers. Try again." });
        return false;
      } finally { finishWrite(ticket); }
    },
    async reset(): Promise<void> {
      if (!active || write) return;
      const ticket = beginWrite();
      try {
        await storage.removeItem(profileStorageKey);
        if (currentWrite(ticket)) publish({ state: { kind: "ready", document: parseProfile(null) } });
      } catch {
        if (currentWrite(ticket)) publish({
          state: snapshot.state.kind === "loading" ? { kind: "error" } : snapshot.state,
          error: "Couldn't reset your profile. Try again.",
        });
      } finally { finishWrite(ticket); }
    },
  };
}

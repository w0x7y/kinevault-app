import { addWater, parseWaterLog, type AddWaterInput, type WaterLogDocument } from "./model.ts";

export const waterLogStorageKey = "kinevault-track.water-log.v1";
export type WaterLogStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
export type WaterLogSnapshot = Readonly<{
  state: { kind: "loading" } | { kind: "error" } | { kind: "ready"; document: WaterLogDocument };
  saving: boolean;
  error: string | null;
}>;

export function createWaterLogPersistence({ storage }: { storage: WaterLogStorage }) {
  let snapshot: WaterLogSnapshot = { state: { kind: "loading" }, saving: false, error: null };
  const listeners = new Set<() => void>();
  let active = false;
  let lifecycle = 0;
  let readGeneration = 0;
  let write: { lifecycle: number } | null = null;

  function publish(patch: Partial<WaterLogSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }
  async function load() {
    if (!active || write) return;
    const generation = ++readGeneration;
    publish({ state: { kind: "loading" }, saving: false, error: null });
    try {
      const document = parseWaterLog(await storage.getItem(waterLogStorageKey));
      if (active && generation === readGeneration) publish({ state: { kind: "ready", document } });
    } catch {
      if (active && generation === readGeneration) publish({ state: { kind: "error" } });
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
    async add(input: AddWaterInput): Promise<boolean> {
      if (!active || write || snapshot.state.kind !== "ready") return false;
      const previous = snapshot.state.document;
      const ticket = { lifecycle };
      write = ticket;
      ++readGeneration;
      publish({ saving: true, error: null });
      const current = () => active && ticket.lifecycle === lifecycle;
      try {
        const serialized = JSON.stringify(addWater(previous, input));
        const canonical = parseWaterLog(serialized);
        await storage.setItem(waterLogStorageKey, serialized);
        if (!current()) return false;
        publish({ state: { kind: "ready", document: canonical } });
        return current();
      } catch {
        if (current()) publish({ error: "Couldn't save your water log. Try again." });
        return false;
      } finally {
        write = null;
        if (current()) publish({ saving: false });
        else if (active) void load();
      }
    },
  };
}

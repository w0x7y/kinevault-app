import type { FindFood } from "./entry-nutrients.ts";
import { parseDay } from "../calendar/dates.ts";
import { editedFoodEntry, entryForFood, parseFoodLog, type AddFoodInput, type EditFoodInput, type FoodLogDocument } from "./log-model.ts";
export const foodLogStorageKey = "kinevault-track.food-log.v1";
export type FoodLogStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
export type FoodLogSnapshot = Readonly<{
  state: { kind: "loading" } | { kind: "error" } | { kind: "ready"; document: FoodLogDocument };
  saving: boolean;
  error: string | null;
}>;

export function createFoodLogPersistence({ storage, createId, findFood }: { storage: FoodLogStorage; createId: () => string; findFood?: FindFood }) {
  let snapshot: FoodLogSnapshot = { state: { kind: "loading" }, saving: false, error: null };
  const listeners = new Set<() => void>();
  let active = false;
  let lifecycle = 0;
  let readGeneration = 0;
  let write: { lifecycle: number } | null = null;

  function publish(patch: Partial<FoodLogSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }
  async function load() {
    if (!active || write) return;
    const generation = ++readGeneration;
    publish({ state: { kind: "loading" }, saving: false, error: null });
    try {
      const document = parseFoodLog(await storage.getItem(foodLogStorageKey));
      if (active && generation === readGeneration) publish({ state: { kind: "ready", document } });
    } catch {
      if (active && generation === readGeneration) publish({ state: { kind: "error" } });
    }
  }
  async function update(build: (document: FoodLogDocument) => FoodLogDocument | null): Promise<boolean> {
    if (!active || write || snapshot.state.kind !== "ready") return false;
    const previous = snapshot.state.document;
    const ticket = { lifecycle };
    write = ticket;
    ++readGeneration;
    publish({ saving: true, error: null });
    const current = () => active && ticket.lifecycle === lifecycle;
    try {
      const next = build(previous);
      if (next === null) return false;
      const serialized = JSON.stringify(next);
      const canonical = parseFoodLog(serialized);
      await storage.setItem(foodLogStorageKey, serialized);
      if (!current()) return false;
      publish({ state: { kind: "ready", document: canonical } });
      return current();
    } catch {
      if (current()) publish({ error: "Couldn't save your food log. Try again." });
      return false;
    } finally {
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
    add(input: AddFoodInput) {
      return update(document => {
        parseDay(input.date);
        const entry = entryForFood({ ...input, id: createId() });
        return { version: 1, days: { ...document.days, [input.date]: [...(document.days[input.date] ?? []), entry] } };
      });
    },
    edit(input: EditFoodInput) {
      const { date, id } = input;
      return update(document => {
        parseDay(date);
        const previous = document.days[date] ?? [];
        const entry = previous.find(entry => entry.id === id);
        if (!entry) return null;
        const edited = editedFoodEntry(entry, input, findFood);
        return { version: 1, days: { ...document.days, [date]: previous.map(food => food.id === id ? edited : food) } };
      });
    },
    remove({ date, id }: { date: string; id: string }) {
      return update(document => {
        parseDay(date);
        const previous = document.days[date] ?? [];
        const entries = previous.filter(entry => entry.id !== id);
        if (entries.length === previous.length) return null;
        const days = { ...document.days };
        if (entries.length) days[date] = entries;
        else delete days[date];
        return { version: 1, days };
      });
    },
  };
}

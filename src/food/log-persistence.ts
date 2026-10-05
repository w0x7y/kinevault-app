import { createDurableWrite, type DurableSnapshot, type DurableStorage } from "../persistence/durable-write.ts";
import type { FindFood } from "./entry-nutrients.ts";
import { parseDay } from "../calendar/dates.ts";
import { editedFoodEntry, entryForFood, parseFoodLog, type AddFoodInput, type EditFoodInput, type FoodLogDocument } from "./log-model.ts";
export const foodLogStorageKey = "kinevault-track.food-log.v1";
export type FoodLogStorage = DurableStorage;
export type FoodLogSnapshot = DurableSnapshot<FoodLogDocument>;

export function createFoodLogPersistence({ storage, createId, findFood }: { storage: FoodLogStorage; createId: () => string; findFood?: FindFood }) {
  const { update: persist, remove: _remove, ...lifecycle } = createDurableWrite({ storage, key: foodLogStorageKey, parse: parseFoodLog });
  async function update(build: (document: FoodLogDocument) => FoodLogDocument | null): Promise<boolean> {
    return await persist(document => {
      const next = build(document);
      return next === null ? { error: null } : { document: next, value: true };
    }, "Couldn't save your food log. Try again.") === true;
  }
  return {
    ...lifecycle,
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

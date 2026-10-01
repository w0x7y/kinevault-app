import { customFoodFromDraft, parseCustomFoods, type CustomFood, type CustomFoodDocument, type CustomFoodDraft } from "./custom-model.ts";
import type { FoodLogStorage } from "./log-persistence.ts";
import { mealFromDraft, type CustomMeal, type MealDraft } from "./meal-model.ts";

export const customFoodStorageKey = "kinevault-track.custom-foods.v1";
export type CustomFoodSnapshot = Readonly<{
  state: { kind: "loading" } | { kind: "error" } | { kind: "ready"; document: CustomFoodDocument };
  saving: boolean;
  error: string | null;
}>;

export function createCustomFoodPersistence({ storage, createId }: { storage: FoodLogStorage; createId: () => string }) {
  let snapshot: CustomFoodSnapshot = { state: { kind: "loading" }, saving: false, error: null };
  const listeners = new Set<() => void>();
  let active = false;
  let lifecycle = 0;
  let readGeneration = 0;
  let write: { lifecycle: number } | null = null;
  function publish(patch: Partial<CustomFoodSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }
  async function load() {
    if (!active || write) return;
    const generation = ++readGeneration;
    publish({ state: { kind: "loading" }, saving: false, error: null });
    try {
      const document = parseCustomFoods(await storage.getItem(customFoodStorageKey));
      if (active && generation === readGeneration) publish({ state: { kind: "ready", document } });
    } catch {
      if (active && generation === readGeneration) publish({ state: { kind: "error" } });
    }
  }
  async function save<T extends CustomFood | CustomMeal>(
    build: (document: CustomFoodDocument) => { document: CustomFoodDocument; item: T } | null,
    failureMessage: string,
    invalidMessage = "Check the name, amounts, and nutrition values.",
  ): Promise<T | null> {
    if (!active || write || snapshot.state.kind !== "ready") return null;
    const previous = snapshot.state.document;
    const ticket = { lifecycle };
    write = ticket;
    ++readGeneration;
    publish({ saving: true, error: null });
    const current = () => active && ticket.lifecycle === lifecycle;
    try {
      const result = build(previous);
      if (!result) { publish({ error: invalidMessage }); return null; }
      const serialized = JSON.stringify(result.document);
      const document = parseCustomFoods(serialized);
      await storage.setItem(customFoodStorageKey, serialized);
      if (!current()) return null;
      publish({ state: { kind: "ready", document } });
      return current() ? result.item : null;
    } catch {
      if (current()) publish({ error: failureMessage });
      return null;
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
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    add(draft: CustomFoodDraft): Promise<CustomFood | null> {
      return save(document => {
        const result = customFoodFromDraft(draft, createId());
        return result.ok ? { item: result.food, document: { ...document, foods: [...document.foods, result.food] } } : null;
      }, "Couldn't save your custom food. Your values are still here. Try again.");
    },
    addMeal(draft: MealDraft): Promise<CustomMeal | null> {
      return save(document => {
        const result = mealFromDraft(draft, createId());
        return result.ok ? { item: result.meal, document: { ...document, meals: [...document.meals, result.meal] } } : null;
      }, "Couldn't save your meal. Your ingredients and values are still here. Try again.");
    },
    updateFood(customId: string, draft: CustomFoodDraft): Promise<CustomFood | null> {
      return save(document => {
        if (!document.foods.some(food => food.customId === customId)) return null;
        const result = customFoodFromDraft(draft, customId);
        return result.ok ? { item: result.food, document: { ...document,
          foods: document.foods.map(food => food.customId === customId ? result.food : food) } } : null;
      }, "Couldn't update your food. Your changes are still here. Try again.");
    },
    updateMeal(customId: string, draft: MealDraft): Promise<CustomMeal | null> {
      return save(document => {
        if (!document.meals.some(meal => meal.customId === customId)) return null;
        const result = mealFromDraft(draft, customId);
        return result.ok ? { item: result.meal, document: { ...document,
          meals: document.meals.map(meal => meal.customId === customId ? result.meal : meal) } } : null;
      }, "Couldn't update your meal. Your changes are still here. Try again.");
    },
    async remove(customId: string): Promise<boolean> {
      const removed = await save<CustomFood | CustomMeal>(document => {
        const item = document.foods.find(food => food.customId === customId)
          ?? document.meals.find(meal => meal.customId === customId);
        return item ? { item, document: { ...document,
          foods: document.foods.filter(food => food.customId !== customId),
          meals: document.meals.filter(meal => meal.customId !== customId) } } : null;
      }, "Couldn't delete this item. It is still saved. Try again.", "This item is no longer available in search.");
      return removed !== null;
    },
  };
}

import { createDurableWrite, type DurableSnapshot } from "../persistence/durable-write.ts";
import { customFoodFromDraft, parseCustomFoods, type CustomFood, type CustomFoodDocument, type CustomFoodDraft } from "./custom-model.ts";
import type { FoodLogStorage } from "./log-persistence.ts";
import { mealFromDraft, type CustomMeal, type MealDraft } from "./meal-model.ts";

export const customFoodStorageKey = "kinevault-track.custom-foods.v1";
export type CustomFoodSnapshot = DurableSnapshot<CustomFoodDocument>;

export function createCustomFoodPersistence({ storage, createId }: { storage: FoodLogStorage; createId: () => string }) {
  const { update, remove: _remove, ...lifecycle } = createDurableWrite({ storage, key: customFoodStorageKey, parse: parseCustomFoods });
  function save<T extends CustomFood | CustomMeal>(
    build: (document: CustomFoodDocument) => { document: CustomFoodDocument; item: T } | null,
    failureMessage: string,
    invalidMessage = "Check the name, amounts, and nutrition values.",
  ): Promise<T | null> {
    return update<T>(document => {
      const result = build(document);
      return result ? { document: result.document, value: result.item } : { error: invalidMessage };
    }, failureMessage);
  }
  return {
    ...lifecycle,
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

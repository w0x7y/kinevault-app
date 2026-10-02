import { detailedNutrientsForEntry, type FindFood } from "../food/entry-nutrients.ts";
import { detailedNutrients, unknownNutrients, type DetailedNutrients } from "../food/nutrients.ts";
import type { FoodEntry } from "./model.ts";

export function sumDetailedNutrients(foods: readonly FoodEntry[], findFood: FindFood): DetailedNutrients {
  const totals = { ...unknownNutrients };
  for (const { key } of detailedNutrients) totals[key] = 0;
  for (const food of foods) {
    const values = detailedNutrientsForEntry(food, findFood);
    for (const { key } of detailedNutrients) {
      const current = totals[key];
      const amount = values[key];
      totals[key] = current === null || amount === null ? null : current + amount;
    }
  }
  return totals;
}

import type { CatalogFood } from "../food/catalog.ts";
import { detailedNutrients, scaleNutrients, unknownNutrients, type DetailedNutrients } from "../food/nutrients.ts";
import type { FoodEntry } from "./model.ts";

export function sumDetailedNutrients(foods: readonly FoodEntry[], findFood: (id: number) => CatalogFood | undefined): DetailedNutrients {
  const totals = { ...unknownNutrients };
  for (const { key } of detailedNutrients) totals[key] = 0;
  for (const food of foods) {
    const source = food.details ? undefined : findFood(food.fdcId)?.details;
    const values = food.details ?? (source ? scaleNutrients(source, food.grams / 100) : unknownNutrients);
    for (const { key } of detailedNutrients) {
      const current = totals[key];
      const amount = values[key];
      totals[key] = current === null || amount === null ? null : current + amount;
    }
  }
  return totals;
}

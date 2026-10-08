import type { FoodEntry } from "../daily/model.ts";
import type { CatalogFood } from "./catalog.ts";
import { scaleNutrients, unknownNutrients, type DetailedNutrients } from "./nutrients.ts";

export type FindFood = (id: number) => CatalogFood | undefined;

/** Saved snapshots are authoritative. Legacy gram entries can use their original source and weight. */
export function detailedNutrientsForEntry(
  entry: FoodEntry,
  findFood: FindFood = () => undefined,
): DetailedNutrients {
  if (entry.details !== undefined) return entry.details;
  if (entry.measurement === "volume" || entry.fdcId === undefined) return unknownNutrients;
  const source = findFood(entry.fdcId)?.details;
  return source ? scaleNutrients(source, entry.grams / 100) : unknownNutrients;
}

import { scaleNutrients, type DetailedNutrients } from "./nutrients.ts";
import type { BeverageMetadata } from "./beverage.ts";
import type { FoodImportSource } from "./import-metadata.ts";
import { createFoodSearch } from "./search-matching.ts";
import { foodKey, type FoodIdentity } from "./food-identity.ts";
export { foodKey, type FoodIdentity } from "./food-identity.ts";

export type Nutrition = { calories: number; carbs: number; protein: number; fat: number };
export type ServingNutrition = Nutrition & { details?: DetailedNutrients };
export type CatalogFood = FoodIdentity & {
  name: string;
  brand?: string;
  importSource?: FoodImportSource;
  category: string;
} & (
    | {
        per100g: Nutrition;
        details?: DetailedNutrients;
        portions: readonly { label: string; grams: number }[];
        beverage?: BeverageMetadata;
      }
    | {
        per100g?: never;
        details?: never;
        portions: readonly [];
        beverage: Extract<BeverageMetadata, { kind: "known-volume" }>;
      }
  );
export const foodPageSize = 20;

export function createFoodCatalog<T extends CatalogFood>(foods: readonly T[]) {
  const byId = new Map<number, T>();
  for (const food of foods) if (food.fdcId !== undefined) byId.set(food.fdcId, food);
  const findMatches = createFoodSearch(foods);
  return {
    getById: (fdcId: number) => byId.get(fdcId),
    search(
      query: string,
      page = 0,
    ): { items: CatalogFood[]; total: number; genericDrinkKeys: string[] } {
      const matches = findMatches(query);
      const offset = (Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0) * foodPageSize;
      const results = matches.slice(offset, offset + foodPageSize);
      return {
        items: results.map((entry) => entry.food),
        total: matches.length,
        genericDrinkKeys: results
          .filter((entry) => entry.genericDrink)
          .map((entry) => foodKey(entry.food)),
      };
    },
  };
}

export function nutritionForGrams(food: CatalogFood, grams: number): ServingNutrition {
  if (!Number.isFinite(grams) || grams <= 0)
    throw new RangeError("Food weight must be positive and finite");
  if (!food.per100g) throw new Error("This drink has no reliable nutrition by gram weight");
  const factor = grams / 100;
  return {
    calories: food.per100g.calories * factor,
    carbs: food.per100g.carbs * factor,
    protein: food.per100g.protein * factor,
    fat: food.per100g.fat * factor,
    ...(food.details ? { details: scaleNutrients(food.details, factor) } : {}),
  };
}

export function parseFoodGrams(input: string): number | null {
  const text = input.trim();
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return null;
  const grams = Number(text.replace(",", "."));
  return Number.isFinite(grams) && grams > 0 && grams <= 10000 ? grams : null;
}

import { foodPageSize, type CatalogFood } from "./catalog.ts";
import type { CustomFood } from "./custom-model.ts";
import type { CustomMeal, CatalogKind } from "./meal-model.ts";
import { createFoodSearch } from "./search-matching.ts";

export type SavedCatalogItem = { kind: "food"; food: CustomFood } | { kind: "meal"; food: CustomMeal };
export type FoodSelectionRow = { food: CatalogFood; kind: CatalogKind; genericMatch: boolean };

/** One current catalog snapshot for logging and ingredient selection.
 * Match within each purpose's existing scope, then filter eligibility before paging.
 */
export function createFoodSelection({ savedFoods, savedMeals, bundledFoods }: {
  savedFoods: readonly CustomFood[];
  savedMeals: readonly CustomMeal[];
  bundledFoods: readonly CatalogFood[];
}) {
  const saved = new Map<string, SavedCatalogItem>();
  for (const food of savedFoods) saved.set(food.customId, { kind: "food", food });
  for (const food of savedMeals) saved.set(food.customId, { kind: "meal", food });
  const matches = {
    logging: createFoodSearch([...savedFoods, ...savedMeals, ...bundledFoods]),
    ingredient: createFoodSearch([...savedFoods, ...bundledFoods]),
  };

  return {
    savedItem: (customId: string) => saved.get(customId),
    search({ purpose, query, page = 0 }: { purpose: "logging" | "ingredient"; query: string; page?: number }) {
      const ranked = matches[purpose](query);
      const eligible = purpose === "ingredient" ? ranked.filter(match => match.food.per100g !== undefined) : ranked;
      const total = eligible.length;
      const pageCount = Math.ceil(total / foodPageSize);
      const currentPage = Math.min(Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0, Math.max(0, pageCount - 1));
      const rows: FoodSelectionRow[] = eligible.slice(currentPage * foodPageSize, (currentPage + 1) * foodPageSize).map(match => ({
        food: match.food,
        kind: match.food.customId === undefined ? "food" : saved.get(match.food.customId)?.kind ?? "food",
        genericMatch: match.genericDrink,
      }));
      return { rows, total, page: currentPage, pageCount, exclusions: { volumeOnly: ranked.length - total } };
    },
  };
}

import type { CatalogFood, ServingNutrition } from "./catalog.ts";
import { detailedNutrients, scaleNutrients, unknownNutrients } from "./nutrients.ts";

export type BeverageMetadata =
  | { kind: "unknown-volume" }
  | { kind: "known-volume"; per100ml: ServingNutrition; source: "label" | "usda-portion" };

// NIST SP 811 Appendix B.9, US fluid ounce and US liquid cup.
export const usFluidOunceMl = 29.5735295625;
export const usCupMl = 236.5882365;
const drinkCategories = new Set([
  "Milk, whole",
  "Milk, reduced fat",
  "Milk, lowfat",
  "Milk, nonfat",
  "Flavored milk, whole",
  "Flavored milk, reduced fat",
  "Flavored milk, lowfat",
  "Flavored milk, nonfat",
  "Plant-based milk",
  "Milk shakes and other dairy drinks",
  "Smoothies and grain drinks",
  "Nutritional beverages",
  "Formula, prepared from powder",
  "Formula, ready-to-feed",
  "Coffee",
  "Tea",
  "Soft drinks",
  "Diet soft drinks",
  "Fruit drinks",
  "Other diet drinks",
  "Sport and energy drinks",
  "Diet sport and energy drinks",
  "Apple juice",
  "Citrus juice",
  "Other fruit juice",
  "Vegetable juice",
  "Baby juice",
  "Beer",
  "Wine",
  "Liquor and cocktails",
  "Tap water",
  "Bottled water",
  "Baby water",
  "Flavored or carbonated water",
  "Enhanced water",
]);
// These source records describe concentrates, cooking ingredients, or gelatin,
// even though their category or servings can also describe prepared beverages.
const solidExceptions = new Set([2705402, 2710572, 2710631, 2709191, 2707568, 2707571]);
function literalVolume(label: string): number | null {
  // Never use guideline amounts, with-ice portions, or unspecified ice servings as density.
  const match = /^(\d+(?:\.\d+)?) (fl oz|cup)(?: \(no ice\))?$/.exec(label);
  if (!match) return null;
  const volume = Number(match[1]) * (match[2] === "cup" ? usCupMl : usFluidOunceMl);
  return volume > 0 && Number.isFinite(volume) ? volume : null;
}
export function beverageForFood(food: CatalogFood): BeverageMetadata | null {
  if (food.beverage) return food.beverage;
  // Custom and imported foods require the explicit editable drink setting.
  if (
    food.fdcId === undefined ||
    food.brand !== undefined ||
    food.importSource ||
    solidExceptions.has(food.fdcId) ||
    !drinkCategories.has(food.category)
  )
    return null;
  if (!food.per100g) return { kind: "unknown-volume" };
  const portion = food.portions.find(
    (portion) =>
      literalVolume(portion.label) !== null && Number.isFinite(portion.grams) && portion.grams > 0,
  );
  if (!portion) return { kind: "unknown-volume" };
  const ml = literalVolume(portion.label);
  if (ml === null) return { kind: "unknown-volume" };
  const factor = portion.grams / ml;
  return {
    kind: "known-volume",
    source: "usda-portion",
    per100ml: {
      calories: food.per100g.calories * factor,
      carbs: food.per100g.carbs * factor,
      protein: food.per100g.protein * factor,
      fat: food.per100g.fat * factor,
      ...(food.details ? { details: scaleNutrients(food.details, factor) } : {}),
    },
  };
}
export function nutritionForMl(basis: ServingNutrition, drinkMl: number): ServingNutrition {
  if (!Number.isSafeInteger(drinkMl) || drinkMl < 1 || drinkMl > 10000)
    throw new RangeError("Invalid drink amount");
  for (const key of ["calories", "carbs", "protein", "fat"] as const)
    if (typeof basis[key] !== "number" || !Number.isFinite(basis[key]) || basis[key] < 0)
      throw new Error("Invalid per-100ml nutrition");
  if (basis.details) {
    for (const { key } of detailedNutrients) {
      const amount = basis.details[key];
      if (
        amount !== undefined &&
        amount !== null &&
        (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
      )
        throw new Error("Invalid per-100ml nutrient");
    }
  }
  const factor = drinkMl / 100;
  return {
    calories: basis.calories * factor,
    carbs: basis.carbs * factor,
    protein: basis.protein * factor,
    fat: basis.fat * factor,
    details: scaleNutrients(basis.details ?? unknownNutrients, factor),
  };
}

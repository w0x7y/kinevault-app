import { nutritionForGrams, parseFoodGrams, type CatalogFood, type Nutrition } from "./catalog.ts";
import { unknownNutrients } from "./nutrients.ts";
import { nutritionAmountText, parseNutritionAmount } from "./number-input.ts";
import { parseCustomMeal, type CustomMeal } from "./meal-model.ts";
import { isRecord, parseCatalogFoodRecord } from "./catalog-record.ts";
import { parseFoodMetadata, type FoodImportSource } from "./import-metadata.ts";
import { detailedNutrientsToDraft, validateDetailedNutrientDraft, type DetailedNutrientDraft, type DetailedNutrientErrors } from "./detailed-nutrient-drafts.ts";

export type CustomFood = CatalogFood & { customId: string; fdcId?: never; category: "Custom food" };
export type CustomFoodDraft = { name: string; brand?: string; importSource?: FoodImportSource; servingGrams: string; drink?: boolean; calories: string; carbs: string; protein: string; fat: string; details?: DetailedNutrientDraft };
export type CustomFoodDocument = { version: 1; foods: CustomFood[]; meals: CustomMeal[] };
export type CustomFoodErrors = Partial<Record<Exclude<keyof CustomFoodDraft, "details" | "importSource" | "drink">, string>> & { details?: DetailedNutrientErrors };

export function customFoodToDraft(food: CustomFood): CustomFoodDraft {
  const drink = food.beverage?.kind === "known-volume";
  const basisAmount = drink ? 100 : food.portions[0].grams;
  const nutrition = food.beverage?.kind === "known-volume" ? food.beverage.per100ml : nutritionForGrams(food, basisAmount);
  // Remove floating-point noise introduced by reversing per-100g normalization.
  const servingText = (amount: number) => nutritionAmountText(Number(amount.toPrecision(15)));
  return { name: food.name, drink, ...parseFoodMetadata(food), servingGrams: nutritionAmountText(basisAmount),
    calories: servingText(nutrition.calories), carbs: servingText(nutrition.carbs),
    protein: servingText(nutrition.protein), fat: servingText(nutrition.fat),
    details: detailedNutrientsToDraft(nutrition.details ?? unknownNutrients, servingText) };
}

export function customFoodFromDraft(draft: CustomFoodDraft, customId: string):
  { ok: true; food: CustomFood } | { ok: false; errors: CustomFoodErrors } {
  const errors: CustomFoodErrors = {};
  const name = draft.name.trim();
  if (!name || name.length > 400) errors.name = "Enter a food name up to 400 characters.";
  if (draft.brand !== undefined && draft.brand.length > 400) errors.brand = "Enter a brand up to 400 characters.";
  const basisAmount = draft.drink ? 100 : parseFoodGrams(draft.servingGrams);
  if (basisAmount === null) errors.servingGrams = "Enter a serving weight greater than 0 and up to 10,000 g.";
  const baseNutrition: Nutrition = { calories: 0, carbs: 0, protein: 0, fat: 0 };
  for (const key of ["calories", "carbs", "protein", "fat"] as const) {
    const amount = parseNutritionAmount(draft[key]);
    const normalized = amount === null ? NaN : amount * (100 / (basisAmount ?? 100));
    if (amount === null || !Number.isFinite(normalized)) errors[key] = "Enter a number of 0 or more.";
    else baseNutrition[key] = normalized;
  }
  const details = validateDetailedNutrientDraft(draft.details, 100 / (basisAmount ?? 100));
  if (!details.ok) errors.details = details.errors;
  if (Object.keys(errors).length || basisAmount === null || !details.ok) return { ok: false, errors };
  if (!customId.trim() || customId.length > 100) throw new Error("Invalid custom food ID");
  if (draft.drink) return { ok: true, food: { customId, name, category: "Custom food", portions: [],
    beverage: { kind: "known-volume", source: "label", per100ml: { ...baseNutrition, details: { ...unknownNutrients, ...details.amounts } } }, ...parseFoodMetadata(draft) } };
  return { ok: true, food: { customId, name, category: "Custom food", per100g: baseNutrition,
    details: { ...unknownNutrients, ...details.amounts }, portions: [{ label: "1 serving", grams: basisAmount }], ...parseFoodMetadata(draft) } };
}

export function parseCustomFoods(raw: string | null): CustomFoodDocument {
  if (raw === null) return { version: 1, foods: [], meals: [] };
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.foods)) throw new Error("Unsupported custom foods");
  const ids = new Set<string>();
  const foods = value.foods.map((food: unknown): CustomFood => {
    const parsed = parseCatalogFoodRecord(food);
    if (!isRecord(food) || parsed.customId === undefined || parsed.fdcId !== undefined || ids.has(parsed.customId) || parsed.category !== "Custom food") throw new Error("Invalid custom food");
    if (parsed.per100g) {
      const portion = parsed.portions[0];
      if (parsed.portions.length !== 1 || portion.label !== "1 serving" || portion.grams > 10000) throw new Error("Invalid custom serving");
    } else if (parsed.beverage.kind !== "known-volume" || parsed.beverage.source !== "label") throw new Error("Invalid custom drink");
    ids.add(parsed.customId);
    const { fdcId: _fdcId, ...custom } = parsed;
    return { ...custom, customId: parsed.customId, category: "Custom food" };
  });
  if (value.meals !== undefined && !Array.isArray(value.meals)) throw new Error("Invalid meal catalog");
  const meals = (value.meals ?? []).map((rawMeal: unknown) => {
    const meal = parseCustomMeal(rawMeal);
    if (ids.has(meal.customId)) throw new Error("Duplicate custom item ID");
    ids.add(meal.customId);
    return meal;
  });
  return { version: 1, foods, meals };
}

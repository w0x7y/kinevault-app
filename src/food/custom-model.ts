import { nutritionForGrams, parseFoodGrams, type CatalogFood, type Nutrition } from "./catalog.ts";
import { unknownNutrients } from "./nutrients.ts";
import { nutritionAmountText, parseNutritionAmount } from "./number-input.ts";
import { parseCustomMeal, type CustomMeal } from "./meal-model.ts";
import { isRecord } from "./catalog-record.ts";

export type CustomFood = CatalogFood & { customId: string; fdcId?: never; category: "Custom food" };
export type CustomFoodDraft = { name: string; servingGrams: string; calories: string; carbs: string; protein: string; fat: string };
export type CustomFoodDocument = { version: 1; foods: CustomFood[]; meals: CustomMeal[] };
export type CustomFoodErrors = Partial<Record<keyof CustomFoodDraft, string>>;

export function customFoodToDraft(food: CustomFood): CustomFoodDraft {
  const grams = food.portions[0].grams;
  const nutrition = nutritionForGrams(food, grams);
  // Remove floating-point noise introduced by reversing per-100g normalization.
  const servingText = (amount: number) => nutritionAmountText(Number(amount.toPrecision(15)));
  return { name: food.name, servingGrams: nutritionAmountText(grams),
    calories: servingText(nutrition.calories), carbs: servingText(nutrition.carbs),
    protein: servingText(nutrition.protein), fat: servingText(nutrition.fat) };
}

export function customFoodFromDraft(draft: CustomFoodDraft, customId: string):
  { ok: true; food: CustomFood } | { ok: false; errors: CustomFoodErrors } {
  const errors: CustomFoodErrors = {};
  const name = draft.name.trim();
  if (!name || name.length > 400) errors.name = "Enter a food name up to 400 characters.";
  const grams = parseFoodGrams(draft.servingGrams);
  if (grams === null) errors.servingGrams = "Enter a serving weight greater than 0 and up to 10,000 g.";
  const per100g: Nutrition = { calories: 0, carbs: 0, protein: 0, fat: 0 };
  for (const key of ["calories", "carbs", "protein", "fat"] as const) {
    const amount = parseNutritionAmount(draft[key]);
    const normalized = amount === null ? NaN : amount * (100 / (grams ?? 100));
    if (amount === null || !Number.isFinite(normalized)) errors[key] = "Enter a number of 0 or more.";
    else per100g[key] = normalized;
  }
  if (Object.keys(errors).length || grams === null) return { ok: false, errors };
  if (!customId.trim() || customId.length > 100) throw new Error("Invalid custom food ID");
  return { ok: true, food: { customId, name, category: "Custom food", per100g,
    details: { ...unknownNutrients }, portions: [{ label: "1 serving", grams }] } };
}

export function parseCustomFoods(raw: string | null): CustomFoodDocument {
  if (raw === null) return { version: 1, foods: [], meals: [] };
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.foods)) throw new Error("Unsupported custom foods");
  const ids = new Set<string>();
  const foods = value.foods.map((food: unknown): CustomFood => {
    if (!food || typeof food !== "object" || Array.isArray(food)) throw new Error("Invalid custom food");
    const record = food as Record<string, unknown>;
    if (typeof record.customId !== "string" || !record.customId.trim() || record.customId.length > 100 ||
      ids.has(record.customId) || record.fdcId !== undefined || typeof record.name !== "string" ||
      !record.name.trim() || record.name.length > 400 || !record.per100g || typeof record.per100g !== "object" ||
      !Array.isArray(record.portions) || record.portions.length !== 1) throw new Error("Invalid custom food values");
    const nutrition = record.per100g as Record<string, unknown>;
    const per100g: Nutrition = { calories: 0, carbs: 0, protein: 0, fat: 0 };
    for (const key of ["calories", "carbs", "protein", "fat"] as const) {
      const amount = nutrition[key];
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) throw new Error("Invalid custom nutrition");
      per100g[key] = amount;
    }
    const portion = record.portions[0];
    if (!portion || portion.label !== "1 serving" || typeof portion.grams !== "number" ||
      !Number.isFinite(portion.grams) || portion.grams <= 0 || portion.grams > 10000) throw new Error("Invalid custom serving");
    ids.add(record.customId);
    return { customId: record.customId, name: record.name.trim(), category: "Custom food", per100g,
      details: { ...unknownNutrients }, portions: [{ label: "1 serving", grams: portion.grams }] };
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

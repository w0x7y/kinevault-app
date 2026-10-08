import {
  nutritionForGrams,
  parseFoodGrams,
  type CatalogFood,
  type Nutrition,
  type ServingNutrition,
} from "./catalog.ts";
import { isRecord, parseCatalogFoodRecord } from "./catalog-record.ts";
import {
  detailedNutrients,
  scaleNutrients,
  unknownNutrients,
  type DetailedNutrients,
} from "./nutrients.ts";
import { nutritionAmountText, parseNutritionAmount } from "./number-input.ts";
import {
  detailedNutrientsToDraft,
  parseMealDetailOverrides,
  validateDetailedNutrientDraft,
  type DetailedNutrientAmounts,
  type DetailedNutrientDraft,
  type DetailedNutrientErrors,
} from "./detailed-nutrient-drafts.ts";

export type CatalogKind = "food" | "meal";
export type MealIngredient = { id: string; food: CatalogFood; grams: number };
export type MealIngredientDraft = { id: string; food: CatalogFood; amount: string };
export type MealDraft = {
  name: string;
  ingredients: MealIngredientDraft[];
  overrides: Partial<Record<keyof Nutrition, string>>;
  detailOverrides?: DetailedNutrientDraft;
};
export type CustomMeal = CatalogFood & { per100g: Nutrition } & {
  customId: string;
  fdcId?: never;
  category: "Custom meal";
  ingredients: MealIngredient[];
  overrides: Partial<Nutrition>;
  detailOverrides?: DetailedNutrientAmounts;
};
export type MealErrors = Partial<Record<keyof Nutrition | "name" | "ingredients", string>> & {
  amounts?: Record<string, string>;
  detailOverrides?: DetailedNutrientErrors;
};
type MealCalculation = {
  grams: number;
  nutrition: ServingNutrition & { details: DetailedNutrients };
};

export function mealToDraft(meal: CustomMeal): MealDraft {
  const overrides: MealDraft["overrides"] = {};
  for (const key of ["calories", "carbs", "protein", "fat"] as const) {
    const amount = meal.overrides[key];
    if (amount !== undefined) overrides[key] = nutritionAmountText(amount);
  }
  return {
    name: meal.name,
    overrides,
    detailOverrides: detailedNutrientsToDraft(meal.detailOverrides ?? {}),
    ingredients: meal.ingredients.map((ingredient) => ({
      id: ingredient.id,
      food: ingredient.food,
      amount: nutritionAmountText(ingredient.grams),
    })),
  };
}

export function calculateMeal(ingredients: readonly MealIngredient[]): MealCalculation {
  if (!ingredients.length) throw new Error("A meal needs at least one food");
  let grams = 0;
  const nutrition: MealCalculation["nutrition"] = {
    calories: 0,
    carbs: 0,
    protein: 0,
    fat: 0,
    details: { ...unknownNutrients },
  };
  for (const { key } of detailedNutrients) nutrition.details[key] = 0;
  for (const ingredient of ingredients) {
    if (!Number.isFinite(ingredient.grams) || ingredient.grams <= 0 || ingredient.grams > 10000)
      throw new RangeError("Invalid ingredient weight");
    grams += ingredient.grams;
    const values = nutritionForGrams(ingredient.food, ingredient.grams);
    for (const key of ["calories", "carbs", "protein", "fat"] as const)
      nutrition[key] += values[key];
    for (const { key } of detailedNutrients) {
      const previous = nutrition.details[key];
      const amount = values.details?.[key] ?? null;
      nutrition.details[key] = previous === null || amount === null ? null : previous + amount;
    }
  }
  if (grams > 10000 || !Number.isFinite(grams))
    throw new RangeError("A meal must weigh up to 10,000 g");
  return { grams, nutrition };
}

export function previewMeal(ingredients: readonly MealIngredientDraft[]): MealCalculation | null {
  const parsed: MealIngredient[] = [];
  for (const ingredient of ingredients) {
    const grams = parseFoodGrams(ingredient.amount);
    if (grams === null) return null;
    parsed.push({ id: ingredient.id, food: ingredient.food, grams });
  }
  try {
    return calculateMeal(parsed);
  } catch {
    return null;
  }
}

export function mealFromDraft(
  draft: MealDraft,
  customId: string,
): { ok: true; meal: CustomMeal } | { ok: false; errors: MealErrors } {
  const errors: MealErrors = {};
  const name = draft.name.trim();
  if (!name || name.length > 400) errors.name = "Enter a meal name up to 400 characters.";
  const ingredients: MealIngredient[] = [];
  const amounts: Record<string, string> = {};
  const ids = new Set<string>();
  for (const ingredient of draft.ingredients) {
    const grams = parseFoodGrams(ingredient.amount);
    if (grams === null)
      amounts[ingredient.id] = "Enter a weight greater than 0 and up to 10,000 g.";
    else
      ingredients.push({ id: ingredient.id, food: parseCatalogFoodRecord(ingredient.food), grams });
    if (!ingredient.id.trim() || ingredient.id.length > 100 || ids.has(ingredient.id))
      errors.ingredients = "Invalid ingredient identifiers.";
    ids.add(ingredient.id);
  }
  if (Object.keys(amounts).length) errors.amounts = amounts;
  if (!draft.ingredients.length) errors.ingredients = "Add at least one food to your meal.";
  const calculation = previewMeal(draft.ingredients);
  if (draft.ingredients.length && !calculation && !errors.amounts)
    errors.ingredients = "Keep the total meal weight up to 10,000 g.";
  const overrides: Partial<Nutrition> = {};
  for (const key of ["calories", "carbs", "protein", "fat"] as const) {
    const input = draft.overrides[key];
    if (input === undefined) continue;
    const amount = parseNutritionAmount(input);
    if (amount === null) errors[key] = "Enter a number of 0 or more, or use calculated nutrition.";
    else overrides[key] = amount;
  }
  const detailOverrides = validateDetailedNutrientDraft(draft.detailOverrides);
  if (!detailOverrides.ok) errors.detailOverrides = detailOverrides.errors;
  if (Object.keys(errors).length || !calculation || !detailOverrides.ok)
    return { ok: false, errors };
  if (!customId.trim() || customId.length > 100) throw new Error("Invalid meal ID");
  return assembleMeal(name, ingredients, overrides, detailOverrides.amounts, customId, calculation);
}

function assembleMeal(
  name: string,
  ingredients: MealIngredient[],
  overrides: Partial<Nutrition>,
  detailOverrides: DetailedNutrientAmounts,
  customId: string,
  calculation: MealCalculation,
): { ok: true; meal: CustomMeal } | { ok: false; errors: MealErrors } {
  const errors: MealErrors = {};
  const totals = { ...calculation.nutrition, ...overrides };
  const per100g: Nutrition = { calories: 0, carbs: 0, protein: 0, fat: 0 };
  for (const key of ["calories", "carbs", "protein", "fat"] as const) {
    const normalized = totals[key] * (100 / calculation.grams);
    if (!Number.isFinite(normalized)) errors[key] = "Enter a smaller nutrition value.";
    else per100g[key] = normalized;
  }
  const details = scaleNutrients(
    { ...calculation.nutrition.details, ...detailOverrides },
    100 / calculation.grams,
  );
  for (const { key } of detailedNutrients) {
    const amount = details[key];
    if (amount !== null && !Number.isFinite(amount)) {
      errors.detailOverrides ??= {};
      errors.detailOverrides[key] = "Enter a smaller nutrition value.";
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    meal: {
      customId,
      name,
      category: "Custom meal",
      ingredients,
      overrides,
      per100g,
      ...(Object.keys(detailOverrides).length ? { detailOverrides } : {}),
      details,
      portions: [{ label: "1 meal", grams: calculation.grams }],
    },
  };
}

export function parseCustomMeal(value: unknown): CustomMeal {
  if (
    !isRecord(value) ||
    typeof value.customId !== "string" ||
    value.fdcId !== undefined ||
    typeof value.name !== "string" ||
    !Array.isArray(value.ingredients) ||
    !isRecord(value.overrides)
  )
    throw new Error("Invalid custom meal");
  // Validate the saved catalog snapshot, then derive it again from the authoritative ingredients and overrides.
  parseCatalogFoodRecord(value);
  const name = value.name.trim();
  if (!name || name.length > 400 || !value.customId.trim() || value.customId.length > 100)
    throw new Error("Invalid meal name or ID");
  const ids = new Set<string>();
  const ingredients = value.ingredients.map((ingredient: unknown): MealIngredient => {
    if (
      !isRecord(ingredient) ||
      typeof ingredient.id !== "string" ||
      typeof ingredient.grams !== "number" ||
      !ingredient.id.trim() ||
      ingredient.id.length > 100 ||
      ids.has(ingredient.id) ||
      !Number.isFinite(ingredient.grams) ||
      ingredient.grams <= 0 ||
      ingredient.grams > 10000
    )
      throw new Error("Invalid meal ingredient");
    ids.add(ingredient.id);
    return {
      id: ingredient.id,
      food: parseCatalogFoodRecord(ingredient.food),
      grams: ingredient.grams,
    };
  });
  const overrides: Partial<Nutrition> = {};
  for (const key of ["calories", "carbs", "protein", "fat"] as const) {
    const amount = value.overrides[key];
    if (amount === undefined) continue;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
      throw new Error("Invalid meal override");
    overrides[key] = amount;
  }
  const detailOverrides = parseMealDetailOverrides(value.detailOverrides);
  const result = assembleMeal(
    name,
    ingredients,
    overrides,
    detailOverrides,
    value.customId,
    calculateMeal(ingredients),
  );
  if (!result.ok) throw new Error("Invalid meal values");
  return result.meal;
}

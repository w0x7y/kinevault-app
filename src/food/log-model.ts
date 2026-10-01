import { parseDay } from "../calendar/dates.ts";
import { meals, type FoodEntry, type Meal } from "../daily/model.ts";
import { nutritionForGrams, type CatalogFood, type ServingNutrition } from "./catalog.ts";
import { detailedNutrients, scaleNutrients, unknownNutrients, type DetailedNutrients } from "./nutrients.ts";

export type FoodLogDocument = { version: 1; days: Record<string, FoodEntry[]> };
export type AddFoodInput = { date: string; food: CatalogFood; grams: number; meal: Meal };
export type EditFoodInput = { date: string; id: string; grams: number; meal: Meal };
export type FoodSaveTarget = { kind: "add"; food: CatalogFood } | { kind: "edit"; entry: FoodEntry };
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function parseNutrients(value: unknown): DetailedNutrients {
  if (!isRecord(value)) throw new Error("Invalid detailed nutrients");
  const result = { ...unknownNutrients };
  for (const { key } of detailedNutrients) {
    const amount = value[key];
    if (amount === undefined || amount === null) result[key] = null;
    else if (isNumber(amount)) result[key] = amount;
    else throw new Error("Invalid detailed nutrient amount");
  }
  return result;
}
function parseEntry(value: unknown): FoodEntry {
  if (!isRecord(value)) throw new Error("Invalid food entry");
  const meal = meals.find(meal => meal.key === value.meal)?.key;
  if (typeof value.id !== "string" || !value.id.trim() || value.id.length > 100 ||
    typeof value.name !== "string" || !value.name.trim() || value.name.length > 400 || !meal ||
    !isNumber(value.fdcId) || !Number.isInteger(value.fdcId) || value.fdcId <= 0 ||
    !isNumber(value.grams) || value.grams <= 0 || value.grams > 10000 ||
    !isNumber(value.calories) || !isNumber(value.carbs) || !isNumber(value.protein) || !isNumber(value.fat))
    throw new Error("Invalid logged food values");
  return {
    id: value.id, name: value.name, meal, fdcId: value.fdcId, grams: value.grams,
    calories: value.calories, carbs: value.carbs, protein: value.protein, fat: value.fat,
    ...(value.details === undefined ? {} : { details: parseNutrients(value.details) }),
  };
}

export function parseFoodLog(raw: string | null): FoodLogDocument {
  if (raw === null) return { version: 1, days: {} };
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.days))
    throw new Error("Unsupported food log");
  const days: FoodLogDocument["days"] = {};
  const ids = new Set<string>();
  for (const [date, rawEntries] of Object.entries(value.days)) {
    parseDay(date);
    if (!Array.isArray(rawEntries)) throw new Error("Invalid food log day");
    days[date] = rawEntries.map((rawEntry: unknown) => {
      const entry = parseEntry(rawEntry);
      if (ids.has(entry.id)) throw new Error("Duplicate food entry ID");
      ids.add(entry.id);
      return entry;
    });
  }
  return { version: 1, days };
}
export function entryForFood({ id, food, grams, meal }: Omit<AddFoodInput, "date"> & { id: string }): FoodEntry {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) throw new RangeError("Invalid food weight");
  return parseEntry({ id, name: food.name, fdcId: food.fdcId, grams, meal, ...nutritionForGrams(food, grams) });
}

export function nutritionForEntry(entry: FoodEntry, grams: number): ServingNutrition {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) throw new RangeError("Invalid food weight");
  const factor = grams / entry.grams;
  return { calories: entry.calories * factor, carbs: entry.carbs * factor,
    protein: entry.protein * factor, fat: entry.fat * factor,
    ...(entry.details ? { details: scaleNutrients(entry.details, factor) } : {}) };
}

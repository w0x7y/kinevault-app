import { parseDay } from "../calendar/dates.ts";
import { detailedNutrientsForEntry, type FindFood } from "./entry-nutrients.ts";
import { meals, type FoodEntry, type Meal } from "../daily/model.ts";
import { nutritionForGrams, type CatalogFood, type ServingNutrition } from "./catalog.ts";
import { beverageForFood, nutritionForMl } from "./beverage.ts";
import {
  detailedNutrients,
  scaleNutrients,
  unknownNutrients,
  type DetailedNutrients,
} from "./nutrients.ts";

export type FoodLogDocument = { version: 1; days: Record<string, FoodEntry[]> };
type LogAmount =
  | { measurement?: "grams"; grams: number; meal: Meal; drinkMl?: never }
  | {
      measurement: "volume";
      drinkMl: number;
      nutritionPer100ml?: ServingNutrition;
      grams?: never;
      meal?: "drinks";
    };
export type AddFoodInput = { date: string; food: CatalogFood } & LogAmount;
export type EditFoodInput = { date: string; id: string } & LogAmount;
export type FoodSaveTarget =
  { kind: "add"; food: CatalogFood } | { kind: "edit"; entry: FoodEntry };
// New intake writes require explicit volume; legacy records may omit it.
export function drinkVolumeForMeal(meal: Meal, drinkMl: unknown): { drinkMl?: number } {
  if (meal !== "drinks") {
    if (drinkMl !== undefined) throw new RangeError("Only Drinks can have a drink amount");
    return {};
  }
  if (
    typeof drinkMl !== "number" ||
    !Number.isSafeInteger(drinkMl) ||
    drinkMl < 1 ||
    drinkMl > 10000
  )
    throw new RangeError("Invalid drink amount");
  return { drinkMl };
}
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
  const meal = meals.find((meal) => meal.key === value.meal)?.key;
  const identity =
    typeof value.customId === "string" &&
    value.customId.trim() &&
    value.customId.length <= 100 &&
    value.fdcId === undefined
      ? { customId: value.customId }
      : isNumber(value.fdcId) &&
          Number.isInteger(value.fdcId) &&
          value.fdcId > 0 &&
          value.customId === undefined
        ? { fdcId: value.fdcId }
        : null;
  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    value.id.length > 100 ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 400 ||
    !meal ||
    !identity ||
    !isNumber(value.calories) ||
    !isNumber(value.carbs) ||
    !isNumber(value.protein) ||
    !isNumber(value.fat)
  )
    throw new Error("Invalid logged food values");
  const common = {
    id: value.id,
    name: value.name,
    ...identity,
    calories: value.calories,
    carbs: value.carbs,
    protein: value.protein,
    fat: value.fat,
    ...(value.details === undefined ? {} : { details: parseNutrients(value.details) }),
  };
  if (value.measurement === "volume") {
    if (meal !== "drinks" || value.grams !== undefined) throw new Error("Invalid volume entry");
    drinkVolumeForMeal("drinks", value.drinkMl);
    if (typeof value.drinkMl !== "number") throw new Error("Invalid volume entry");
    return { ...common, meal: "drinks", measurement: "volume", drinkMl: value.drinkMl };
  }
  if (
    (value.measurement !== undefined && value.measurement !== "grams") ||
    !isNumber(value.grams) ||
    value.grams <= 0 ||
    value.grams > 10000
  )
    throw new Error("Invalid gram entry");
  return {
    ...common,
    meal,
    grams: value.grams,
    ...(value.measurement === "grams" ? { measurement: "grams" } : {}),
    ...(value.drinkMl === undefined ? {} : drinkVolumeForMeal(meal, value.drinkMl)),
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
export function entryForFood(
  input: (Omit<AddFoodInput, "date"> & LogAmount) & { id: string },
): FoodEntry {
  const { id, food } = input;
  if (input.measurement === "volume") {
    if (input.grams !== undefined || (input.meal !== undefined && input.meal !== "drinks"))
      throw new Error("Invalid volume input");
    const beverage = beverageForFood(food);
    if (!beverage) throw new Error("Select the drink setting before logging volume");
    const basis =
      input.nutritionPer100ml ?? (beverage.kind === "known-volume" ? beverage.per100ml : null);
    if (!basis) throw new Error("Enter label nutrition per 100 ml");
    return parseEntry({
      id,
      name: food.name,
      fdcId: food.fdcId,
      customId: food.customId,
      measurement: "volume",
      meal: "drinks",
      drinkMl: input.drinkMl,
      ...nutritionForMl(basis, input.drinkMl),
    });
  }
  if (beverageForFood(food) || input.meal === "drinks" || input.drinkMl !== undefined)
    throw new Error("Drinks require volume logging");
  const { grams, meal } = input;
  if (!Number.isFinite(grams) || grams <= 0 || grams > 10000)
    throw new RangeError("Invalid food weight");
  return parseEntry({
    id,
    name: food.name,
    fdcId: food.fdcId,
    customId: food.customId,
    grams,
    meal,
    ...nutritionForGrams(food, grams),
  });
}

export function nutritionForEntry(entry: FoodEntry, grams: number): ServingNutrition {
  if (entry.measurement === "volume") throw new Error("Use drink volume for this entry");
  if (!Number.isFinite(grams) || grams <= 0 || grams > 10000)
    throw new RangeError("Invalid food weight");
  const factor = grams / entry.grams;
  return scaleEntry(entry, factor);
}
function scaleEntry(entry: ServingNutrition, factor: number): ServingNutrition {
  return {
    calories: entry.calories * factor,
    carbs: entry.carbs * factor,
    protein: entry.protein * factor,
    fat: entry.fat * factor,
    ...(entry.details ? { details: scaleNutrients(entry.details, factor) } : {}),
  };
}
export function nutritionForEntryMl(
  entry: FoodEntry,
  drinkMl: number,
  nutritionPer100ml?: ServingNutrition,
  findFood?: FindFood,
): ServingNutrition {
  drinkVolumeForMeal("drinks", drinkMl);
  if (nutritionPer100ml) return nutritionForMl(nutritionPer100ml, drinkMl);
  if (entry.drinkMl === undefined)
    throw new Error("Enter label nutrition per 100 ml for this legacy drink");
  return {
    ...scaleEntry(entry, drinkMl / entry.drinkMl),
    details: scaleNutrients(detailedNutrientsForEntry(entry, findFood), drinkMl / entry.drinkMl),
  };
}
export function editedFoodEntry(
  entry: FoodEntry,
  input: EditFoodInput,
  findFood?: FindFood,
): FoodEntry {
  if (input.measurement === "volume") {
    if (input.grams !== undefined || (input.meal !== undefined && input.meal !== "drinks"))
      throw new Error("Invalid volume input");
    return parseEntry({
      id: entry.id,
      name: entry.name,
      fdcId: entry.fdcId,
      customId: entry.customId,
      meal: "drinks",
      measurement: "volume",
      drinkMl: input.drinkMl,
      ...nutritionForEntryMl(entry, input.drinkMl, input.nutritionPer100ml, findFood),
    });
  }
  if (entry.measurement === "volume" || input.meal === "drinks" || input.drinkMl !== undefined)
    throw new Error("Drinks require volume logging");
  return parseEntry({
    id: entry.id,
    name: entry.name,
    fdcId: entry.fdcId,
    customId: entry.customId,
    grams: input.grams,
    meal: input.meal,
    ...nutritionForEntry(entry, input.grams),
  });
}

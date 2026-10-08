import type { CatalogFood, FoodIdentity, Nutrition } from "./catalog.ts";
import type { BeverageMetadata } from "./beverage.ts";
import { detailedNutrients, unknownNutrients, type DetailedNutrients } from "./nutrients.ts";
import { parseFoodMetadata } from "./import-metadata.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseNutrition(value: unknown): Nutrition {
  if (!isRecord(value)) throw new Error("Invalid food nutrition");
  const result: Nutrition = { calories: 0, carbs: 0, protein: 0, fat: 0 };
  for (const key of ["calories", "carbs", "protein", "fat"] as const) {
    const amount = value[key];
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
      throw new Error("Invalid food nutrition");
    result[key] = amount;
  }
  return result;
}
function parseDetails(value: unknown): DetailedNutrients {
  const result = { ...unknownNutrients };
  if (value === undefined) return result;
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !detailedNutrients.some((nutrient) => nutrient.key === key))
  )
    throw new Error("Invalid food nutrients");
  for (const { key } of detailedNutrients) {
    const amount = value[key];
    if (amount === null || amount === undefined) continue;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
      throw new Error("Invalid food nutrient");
    result[key] = amount;
  }
  return result;
}
function parseBeverage(value: unknown): BeverageMetadata | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("Invalid drink metadata");
  if (value.kind === "unknown-volume") {
    if (value.per100ml !== undefined || value.source !== undefined)
      throw new Error("Invalid unknown drink basis");
    return { kind: "unknown-volume" };
  }
  if (
    value.kind !== "known-volume" ||
    !isRecord(value.per100ml) ||
    (value.source !== "label" && value.source !== "usda-portion")
  )
    throw new Error("Invalid drink basis");
  return {
    kind: "known-volume",
    source: value.source,
    per100ml: { ...parseNutrition(value.per100ml), details: parseDetails(value.per100ml.details) },
  };
}
export function parseCatalogFoodRecord(value: unknown): CatalogFood {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 400 ||
    typeof value.category !== "string" ||
    !Array.isArray(value.portions)
  )
    throw new Error("Invalid ingredient food");
  let identity: FoodIdentity;
  if (
    typeof value.customId === "string" &&
    value.customId.trim() &&
    value.customId.length <= 100 &&
    value.fdcId === undefined
  )
    identity = { customId: value.customId };
  else if (
    typeof value.fdcId === "number" &&
    Number.isInteger(value.fdcId) &&
    value.fdcId > 0 &&
    value.customId === undefined
  )
    identity = { fdcId: value.fdcId };
  else throw new Error("Invalid ingredient identity");
  const common = {
    ...identity,
    name: value.name.trim(),
    category: value.category,
    ...parseFoodMetadata(value),
  };
  const beverage = parseBeverage(value.beverage);
  if (value.per100g === undefined) {
    if (beverage?.kind !== "known-volume" || value.portions.length || value.details !== undefined)
      throw new Error("Invalid volume-only drink");
    return { ...common, portions: [], beverage };
  }
  const portions = value.portions.map((portion: unknown) => {
    if (
      !isRecord(portion) ||
      typeof portion.label !== "string" ||
      !portion.label.trim() ||
      typeof portion.grams !== "number" ||
      !Number.isFinite(portion.grams) ||
      portion.grams <= 0
    )
      throw new Error("Invalid ingredient portion");
    return { label: portion.label, grams: portion.grams };
  });
  return {
    ...common,
    per100g: parseNutrition(value.per100g),
    details: parseDetails(value.details),
    portions,
    ...(beverage ? { beverage } : {}),
  };
}

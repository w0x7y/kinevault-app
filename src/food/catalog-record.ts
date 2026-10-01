import type { CatalogFood, FoodIdentity, Nutrition } from "./catalog.ts";
import { detailedNutrients, unknownNutrients } from "./nutrients.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseCatalogFoodRecord(value: unknown): CatalogFood {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim() || value.name.length > 400 ||
    typeof value.category !== "string" || !isRecord(value.per100g) || !Array.isArray(value.portions))
    throw new Error("Invalid ingredient food");
  let identity: FoodIdentity;
  if (typeof value.customId === "string" && value.customId.trim() && value.customId.length <= 100 && value.fdcId === undefined)
    identity = { customId: value.customId };
  else if (typeof value.fdcId === "number" && Number.isInteger(value.fdcId) && value.fdcId > 0 && value.customId === undefined)
    identity = { fdcId: value.fdcId };
  else throw new Error("Invalid ingredient identity");
  const per100g: Nutrition = { calories: 0, carbs: 0, protein: 0, fat: 0 };
  for (const key of ["calories", "carbs", "protein", "fat"] as const) {
    const amount = value.per100g[key];
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) throw new Error("Invalid ingredient nutrition");
    per100g[key] = amount;
  }
  const details = { ...unknownNutrients };
  if (value.details !== undefined) {
    if (!isRecord(value.details)) throw new Error("Invalid ingredient nutrients");
    for (const { key } of detailedNutrients) {
      const amount = value.details[key];
      if (amount === null || amount === undefined) continue;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) throw new Error("Invalid ingredient nutrient");
      details[key] = amount;
    }
  }
  const portions = value.portions.map((portion: unknown) => {
    if (!isRecord(portion) || typeof portion.label !== "string" || !portion.label.trim() ||
      typeof portion.grams !== "number" || !Number.isFinite(portion.grams) || portion.grams <= 0)
      throw new Error("Invalid ingredient portion");
    return { label: portion.label, grams: portion.grams };
  });
  return { ...identity, name: value.name.trim(), category: value.category, per100g, details, portions };
}

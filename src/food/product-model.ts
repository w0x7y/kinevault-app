import type { CustomFoodDraft } from "./custom-model.ts";
import type { DetailedNutrientDraft } from "./detailed-nutrient-drafts.ts";
import { isRecord } from "./catalog-record.ts";
import { normalizeProductBarcode } from "./barcode.ts";
import { nutritionAmountText } from "./number-input.ts";

export type BrandedProduct = {
  barcode: string;
  name: string;
  brand: string;
  draft: CustomFoodDraft;
  volumeBased: boolean;
};

function amount(value: unknown): number | null {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function amountText(value: number | null): string {
  return value === null ? "" : nutritionAmountText(Number(value.toPrecision(12)));
}

function hasVolume(value: unknown): boolean {
  return /(?:^|[\s\d×x(])(?:ml|cl|dl|l|litres?|liters?|fl\.?\s*oz)(?=$|[\s\d).])/i.test(
    text(value),
  );
}

/** OFF *_100g is per 100 g or 100 ml. Volume packaging alone does not identify a drink. */
export function parseBrandedProduct(value: unknown): BrandedProduct | null {
  if (!isRecord(value) || typeof value.code !== "string") return null;
  const barcode = normalizeProductBarcode(value.code);
  if (!barcode) return null;
  const name = (
    text(value.product_name) ||
    text(value.product_name_en) ||
    text(value.product_name_he) ||
    `Product ${barcode}`
  ).slice(0, 400);
  const brand = text(value.brands).slice(0, 400);
  const volumeBased = [
    value.product_quantity_unit,
    value.serving_quantity_unit,
    value.quantity,
    value.serving_size,
  ].some(hasVolume);
  const categoryTags = Array.isArray(value.categories_tags)
    ? value.categories_tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const drink =
    volumeBased &&
    categoryTags.some((tag) =>
      [
        "en:beverages",
        "en:non-alcoholic-beverages",
        "en:alcoholic-beverages",
        "en:milks",
        "en:plant-based-milk-substitutes",
        "en:fruit-juices",
        "en:soft-drinks",
        "en:waters",
        "en:teas",
        "en:coffees",
      ].includes(tag),
    );
  const draft: CustomFoodDraft = {
    name,
    ...(drink ? { drink: true } : {}),
    servingGrams: "100",
    calories: "",
    carbs: "",
    protein: "",
    fat: "",
    details: {},
  };
  if ((!volumeBased || drink) && value.no_nutrition_data !== "on" && isRecord(value.nutriments)) {
    const nutrients = value.nutriments;
    const nutrient = (id: string) => amount(nutrients[`${id}_100g`]);
    const kilojoules = nutrient("energy-kj") ?? nutrient("energy");
    draft.calories = amountText(
      nutrient("energy-kcal") ?? (kilojoules === null ? null : kilojoules / 4.184),
    );
    draft.carbs = amountText(nutrient("carbohydrates-total") ?? nutrient("carbohydrates"));
    draft.protein = amountText(nutrient("proteins"));
    draft.fat = amountText(nutrient("fat"));
    const details: DetailedNutrientDraft = {};
    const mappings = [
      ["saturatedFat", "saturated-fat", 1],
      ["transFat", "trans-fat", 1],
      ["fiber", "fiber", 1],
      ["totalSugars", "sugars", 1],
      ["sodium", "sodium", 1000],
      ["cholesterol", "cholesterol", 1000],
      ["potassium", "potassium", 1000],
      ["calcium", "calcium", 1000],
      ["iron", "iron", 1000],
      ["vitaminD", "vitamin-d", 1_000_000],
      ["caffeine", "caffeine", 1000],
    ] as const;
    for (const [key, id, factor] of mappings) {
      const known = nutrient(id);
      const converted = known === null ? null : known * factor;
      if (converted !== null && Number.isFinite(converted)) details[key] = amountText(converted);
    }
    // OFF alcohol_100g is percentage by volume; the app needs grams, so leave it unknown.
    draft.details = details;
  }
  return { barcode, name, brand, draft, volumeBased };
}

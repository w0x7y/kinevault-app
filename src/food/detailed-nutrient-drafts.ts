import { isRecord } from "./catalog-record.ts";
import {
  detailedNutrients,
  unknownNutrients,
  type DetailedNutrientKey,
  type DetailedNutrients,
} from "./nutrients.ts";
import { nutritionAmountText, parseNutritionAmount } from "./number-input.ts";

export type DetailedNutrientDraft = Partial<Record<DetailedNutrientKey, string>>;
export type DetailedNutrientErrors = Partial<Record<DetailedNutrientKey, string>>;
export type DetailedNutrientAmounts = Partial<Record<DetailedNutrientKey, number>>;

// Blanks omit an amount: foods keep it unknown and meals calculate it from ingredients.
export function validateDetailedNutrientDraft(
  draft: DetailedNutrientDraft = {},
  factor = 1,
): { ok: true; amounts: DetailedNutrientAmounts } | { ok: false; errors: DetailedNutrientErrors } {
  const amounts: DetailedNutrientAmounts = {};
  const errors: DetailedNutrientErrors = {};
  for (const { key } of detailedNutrients) {
    const input = draft[key];
    if (input === undefined || input.trim() === "") continue;
    const amount = parseNutritionAmount(input);
    const normalized = amount === null ? NaN : amount * factor;
    if (amount === null || !Number.isFinite(normalized))
      errors[key] = "Enter a number of 0 or more, or leave blank.";
    else amounts[key] = normalized;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, amounts };
}

export function detailedNutrientsToDraft(
  amounts: Partial<Record<DetailedNutrientKey, number | null>>,
  formatAmount: (amount: number) => string = nutritionAmountText,
): DetailedNutrientDraft {
  const draft: DetailedNutrientDraft = {};
  for (const { key } of detailedNutrients) {
    const amount = amounts[key];
    if (amount !== undefined && amount !== null) draft[key] = formatAmount(amount);
  }
  return draft;
}

function parseDetailedAmounts(value: unknown, nullable: boolean): DetailedNutrientAmounts {
  if (value === undefined) return {};
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !detailedNutrients.some((nutrient) => nutrient.key === key))
  )
    throw new Error("Invalid detailed nutrients");
  const amounts: DetailedNutrientAmounts = {};
  for (const { key } of detailedNutrients) {
    const amount = value[key];
    if (amount === undefined || (nullable && amount === null)) continue;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
      throw new Error("Invalid detailed nutrient amount");
    amounts[key] = amount;
  }
  return amounts;
}

export function parseFoodDetails(value: unknown): DetailedNutrients {
  return { ...unknownNutrients, ...parseDetailedAmounts(value, true) };
}

export function parseMealDetailOverrides(value: unknown): DetailedNutrientAmounts {
  return parseDetailedAmounts(value, false);
}

import type { Meal } from "../daily/model.ts";
import { waterAmountFromText } from "../water/model.ts";
import { beverageForFood } from "./beverage.ts";
import {
  parseFoodGrams,
  type CatalogFood,
  type Nutrition,
  type ServingNutrition,
} from "./catalog.ts";
import type { FindFood } from "./entry-nutrients.ts";
import {
  editedFoodEntry,
  entryForFood,
  type AddFoodInput,
  type EditFoodInput,
  type FoodSaveTarget,
} from "./log-model.ts";
import { parseNutritionAmount } from "./number-input.ts";

export type FoodLoggingFields = {
  grams: string;
  drinkMl: string;
  meal: Meal;
  labelNutrition: Record<keyof Nutrition, string>;
};
type LabelGuidance =
  | { kind: "source" | "snapshot" }
  | { kind: "required"; status: "incomplete" | "invalid" | "valid" };
type ReadyLabelGuidance = { kind: "source" | "snapshot" } | { kind: "required"; status: "valid" };
type Measurement<Amount, Label = LabelGuidance> =
  | { measurement: "grams"; amount: Amount; meal: Meal }
  | { measurement: "volume"; amount: Amount; meal: "drinks"; label: Label };
type PreparedWrite = { kind: "add"; input: AddFoodInput } | { kind: "edit"; input: EditFoodInput };
export type FoodLoggingPreparation = { date: string; operation: "add" | "edit" } & (
  | (Measurement<number, ReadyLabelGuidance> & {
      status: "ready";
      nutrition: ServingNutrition;
      write: PreparedWrite;
    })
  | (Measurement<number | null> & {
      status: "incomplete" | "invalid";
      reason: "amount" | "label" | "meal";
      message: string;
    })
);

const gramMessage = "Enter an amount greater than 0 and up to 10,000 g.";
const volumeMessage = "Enter a whole drink amount from 1 to 10,000 ml.";
const labelMessage =
  "Enter label nutrition per 100 ml and a whole drink amount from 1 to 10,000 ml.";

/** Prepare one preview and write from validated catalog/log sources and the entered fields.
 * Sources keep their own validation; incomplete user input never carries an executable write.
 * Current catalog information selects measurement, while logged snapshots retain their basis.
 */
export function prepareFoodLogging({
  target,
  date,
  fields,
  findFood,
  catalogItem,
}: {
  target: FoodSaveTarget;
  date: string;
  fields: FoodLoggingFields;
  findFood: FindFood;
  catalogItem?: CatalogFood;
}): FoodLoggingPreparation {
  const common = { date, operation: target.kind };
  const food =
    catalogItem ??
    (target.kind === "add"
      ? target.food
      : target.entry.fdcId === undefined
        ? undefined
        : findFood(target.entry.fdcId));
  const beverage = food ? beverageForFood(food) : null;
  const volume =
    (target.kind === "edit" &&
      (target.entry.measurement === "volume" || target.entry.meal === "drinks")) ||
    beverage !== null;
  let measurement: Measurement<number, ReadyLabelGuidance>;
  let write: PreparedWrite;
  if (volume) {
    const amount = waterAmountFromText(fields.drinkMl);
    const labelRequired =
      target.kind === "add"
        ? beverage?.kind !== "known-volume"
        : target.entry.drinkMl === undefined;
    const parsed: Nutrition = { calories: 0, carbs: 0, protein: 0, fat: 0 };
    let labelStatus: "valid" | "incomplete" | "invalid" = "valid";
    if (labelRequired) {
      for (const key of ["calories", "carbs", "protein", "fat"] as const) {
        const value = parseNutritionAmount(fields.labelNutrition[key]);
        if (value !== null) parsed[key] = value;
        else if (fields.labelNutrition[key].trim()) labelStatus = "invalid";
        else if (labelStatus === "valid") labelStatus = "incomplete";
      }
    }
    const label: LabelGuidance = labelRequired
      ? { kind: "required", status: labelStatus }
      : { kind: target.kind === "edit" ? "snapshot" : "source" };
    const volumeFields = { measurement: "volume", meal: "drinks", label } as const;
    if (amount === null)
      return {
        ...common,
        ...volumeFields,
        amount,
        status: fields.drinkMl.trim() ? "invalid" : "incomplete",
        reason: "amount",
        message: labelRequired && labelStatus !== "valid" ? labelMessage : volumeMessage,
      };
    if (labelStatus !== "valid")
      return {
        ...common,
        ...volumeFields,
        amount,
        status: labelStatus,
        reason: "label",
        message: labelMessage,
      };
    measurement = {
      ...volumeFields,
      amount,
      label: labelRequired
        ? { kind: "required", status: "valid" }
        : { kind: target.kind === "edit" ? "snapshot" : "source" },
    };
    const input = {
      date,
      measurement: "volume",
      drinkMl: amount,
      ...(labelRequired ? { nutritionPer100ml: parsed } : {}),
    } as const;
    write =
      target.kind === "add"
        ? { kind: "add", input: { ...input, food: food ?? target.food } }
        : { kind: "edit", input: { ...input, id: target.entry.id } };
  } else {
    const amount = parseFoodGrams(fields.grams);
    const gramFields = { measurement: "grams", meal: fields.meal } as const;
    if (amount === null)
      return {
        ...common,
        ...gramFields,
        amount,
        status: fields.grams.trim() ? "invalid" : "incomplete",
        reason: "amount",
        message: gramMessage,
      };
    if (fields.meal === "drinks")
      return {
        ...common,
        ...gramFields,
        amount,
        status: "invalid",
        reason: "meal",
        message: "Choose a meal for this food.",
      };
    measurement = { ...gramFields, amount };
    const input = { date, grams: amount, meal: fields.meal };
    write =
      target.kind === "add"
        ? { kind: "add", input: { ...input, food: food ?? target.food } }
        : { kind: "edit", input: { ...input, id: target.entry.id } };
  }
  // The same authoritative constructors used by persistence supply the preview.
  // No catalog-based recalculation can replace a logged macro or nutrient snapshot.
  const entry =
    write.kind === "add"
      ? entryForFood({ ...write.input, id: "preview" })
      : target.kind === "edit"
        ? editedFoodEntry(target.entry, write.input, findFood)
        : undefined;
  if (!entry) throw new Error("An edit preparation requires a logged entry");
  const nutrition: ServingNutrition = {
    calories: entry.calories,
    carbs: entry.carbs,
    protein: entry.protein,
    fat: entry.fat,
    ...(entry.details === undefined ? {} : { details: entry.details }),
  };
  return { ...common, ...measurement, status: "ready", nutrition, write };
}

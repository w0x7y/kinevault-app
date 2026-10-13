import type { Meal } from "../daily/model.ts";
import type { CatalogFood, Nutrition } from "./catalog.ts";
import type { FindFood } from "./entry-nutrients.ts";
import type { FoodSaveTarget } from "./log-model.ts";
import {
  prepareFoodLogging,
  type FoodLoggingFields,
  type FoodLoggingPreparation,
} from "./logging-preparation.ts";
import { nutritionAmountText } from "./number-input.ts";

export type FoodLoggingWrite = Extract<FoodLoggingPreparation, { status: "ready" }>["write"];
export type FoodLoggingAttemptSnapshot = Readonly<{
  target: FoodSaveTarget;
  fields: Readonly<FoodLoggingFields>;
  preparation: FoodLoggingPreparation;
  pending: boolean;
  failed: boolean;
  submittable: boolean;
}>;
type Sources = { date: string; catalogItem: CatalogFood | undefined; available: boolean };

/** Starting grams for a chosen food: a saved item's first serving, otherwise 100 g. */
export function defaultAmount(food: CatalogFood): string {
  return nutritionAmountText(food.customId ? (food.portions[0]?.grams ?? 100) : 100);
}

// One owner for a Logging attempt: entered fields, the preview prepared from them, and
// its save. Closing drops a save that finishes later; a failure keeps every field.
export function createFoodLoggingAttempt({
  target: original,
  date,
  initialMeal,
  catalogItem,
  available = true,
  findFood,
  save,
  syncMealIntent,
}: {
  target: FoodSaveTarget;
  date: string;
  initialMeal?: Meal;
  /** The saved Custom food or meal behind the target when the attempt opens. */
  catalogItem?: CatalogFood;
  /** Whether the food log can accept a write now. */
  available?: boolean;
  findFood: FindFood;
  save: (write: FoodLoggingWrite) => Promise<boolean>;
  /** Shares a chosen Meal with catalog drafts as their logging destination. */
  syncMealIntent?: (meal: Meal) => void;
}) {
  const listeners = new Set<() => void>();
  // A deleted saved item keeps showing what was opened until the view returns.
  const openedItem = catalogItem;
  let sources: Sources = { date, catalogItem, available };
  let fields: FoodLoggingFields = {
    grams:
      original.kind === "edit"
        ? nutritionAmountText(original.entry.grams ?? 100)
        : defaultAmount(catalogItem ?? original.food),
    drinkMl:
      original.kind === "edit" && original.entry.drinkMl !== undefined
        ? String(original.entry.drinkMl)
        : "",
    meal: original.kind === "edit" ? original.entry.meal : (initialMeal ?? "breakfast"),
    labelNutrition: { calories: "", carbs: "", protein: "", fat: "" },
  };
  let pending = false,
    failed = false,
    active = true,
    ticket = 0;
  let snapshot = build();

  function build(): FoodLoggingAttemptSnapshot {
    const item = sources.catalogItem ?? openedItem;
    const target: FoodSaveTarget =
      original.kind === "add" && item ? { kind: "add", food: item } : original;
    const preparation = prepareFoodLogging({
      target,
      date: sources.date,
      fields,
      findFood,
      catalogItem: sources.catalogItem,
    });
    const submittable = active && !pending && sources.available && preparation.status === "ready";
    return { target, fields, preparation, pending, failed, submittable };
  }
  function publish() {
    snapshot = build();
    for (const listener of listeners) listener();
  }
  function change(next: Partial<FoodLoggingFields>) {
    fields = { ...fields, ...next };
    publish();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (active) return;
      active = true;
      publish();
    },
    close() {
      if (!active) return;
      active = false;
      ++ticket;
      pending = false;
      publish();
    },
    /** Follows the Selected day, live saved-item changes, and food-log availability. */
    refresh(next: Sources) {
      if (
        next.date === sources.date &&
        next.catalogItem === sources.catalogItem &&
        next.available === sources.available
      )
        return;
      sources = { ...next };
      publish();
    },
    /** A saved catalog edit restarts the amount from the edited item's serving.
     * The edited item itself arrives through refresh with other live catalog changes.
     */
    catalogSaved(item: CatalogFood) {
      change({ grams: defaultAmount(item) });
    },
    setGrams(grams: string) {
      change({ grams });
    },
    setDrinkMl(drinkMl: string) {
      change({ drinkMl });
    },
    setLabelNutrition(key: keyof Nutrition, value: string) {
      change({ labelNutrition: { ...fields.labelNutrition, [key]: value } });
    },
    chooseMeal(meal: Meal) {
      change({ meal });
      if (original.kind === "add") syncMealIntent?.(meal);
    },
    /** Adopts a catalog draft's retained destination without rewriting it. */
    restoreMeal(meal: Meal) {
      change({ meal });
    },
    /** Resolves true only when the write succeeded while the attempt stayed open. */
    async submit(): Promise<boolean> {
      const { preparation } = snapshot;
      if (!snapshot.submittable || preparation.status !== "ready") return false;
      const own = ticket;
      pending = true;
      failed = false;
      publish();
      let saved = false;
      try {
        saved = await save(preparation.write);
      } catch {
        saved = false;
      }
      if (own !== ticket) return false;
      pending = false;
      failed = !saved;
      publish();
      return saved;
    },
  };
}
export type FoodLoggingAttempt = ReturnType<typeof createFoodLoggingAttempt>;

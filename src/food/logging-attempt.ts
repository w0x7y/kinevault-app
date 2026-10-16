import type { Meal } from "../daily/model.ts";
import type { CatalogFood, Nutrition } from "./catalog.ts";
import type { MealDestination } from "./catalog-drafts.ts";
import type { SavedCatalogItem } from "./catalog-selection.ts";
import type { createCustomFoodPersistence } from "./custom-persistence.ts";
import type { FoodSaveTarget } from "./log-model.ts";
import type { createFoodLogPersistence } from "./log-persistence.ts";
import {
  prepareFoodLogging,
  type FoodLoggingFields,
  type FoodLoggingPreparation,
} from "./logging-preparation.ts";
import { nutritionAmountText } from "./number-input.ts";

type FoodLog = Pick<
  ReturnType<typeof createFoodLogPersistence>,
  "getSnapshot" | "subscribe" | "add" | "edit" | "findFood"
>;
type Catalog = Pick<ReturnType<typeof createCustomFoodPersistence>, "getSnapshot" | "subscribe">;
type Sources = { item: SavedCatalogItem | undefined; ready: boolean; catalogBusy: boolean };

export type FoodLoggingAttemptSnapshot = Readonly<{
  target: FoodSaveTarget;
  fields: Readonly<FoodLoggingFields>;
  preparation: FoodLoggingPreparation;
  /** The saved Custom food or meal behind the target: the current one, or as opened once deleted. */
  item: SavedCatalogItem | undefined;
  /** This attempt's own write is in flight. A food-log refresh is not a save. */
  saving: boolean;
  failed: boolean;
  /** Entered fields are locked while this attempt or a catalog write is saving. */
  busy: boolean;
  submittable: boolean;
}>;

/** Starting grams for a chosen food: a saved item's first serving, otherwise 100 g. */
export function defaultAmount(food: CatalogFood): string {
  return nutritionAmountText(food.customId ? (food.portions[0]?.grams ?? 100) : 100);
}

function savedItem(catalog: Catalog, customId: string | undefined): SavedCatalogItem | undefined {
  const state = catalog.getSnapshot().state;
  if (customId === undefined || state.kind !== "ready") return undefined;
  const food = state.document.foods.find((food) => food.customId === customId);
  if (food) return { kind: "food", food };
  const meal = state.document.meals.find((meal) => meal.customId === customId);
  return meal && { kind: "meal", food: meal };
}

// One owner for a Logging attempt: entered fields, the preview prepared from them, and
// its save. It follows the Selected day it is given, the live saved item, food-log
// readiness and catalog writes. Adding reads and writes the shared Meal destination;
// editing keeps the logged entry's own meal. Closing drops a save that finishes later;
// a failure keeps every field.
export function createFoodLoggingAttempt({
  target: original,
  date,
  log,
  catalog,
  destination,
}: {
  target: FoodSaveTarget;
  date: string;
  log: FoodLog;
  catalog: Catalog;
  destination: MealDestination;
}) {
  const listeners = new Set<() => void>();
  const customId = original.kind === "add" ? original.food.customId : original.entry.customId;
  let sources = read();
  // A deleted saved item keeps showing what was opened until the view returns.
  const opened = sources.item;
  let day = date;
  let fields: FoodLoggingFields = {
    grams:
      original.kind === "edit"
        ? nutritionAmountText(original.entry.grams ?? 100)
        : defaultAmount(opened?.food ?? original.food),
    drinkMl:
      original.kind === "edit" && original.entry.drinkMl !== undefined
        ? String(original.entry.drinkMl)
        : "",
    meal: original.kind === "edit" ? original.entry.meal : destination.get(),
    labelNutrition: { calories: "", carbs: "", protein: "", fat: "" },
  };
  let saving = false,
    failed = false,
    active = false,
    ticket = 0;
  let detach: (() => void) | undefined;
  let settle: (() => void) | undefined;
  let snapshot = build();

  function read(): Sources {
    return {
      item: savedItem(catalog, customId),
      ready: log.getSnapshot().state.kind === "ready",
      catalogBusy: catalog.getSnapshot().saving,
    };
  }
  function build(): FoodLoggingAttemptSnapshot {
    const item = sources.item ?? opened;
    const target: FoodSaveTarget =
      original.kind === "add" && item ? { kind: "add", food: item.food } : original;
    const preparation = prepareFoodLogging({
      target,
      date: day,
      fields,
      findFood: log.findFood,
      catalogItem: sources.item?.food,
    });
    const submittable =
      active && !saving && sources.ready && !sources.catalogBusy && preparation.status === "ready";
    return {
      target,
      fields,
      preparation,
      item,
      saving,
      failed,
      busy: saving || sources.catalogBusy,
      submittable,
    };
  }
  function publish() {
    snapshot = build();
    for (const listener of listeners) listener();
  }
  function change(next: Partial<FoodLoggingFields>) {
    fields = { ...fields, ...next };
    publish();
  }
  function follow() {
    if (settle && !log.getSnapshot().saving) {
      const resume = settle;
      settle = undefined;
      resume();
    }
    const next = read();
    const meal = original.kind === "add" ? destination.get() : fields.meal;
    if (
      next.item?.food === sources.item?.food &&
      next.ready === sources.ready &&
      next.catalogBusy === sources.catalogBusy &&
      meal === fields.meal
    )
      return;
    sources = next;
    if (meal !== fields.meal) fields = { ...fields, meal };
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
      const stops = [
        log.subscribe(follow),
        catalog.subscribe(follow),
        destination.subscribe(follow),
      ];
      detach = () => stops.forEach((stop) => stop());
      sources = read();
      if (original.kind === "add") fields = { ...fields, meal: destination.get() };
      publish();
    },
    close() {
      if (!active) return;
      active = false;
      ++ticket;
      saving = false;
      detach?.();
      detach = undefined;
      settle?.();
      settle = undefined;
      publish();
    },
    /** Follows the Selected day into the preview and its write. */
    setDate(date: string) {
      if (date === day) return;
      day = date;
      publish();
    },
    /** A saved catalog edit restarts the amount from the edited item's serving.
     * The edited item itself arrives with other live catalog changes.
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
    /** Adding moves the shared Meal destination; editing changes only this entry. */
    chooseMeal(meal: Meal) {
      if (original.kind === "add") destination.set(meal);
      if (fields.meal !== meal) change({ meal });
    },
    /** Resolves true only when the write succeeded while the attempt stayed open. */
    async submit(): Promise<boolean> {
      const { preparation } = snapshot;
      if (!snapshot.submittable || preparation.status !== "ready") return false;
      const own = ticket;
      saving = true;
      failed = false;
      publish();
      let saved = false;
      try {
        // A food-log refresh can't accept a write yet, so this save waits for it to settle.
        while (log.getSnapshot().saving) {
          await new Promise<void>((resume) => {
            settle = resume;
          });
          if (own !== ticket) return false;
        }
        // The day or the food may have changed while waiting, so write what is current now.
        const current = snapshot.preparation;
        if (current.status === "ready") {
          const { write } = current;
          saved = await (write.kind === "edit" ? log.edit(write.input) : log.add(write.input));
        }
      } catch {
        saved = false;
      }
      if (own !== ticket) return false;
      saving = false;
      failed = !saved;
      publish();
      return saved;
    },
  };
}
export type FoodLoggingAttempt = ReturnType<typeof createFoodLoggingAttempt>;

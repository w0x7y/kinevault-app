import type { Meal } from "../daily/model.ts";
import type { FoodImportSource } from "./import-metadata.ts";
import type { CatalogFood } from "./catalog.ts";
import { customFoodToDraft, type CustomFood, type CustomFoodDraft } from "./custom-model.ts";
import { mealToDraft, type CatalogKind, type CustomMeal, type MealDraft } from "./meal-model.ts";

const sessionIdentity = Symbol("catalog draft session");
export type CatalogDraftHandle = { readonly [sessionIdentity]: true };
export type CatalogDraftTarget =
  | { kind: "new-food" } | { kind: "new-meal" }
  | { kind: "edit-food"; item: CustomFood } | { kind: "edit-meal"; item: CustomMeal }
  | { kind: "import"; draft: CustomFoodDraft & { importSource: FoodImportSource }; volumeBased: boolean };
type Session = { handle: CatalogDraftHandle; mealIntent: Meal };
export type FoodDraftSession = Session & { kind: "food"; draft: CustomFoodDraft; existing?: CustomFood; volumeBased: boolean };
export type MealDraftSession = Session & { kind: "meal"; draft: MealDraft; existing?: CustomMeal };
export type CatalogDraftSession = FoodDraftSession | MealDraftSession;
export type CatalogDraftSummary = { key: number; handle: CatalogDraftHandle; name: string; kind: CatalogKind; imported: boolean };
export type CatalogDraftSnapshot = {
  mealIntent: Meal; creationKind: CatalogKind; session: CatalogDraftSession | null; resumable: CatalogDraftSummary[];
};
type FoodBasis = Pick<CustomFoodDraft, "calories" | "carbs" | "protein" | "fat" | "details">;
type Entry = { key: number; target: CatalogDraftTarget; session: CatalogDraftSession; retained: boolean; bases: Partial<Record<"food" | "drink", FoodBasis>> };

function copyFood<T extends CatalogFood>(food: T): T {
  return { ...food, per100g: food.per100g && { ...food.per100g }, details: food.details && { ...food.details },
    portions: food.portions.map(portion => ({ ...portion })), importSource: food.importSource && { ...food.importSource },
    beverage: food.beverage?.kind === "known-volume" ? { ...food.beverage, per100ml: { ...food.beverage.per100ml,
      details: food.beverage.per100ml.details && { ...food.beverage.per100ml.details } } } : food.beverage && { ...food.beverage } };
}
function copyFoodDraft<T extends CustomFoodDraft>(draft: T): T {
  return { ...draft, details: draft.details && { ...draft.details }, importSource: draft.importSource && { ...draft.importSource } };
}
function copyMealDraft(draft: MealDraft): MealDraft {
  return { ...draft, overrides: { ...draft.overrides }, detailOverrides: draft.detailOverrides && { ...draft.detailOverrides },
    ingredients: draft.ingredients.map(ingredient => ({ ...ingredient, food: copyFood(ingredient.food) })) };
}
function sameTarget(left: CatalogDraftTarget, right: CatalogDraftTarget): boolean {
  switch (left.kind) {
    case "new-food": case "new-meal": return left.kind === right.kind;
    case "edit-food": return right.kind === left.kind && left.item.customId === right.item.customId;
    case "edit-meal": return right.kind === left.kind && left.item.customId === right.item.customId;
    case "import": {
      const source = left.draft.importSource;
      const other = right.kind === "import" ? right.draft.importSource : undefined;
      return source !== undefined && other !== undefined && source.provider === other.provider && source.method === other.method && source.barcode === other.barcode;
    }
    default: { const exhaustive: never = left; return exhaustive; }
  }
}

/** Owns unfinished reusable-catalog input for one Food screen lifetime. */
export function createCatalogDrafts() {
  let entries: Entry[] = [];
  let sequence = 0;
  let snapshot: CatalogDraftSnapshot = { mealIntent: "breakfast", creationKind: "food", session: null, resumable: [] };
  const listeners = new Set<() => void>();
  function publish(session = snapshot.session) {
    snapshot = { ...snapshot, session, resumable: entries.filter(entry => entry.retained && entry.target.kind !== "new-food" && entry.target.kind !== "new-meal")
      .map(entry => ({ key: entry.key, handle: entry.session.handle, name: entry.session.draft.name || "Imported food", kind: entry.session.kind, imported: entry.target.kind === "import" })) };
    listeners.forEach(listener => listener());
  }
  function activate(entry: Entry) {
    snapshot = { ...snapshot, mealIntent: entry.session.mealIntent };
    publish(entry.session);
    return entry.session;
  }
  function open(target: CatalogDraftTarget): CatalogDraftSession {
    // An untouched editor has no retained input or destination to restore.
    const retained = entries.find(entry => entry.retained && sameTarget(entry.target, target));
    if (retained) return activate(retained);
    const handle: CatalogDraftHandle = { [sessionIdentity]: true };
    const base = { handle, mealIntent: snapshot.mealIntent };
    let session: CatalogDraftSession;
    switch (target.kind) {
      case "new-food": session = { ...base, kind: "food", volumeBased: false, draft: { name: "", servingGrams: "100", calories: "", carbs: "", protein: "", fat: "" } }; break;
      case "new-meal": session = { ...base, kind: "meal", draft: { name: "", ingredients: [], overrides: {} } }; break;
      case "import": session = { ...base, kind: "food", draft: copyFoodDraft(target.draft), volumeBased: target.volumeBased }; break;
      case "edit-food": session = { ...base, kind: "food", draft: copyFoodDraft(customFoodToDraft(target.item)), existing: copyFood(target.item), volumeBased: false }; break;
      case "edit-meal": session = { ...base, kind: "meal", draft: copyMealDraft(mealToDraft(target.item)), existing: { ...copyFood(target.item),
        overrides: { ...target.item.overrides }, detailOverrides: target.item.detailOverrides && { ...target.item.detailOverrides },
        ingredients: target.item.ingredients.map(ingredient => ({ ...ingredient, food: copyFood(ingredient.food) })) } }; break;
      default: { const exhaustive: never = target; return exhaustive; }
    }
    const entry: Entry = { key: ++sequence, target: target.kind === "import" ? { ...target, draft: copyFoodDraft(target.draft) } : target,
      session, retained: target.kind === "import", bases: {} };
    entries = [...entries.filter(previous => previous.retained && !sameTarget(previous.target, target)), entry];
    return activate(entry);
  }
  function update(entry: Entry, session: CatalogDraftSession) {
    entry.session = session;
    entry.retained = true;
    publish(snapshot.session?.handle === session.handle ? session : snapshot.session);
  }
  function retire(handle: CatalogDraftHandle) {
    if (!entries.some(entry => entry.session.handle === handle)) return false;
    entries = entries.filter(entry => entry.session.handle !== handle);
    publish(snapshot.session?.handle === handle ? null : snapshot.session);
    return true;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    // Changing the logging destination never rewrites paused drafts.
    setMealIntent(mealIntent: Meal) { if (snapshot.mealIntent !== mealIntent) { snapshot = { ...snapshot, mealIntent }; publish(); } },
    setCreationKind(creationKind: CatalogKind) { snapshot = { ...snapshot, creationKind }; return open({ kind: creationKind === "food" ? "new-food" : "new-meal" }); },
    openCreation: () => open({ kind: snapshot.creationKind === "food" ? "new-food" : "new-meal" }),
    open,
    resume(handle: CatalogDraftHandle) { const entry = entries.find(entry => entry.session.handle === handle); return entry ? activate(entry) : null; },
    changeFood(handle: CatalogDraftHandle, draft: Omit<CustomFoodDraft, "drink" | "importSource">) {
      const entry = entries.find(entry => entry.session.handle === handle);
      if (!entry || entry.session.kind !== "food") return;
      update(entry, { ...entry.session, draft: copyFoodDraft({ ...draft, drink: entry.session.draft.drink, importSource: entry.session.draft.importSource }) });
    },
    changeMeal(handle: CatalogDraftHandle, draft: MealDraft) {
      const entry = entries.find(entry => entry.session.handle === handle);
      if (entry?.session.kind === "meal") update(entry, { ...entry.session, draft: copyMealDraft(draft) });
    },
    setFoodKind(handle: CatalogDraftHandle, drink: boolean) {
      const entry = entries.find(entry => entry.session.handle === handle);
      if (!entry || entry.session.kind !== "food") return;
      if (Boolean(entry.session.draft.drink) === drink) return entry.session;
      const { calories, carbs, protein, fat, details } = entry.session.draft;
      entry.bases[entry.session.draft.drink ? "drink" : "food"] = { calories, carbs, protein, fat, details: details && { ...details } };
      // No density is inferred. A newly selected label basis starts blank.
      const basis = entry.bases[drink ? "drink" : "food"] ?? { calories: "", carbs: "", protein: "", fat: "", details: {} };
      const session: FoodDraftSession = { ...entry.session, draft: copyFoodDraft({ ...entry.session.draft, drink, ...basis }) };
      update(entry, session);
      return session;
    },
    discard: retire,
    retire,
    retireDeletedItem(item: CustomFood | CustomMeal) {
      const target: CatalogDraftTarget = "ingredients" in item ? { kind: "edit-meal", item } : { kind: "edit-food", item };
      const entry = entries.find(entry => sameTarget(entry.target, target));
      return entry ? retire(entry.session.handle) : false;
    },
  };
}
export type CatalogDrafts = ReturnType<typeof createCatalogDrafts>;

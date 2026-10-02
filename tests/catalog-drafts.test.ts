import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogDrafts } from "../src/food/catalog-drafts.ts";
import type { CustomFood, CustomFoodDraft } from "../src/food/custom-model.ts";
import type { CustomMeal } from "../src/food/meal-model.ts";

const oats: CustomFood = { customId: "oats", name: "Oats", category: "Custom food", per100g: { calories: 200, carbs: 30, protein: 10, fat: 4 }, portions: [{ label: "1 serving", grams: 100 }] };
const bowl: CustomMeal = { ...oats, customId: "bowl", name: "Bowl", category: "Custom meal", per100g: { calories: 200, carbs: 30, protein: 10, fat: 4 }, ingredients: [{ id: "oats", food: oats, grams: 100 }], overrides: {} };
const imported = { name: "Cereal", brand: "Example", servingGrams: "100", calories: "200", carbs: "30", protein: "10", fat: "4", details: { sodium: "0" }, importSource: { provider: "open-food-facts", method: "barcode", barcode: "12345678" } } satisfies CustomFoodDraft;

test("Snacks import retains edits and metadata independently of Lunch creation", () => {
  const owner = createCatalogDrafts();
  owner.setMealIntent("snacks");
  const first = owner.open({ kind: "import", draft: imported, volumeBased: true });
  assert.equal(first.kind, "food");
  if (first.kind !== "food") return;
  owner.changeFood(first.handle, { ...first.draft, carbs: "42", brand: "Reviewed brand" });
  owner.setMealIntent("lunch");
  const lunch = owner.openCreation();
  assert.equal(lunch.mealIntent, "lunch");
  const resumed = owner.open({ kind: "import", draft: { ...imported, carbs: "99" }, volumeBased: false });
  assert.equal(resumed.kind, "food");
  if (resumed.kind !== "food") return;
  assert.equal(resumed.draft.carbs, "42");
  assert.equal(resumed.draft.brand, "Reviewed brand");
  assert.deepEqual(resumed.draft.importSource, imported.importSource);
  assert.equal(resumed.volumeBased, true);
  assert.equal(resumed.mealIntent, "snacks");
  assert.equal(owner.getSnapshot().mealIntent, "snacks");
  assert.equal(owner.resume(lunch.handle)?.mealIntent, "lunch");
});

test("creation kinds retain independent fields and destinations and retire independently", () => {
  const owner = createCatalogDrafts();
  owner.setMealIntent("lunch");
  const food = owner.openCreation();
  assert.equal(food.kind, "food");
  if (food.kind !== "food") return;
  owner.changeFood(food.handle, { ...food.draft, name: "Lunch oats" });
  owner.setMealIntent("dinner");
  owner.setCreationKind("meal");
  const meal = owner.getSnapshot().session;
  assert.equal(meal?.kind, "meal");
  if (meal?.kind !== "meal") return;
  owner.changeMeal(meal.handle, { ...meal.draft, name: "Dinner bowl" });
  owner.setCreationKind("food");
  assert.equal(owner.getSnapshot().session?.draft.name, "Lunch oats");
  assert.equal(owner.getSnapshot().mealIntent, "lunch");
  assert.equal(owner.retire(food.handle), true);
  owner.setCreationKind("meal");
  assert.equal(owner.getSnapshot().session?.draft.name, "Dinner bowl");
  assert.equal(owner.getSnapshot().mealIntent, "dinner");
  owner.setCreationKind("food");
  assert.equal(owner.getSnapshot().session?.draft.name, "");
});

test("Dinner editor resumes after changing views and untouched editors do not advertise drafts", () => {
  const owner = createCatalogDrafts();
  owner.setMealIntent("dinner");
  const first = owner.open({ kind: "edit-food", item: oats });
  assert.equal(owner.getSnapshot().resumable.length, 0);
  assert.equal(first.kind, "food");
  if (first.kind !== "food") return;
  owner.changeFood(first.handle, { ...first.draft, name: "" });
  assert.equal(owner.getSnapshot().resumable.length, 1);
  owner.setMealIntent("snacks");
  owner.openCreation();
  const resumed = owner.open({ kind: "edit-food", item: oats });
  assert.equal(resumed.draft.name, "");
  assert.equal(resumed.mealIntent, "dinner");
  assert.equal(owner.getSnapshot().mealIntent, "dinner");
});

test("solid and drink bases survive pause and resume without treating grams as ml", () => {
  const owner = createCatalogDrafts();
  const food = owner.open({ kind: "import", draft: imported, volumeBased: true });
  assert.equal(food.kind, "food");
  if (food.kind !== "food") return;
  owner.changeFood(food.handle, { ...food.draft, servingGrams: "75", calories: "80", details: { sodium: "12" } });
  owner.setFoodKind(food.handle, true);
  let session = owner.getSnapshot().session;
  assert.equal(session?.kind, "food");
  if (session?.kind !== "food") return;
  assert.equal(session.draft.calories, "");
  assert.deepEqual(session.draft.details, {});
  owner.changeFood(food.handle, { ...session.draft, calories: "40", carbs: "10", details: { sodium: "0" } });
  owner.openCreation();
  owner.resume(food.handle);
  owner.setFoodKind(food.handle, false);
  session = owner.getSnapshot().session;
  assert.equal(session?.kind, "food");
  if (session?.kind !== "food") return;
  assert.equal(session.draft.servingGrams, "75");
  assert.equal(session.draft.calories, "80");
  assert.deepEqual(session.draft.details, { sodium: "12" });
  owner.openCreation();
  owner.resume(food.handle);
  owner.setFoodKind(food.handle, true);
  session = owner.getSnapshot().session;
  assert.equal(session?.kind, "food");
  if (session?.kind !== "food") return;
  assert.equal(session.draft.calories, "40");
  assert.deepEqual(session.draft.details, { sodium: "0" });
});

test("discard and delayed save retirement only affect the matching session", () => {
  const owner = createCatalogDrafts();
  const old = owner.openCreation();
  assert.equal(owner.discard(old.handle), true);
  const replacement = owner.openCreation();
  assert.notEqual(old.handle, replacement.handle);
  assert.equal(owner.retire(old.handle), false);
  assert.equal(owner.resume(replacement.handle)?.handle, replacement.handle);
  assert.equal(owner.retire(replacement.handle), true);
  assert.equal(owner.resume(replacement.handle), null);
});

test("deletion retires only the matching kind and item while unsaved input survives without retirement", () => {
  const owner = createCatalogDrafts();
  const food = owner.open({ kind: "edit-food", item: oats });
  assert.equal(food.kind, "food");
  if (food.kind !== "food") return;
  owner.changeFood(food.handle, { ...food.draft, name: "Edited oats" });
  const meal = owner.open({ kind: "edit-meal", item: { ...bowl, customId: oats.customId } });
  assert.equal(meal.kind, "meal");
  if (meal.kind !== "meal") return;
  owner.changeMeal(meal.handle, { ...meal.draft, name: "Failed save input" });
  assert.equal(owner.resume(food.handle)?.handle, food.handle);
  assert.equal(owner.resume(meal.handle)?.handle, meal.handle);
  assert.equal(owner.resume(meal.handle)?.draft.name, "Failed save input");
  assert.equal(owner.retireDeletedItem(oats), true);
  assert.equal(owner.resume(food.handle), null);
  assert.equal(owner.resume(meal.handle)?.draft.name, "Failed save input");
});

test("manual and provider barcodes have separate identities; draft copies isolate saved ingredients", () => {
  const owner = createCatalogDrafts();
  const provider = owner.open({ kind: "import", draft: imported, volumeBased: true });
  const manual = owner.open({ kind: "import", draft: { ...imported, importSource: { provider: "manual", method: "barcode", barcode: "12345678" } }, volumeBased: false });
  assert.notEqual(provider.handle, manual.handle);
  const importedByOtherMethod = owner.open({ kind: "import", draft: { ...imported, importSource: { ...imported.importSource, method: "import" } }, volumeBased: true });
  assert.notEqual(provider.handle, importedByOtherMethod.handle);
  const editor = owner.open({ kind: "edit-meal", item: bowl });
  assert.equal(editor.kind, "meal");
  if (editor.kind !== "meal") return;
  editor.draft.ingredients[0].food.name = "Edited ingredient snapshot";
  assert.equal(bowl.ingredients[0].food.name, "Oats");
  const incoming = { ...editor.draft, ingredients: [{ id: "oats", food: { ...oats }, amount: "75" }] };
  owner.changeMeal(editor.handle, incoming);
  incoming.ingredients[0].food.name = "Mutation after handoff";
  const session = owner.resume(editor.handle);
  assert.equal(session?.kind, "meal");
  if (session?.kind !== "meal") return;
  assert.equal(session.draft.ingredients[0].food.name, "Oats");
  session.draft.ingredients[0].food.name = "Editable mutation";
  assert.equal(bowl.ingredients[0].food.name, "Oats");
});

test("snapshots are stable between notifications and unsubscribe stops publication", () => {
  const owner = createCatalogDrafts();
  const first = owner.getSnapshot();
  assert.equal(owner.getSnapshot(), first);
  let updates = 0;
  const unsubscribe = owner.subscribe(() => updates++);
  owner.openCreation();
  assert.notEqual(owner.getSnapshot(), first);
  assert.equal(updates, 1);
  unsubscribe();
  owner.setMealIntent("dinner");
  assert.equal(updates, 1);
});

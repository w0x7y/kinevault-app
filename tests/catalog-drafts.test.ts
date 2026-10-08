import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogDrafts } from "../src/food/catalog-drafts.ts";
import type { CustomFood, CustomFoodDraft } from "../src/food/custom-model.ts";
import type { CustomMeal } from "../src/food/meal-model.ts";
import { createCustomFoodPersistence } from "../src/food/custom-persistence.ts";

const oats: CustomFood = {
  customId: "oats",
  name: "Oats",
  category: "Custom food",
  per100g: { calories: 200, carbs: 30, protein: 10, fat: 4 },
  portions: [{ label: "1 serving", grams: 100 }],
};
const bowl: CustomMeal = {
  ...oats,
  customId: "bowl",
  name: "Bowl",
  category: "Custom meal",
  per100g: { calories: 200, carbs: 30, protein: 10, fat: 4 },
  ingredients: [{ id: "oats", food: oats, grams: 100 }],
  overrides: {},
};
const imported = {
  name: "Cereal",
  brand: "Example",
  servingGrams: "100",
  calories: "200",
  carbs: "30",
  protein: "10",
  fat: "4",
  details: { sodium: "0" },
  importSource: { provider: "open-food-facts", method: "barcode", barcode: "12345678" },
} satisfies CustomFoodDraft;

async function savingFixture(raw: string | null = null) {
  let release: ((failed: boolean) => void) | undefined;
  let writes = 0;
  const store = createCustomFoodPersistence({
    storage: {
      getItem: async () => raw,
      removeItem: async () => {},
      setItem: async () => {
        writes++;
        await new Promise<void>((resolve, reject) => {
          release = (failed) => (failed ? reject(new Error("Unavailable")) : resolve());
        });
      },
    },
    createId: () => "saved-food",
  });
  store.start();
  await new Promise((resolve) => setImmediate(resolve));
  const owner = createCatalogDrafts();
  const session = owner.open({
    kind: "import",
    draft: { ...imported, importSource: { ...imported.importSource, barcode: "3017620422003" } },
    volumeBased: false,
  });
  const catalog = () => ({ ...store, ...store.getSnapshot() });
  return {
    owner,
    session,
    catalog,
    writes: () => writes,
    release: (failed = false) => release!(failed),
  };
}

test("catalog save reserves its attempt before subscribers reenter and retires after durable success", async () => {
  const f = await savingFixture();
  let duplicate: Promise<unknown> | undefined;
  f.owner.subscribe(() => {
    duplicate ??= f.owner.save(f.session.handle, f.catalog());
  });
  const saved = f.owner.save(f.session.handle, f.catalog());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.writes(), 1);
  assert.equal(await duplicate, null);
  assert.equal(f.owner.resume(f.session.handle)?.saving, true);
  f.release();
  assert.equal((await saved)?.name, "Cereal");
  assert.equal(f.owner.resume(f.session.handle), null);
});

test("a delayed catalog save cannot retire or return into a replacement editor", async () => {
  const f = await savingFixture();
  const saved = f.owner.save(f.session.handle, f.catalog());
  await new Promise((resolve) => setImmediate(resolve));
  f.owner.discard(f.session.handle);
  const replacement = f.owner.openCreation();
  f.release();
  assert.equal(await saved, null);
  assert.equal(f.owner.getSnapshot().session?.handle, replacement.handle);
});

test("entered catalog fields during a save survive its completion", async () => {
  const f = await savingFixture();
  const saved = f.owner.save(f.session.handle, f.catalog());
  await new Promise((resolve) => setImmediate(resolve));
  f.owner.changeFood(f.session.handle, { ...imported, name: "Later fields" });
  f.release();
  assert.equal(await saved, null);
  assert.equal(f.owner.getSnapshot().session?.draft.name, "Later fields");
  assert.equal(f.owner.getSnapshot().session?.saving, false);
});

test("catalog validation belongs to the retained draft and corrects after an attempted save", async () => {
  const f = await savingFixture();
  f.owner.changeFood(f.session.handle, { ...imported, name: "" });
  assert.equal(await f.owner.save(f.session.handle, f.catalog()), null);
  const invalid = f.owner.getSnapshot().session;
  assert.equal(invalid?.kind, "food");
  if (invalid?.kind !== "food") return;
  assert.ok(invalid.errors.name);
  assert.equal(f.writes(), 0);
  f.owner.openCreation();
  f.owner.resume(f.session.handle);
  f.owner.changeFood(f.session.handle, imported);
  const corrected = f.owner.getSnapshot().session;
  assert.equal(corrected?.kind, "food");
  if (corrected?.kind === "food") assert.deepEqual(corrected.errors, {});
});

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
  const resumed = owner.open({
    kind: "import",
    draft: { ...imported, carbs: "99" },
    volumeBased: false,
  });
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

test("creation kinds retain independent fields and destinations and discard independently", () => {
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
  assert.equal(owner.discard(food.handle), true);
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
  owner.changeFood(food.handle, {
    ...food.draft,
    servingGrams: "75",
    calories: "80",
    details: { sodium: "12" },
  });
  owner.setFoodKind(food.handle, true);
  let session = owner.getSnapshot().session;
  assert.equal(session?.kind, "food");
  if (session?.kind !== "food") return;
  assert.equal(session.draft.calories, "");
  assert.deepEqual(session.draft.details, {});
  owner.changeFood(food.handle, {
    ...session.draft,
    calories: "40",
    carbs: "10",
    details: { sodium: "0" },
  });
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

test("discard only affects the matching session", () => {
  const owner = createCatalogDrafts();
  const old = owner.openCreation();
  assert.equal(owner.discard(old.handle), true);
  const replacement = owner.openCreation();
  assert.notEqual(old.handle, replacement.handle);
  assert.equal(owner.discard(old.handle), false);
  assert.equal(owner.resume(replacement.handle)?.handle, replacement.handle);
  assert.equal(owner.discard(replacement.handle), true);
  assert.equal(owner.resume(replacement.handle), null);
});

test("manual and provider barcodes have separate identities; draft copies isolate saved ingredients", () => {
  const owner = createCatalogDrafts();
  const provider = owner.open({ kind: "import", draft: imported, volumeBased: true });
  const manual = owner.open({
    kind: "import",
    draft: {
      ...imported,
      importSource: { provider: "manual", method: "barcode", barcode: "12345678" },
    },
    volumeBased: false,
  });
  assert.notEqual(provider.handle, manual.handle);
  const importedByOtherMethod = owner.open({
    kind: "import",
    draft: { ...imported, importSource: { ...imported.importSource, method: "import" } },
    volumeBased: true,
  });
  assert.notEqual(provider.handle, importedByOtherMethod.handle);
  const editor = owner.open({ kind: "edit-meal", item: bowl });
  assert.equal(editor.kind, "meal");
  if (editor.kind !== "meal") return;
  editor.draft.ingredients[0].food.name = "Edited ingredient snapshot";
  assert.equal(bowl.ingredients[0].food.name, "Oats");
  const incoming = {
    ...editor.draft,
    ingredients: [{ id: "oats", food: { ...oats }, amount: "75" }],
  };
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

test("failed catalog writes retain fields and destination and save retry retires them", async () => {
  const f = await savingFixture();
  const saved = f.owner.save(f.session.handle, f.catalog());
  await new Promise((resolve) => setImmediate(resolve));
  f.release(true);
  assert.equal(await saved, null);
  assert.equal(f.owner.getSnapshot().session?.error, f.catalog().error);
  assert.equal(f.owner.getSnapshot().session?.draft.name, "Cereal");
  const retry = f.owner.save(f.session.handle, f.catalog());
  assert.equal(f.owner.getSnapshot().session?.error, null);
  await new Promise((resolve) => setImmediate(resolve));
  f.release();
  assert.ok(await retry);
  assert.equal(f.owner.resume(f.session.handle), null);
});

test("successful deletion retires its catalog edit after durability and preserves other drafts", async () => {
  const f = await savingFixture(JSON.stringify({ version: 1, foods: [oats], meals: [bowl] }));
  const food = f.owner.open({ kind: "edit-food", item: oats });
  assert.equal(food.kind, "food");
  if (food.kind !== "food") return;
  f.owner.changeFood(food.handle, { ...food.draft, name: "Retained edit" });
  const meal = f.owner.open({ kind: "edit-meal", item: bowl });
  if (meal.kind === "meal") f.owner.changeMeal(meal.handle, { ...meal.draft, name: "Other draft" });
  const removing = f.owner.removeSaved(oats, f.catalog());
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(f.owner.resume(food.handle));
  f.release(true);
  assert.equal(await removing, false);
  assert.equal(f.owner.resume(food.handle)?.draft.name, "Retained edit");
  const retry = f.owner.removeSaved(oats, f.catalog());
  await new Promise((resolve) => setImmediate(resolve));
  f.release();
  assert.equal(await retry, true);
  assert.equal(f.owner.resume(food.handle), null);
  assert.ok(f.owner.resume(meal.handle));
});

test("catalog meal edits save through the same owner without duplicating the saved item", async () => {
  const f = await savingFixture(JSON.stringify({ version: 1, foods: [oats], meals: [bowl] }));
  const meal = f.owner.open({ kind: "edit-meal", item: bowl });
  if (meal.kind !== "meal") return;
  f.owner.changeMeal(meal.handle, { ...meal.draft, name: "Changed bowl" });
  const saved = f.owner.save(meal.handle, f.catalog());
  await new Promise((resolve) => setImmediate(resolve));
  f.release();
  assert.equal((await saved)?.customId, bowl.customId);
  const state = f.catalog().state;
  assert.equal(state.kind, "ready");
  if (state.kind === "ready") {
    assert.equal(state.document.meals.length, 1);
    assert.equal(state.document.meals[0].name, "Changed bowl");
  }
  assert.equal(f.owner.resume(meal.handle), null);
});

test("catalog save delivers the completion before retirement subscribers detach the form", async () => {
  const f = await savingFixture();
  let mounted = true;
  let delivered = false;
  f.owner.subscribe(() => {
    if (f.owner.getSnapshot().session === null) mounted = false;
  });
  const saved = f.owner.save(f.session.handle, f.catalog(), (item) => {
    assert.equal(f.owner.getSnapshot().session, null);
    assert.equal(item.name, "Cereal");
    if (mounted) delivered = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  f.release();
  assert.ok(await saved);
  assert.equal(mounted, false);
  assert.equal(delivered, true);
});

test("a retained catalog save error survives an unrelated failed deletion", async () => {
  const f = await savingFixture(JSON.stringify({ version: 1, foods: [oats], meals: [bowl] }));
  const saved = f.owner.save(f.session.handle, f.catalog());
  await new Promise((resolve) => setImmediate(resolve));
  f.release(true);
  assert.equal(await saved, null);
  const saveError = f.catalog().error;
  assert.ok(saveError);
  assert.equal(f.owner.getSnapshot().session?.error, saveError);
  f.owner.openCreation();
  const removed = f.owner.removeSaved(oats, f.catalog());
  await new Promise((resolve) => setImmediate(resolve));
  f.release(true);
  assert.equal(await removed, false);
  assert.notEqual(f.catalog().error, saveError);
  assert.equal(f.owner.resume(f.session.handle)?.error, saveError);
});

test("catalog save checks current persistence availability instead of captured context fields", async () => {
  const f = await savingFixture(JSON.stringify({ version: 1, foods: [oats], meals: [bowl] }));
  const captured = f.catalog();
  const deleting = captured.remove(oats.customId);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(captured.saving, false);
  assert.equal(captured.getSnapshot().saving, true);
  assert.equal(await f.owner.save(f.session.handle, captured), null);
  assert.equal(f.owner.getSnapshot().session?.attempted, false);
  assert.equal(f.writes(), 1);
  f.release();
  assert.equal(await deleting, true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { calculateMeal, mealFromDraft, type MealDraft } from "../src/food/meal-model.ts";
import { parseCustomFoods } from "../src/food/custom-model.ts";
import { createCustomFoodPersistence, customFoodStorageKey } from "../src/food/custom-persistence.ts";
import { createFoodCatalog, nutritionForGrams, type CatalogFood, type Nutrition } from "../src/food/catalog.ts";
import { entryForFood, nutritionForEntry, parseFoodLog } from "../src/food/log-model.ts";
import { unknownNutrients } from "../src/food/nutrients.ts";

const oats: CatalogFood = { fdcId: 1, name: "Oats", category: "Grains", portions: [],
  per100g: { calories: 400, carbs: 60, protein: 20, fat: 8 }, details: { ...unknownNutrients, fiber: 10, sodium: 2 } };
const yogurt: CatalogFood = { customId: "yogurt", name: "Yogurt", category: "Custom food", portions: [{ label: "1 serving", grams: 100 }],
  per100g: { calories: 100, carbs: 5, protein: 10, fat: 4 }, details: { ...unknownNutrients, fiber: 0, sodium: 20 } };
const draft: MealDraft = { name: " Oat breakfast ", overrides: {}, ingredients: [
  { id: "oats", food: oats, amount: "50" }, { id: "yogurt", food: yogurt, amount: "200" },
] };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function nearNutrition(actual: Nutrition, expected: Nutrition) {
  for (const key of ["calories", "carbs", "protein", "fat"] as const)
    assert.ok(Math.abs(actual[key] - expected[key]) < 1e-9, `${key}: ${actual[key]} should be ${expected[key]}`);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
async function ready(initial: string | null = null) {
  let raw = initial;
  const storage = {
    async getItem(key: string) { assert.equal(key, customFoodStorageKey); return raw; },
    async setItem(key: string, value: string) { assert.equal(key, customFoodStorageKey); raw = value; },
  };
  let id = 0;
  const store = createCustomFoodPersistence({ storage, createId: () => `meal-${++id}` });
  store.start(); await flush();
  return { store, storage, raw: () => raw };
}

test("meal nutrition sums ingredient quantities and retains the full collection for reuse", () => {
  const result = mealFromDraft(draft, "meal-one");
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected a valid meal");
  const meal = result.meal;
  assert.equal(meal.name, "Oat breakfast");
  assert.equal(meal.category, "Custom meal");
  assert.equal(meal.ingredients.length, 2);
  assert.deepEqual(meal.portions, [{ label: "1 meal", grams: 250 }]);
  nearNutrition(meal.per100g, { calories: 160, carbs: 16, protein: 12, fat: 4.8 });
  const totals = calculateMeal(meal.ingredients);
  assert.equal(totals.grams, 250);
  assert.deepEqual({ ...totals.nutrition, details: undefined }, { calories: 400, carbs: 40, protein: 30, fat: 12, details: undefined });
  assert.equal(totals.nutrition.details.fiber, 5);
  assert.equal(totals.nutrition.details.sodium, 41);
  assert.equal(totals.nutrition.details.iron, null);
  assert.equal(nutritionForGrams(meal, 125).calories, 200);
  assert.equal(nutritionForGrams(meal, 125).details?.fiber, 2.5);
});

test("meal overrides accept explicit zero, preserve other calculated macros and reset to ingredient totals", () => {
  const result = mealFromDraft({ ...draft, overrides: { protein: "35,5", fat: "0", calories: "420" } }, "meal-one");
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected overrides");
  assert.deepEqual(result.meal.overrides, { calories: 420, protein: 35.5, fat: 0 });
  nearNutrition(result.meal.per100g, { calories: 168, carbs: 16, protein: 14.2, fat: 0 });
  const changed = mealFromDraft({ ...draft, ingredients: [draft.ingredients[0]], overrides: { protein: "35" } }, "meal-one");
  assert.equal(changed.ok, true);
  if (changed.ok) {
    assert.equal(nutritionForGrams(changed.meal, 50).protein, 35);
    assert.equal(nutritionForGrams(changed.meal, 50).carbs, 30);
  }
  const reset = mealFromDraft(draft, "meal-one");
  if (reset.ok) assert.equal(nutritionForGrams(reset.meal, 250).protein, 30);
});

test("invalid and empty meals cannot be saved or normalized", () => {
  for (const patch of [
    { name: " " }, { ingredients: [] }, { ingredients: [{ ...draft.ingredients[0], amount: "0" }] },
    { ingredients: [{ ...draft.ingredients[0], amount: "1e3" }] },
    { ingredients: draft.ingredients.map(ingredient => ({ ...ingredient, amount: "6000" })) },
    { overrides: { protein: "" } }, { overrides: { carbs: "-1" } }, { overrides: { fat: "Infinity" } },
  ]) assert.equal(mealFromDraft({ ...draft, ...patch }, "meal-one").ok, false);
});

test("saved meals round trip with ingredient snapshots, reject corrupt ingredients and leave old foods readable", async () => {
  const { store, raw } = await ready();
  const meal = await store.addMeal(draft);
  assert.ok(meal);
  const saved = parseCustomFoods(raw());
  assert.equal(saved.meals.length, 1);
  assert.deepEqual(saved.meals[0], meal);
  assert.deepEqual((await ready(raw())).store.getSnapshot().state, store.getSnapshot().state);
  assert.equal(createFoodCatalog(saved.meals).search("oat breakfast").items[0]?.customId, meal.customId);
  assert.deepEqual(parseCustomFoods(JSON.stringify({ version: 1, foods: [yogurt] })), { version: 1, foods: [yogurt], meals: [] });
  for (const patch of [
    { ingredients: [] }, { overrides: { protein: -1 } },
    { ingredients: [{ ...meal.ingredients[0], grams: 0 }] },
    { ingredients: [{ ...meal.ingredients[0], food: { ...oats, per100g: { ...oats.per100g, calories: -1 } } }] },
    { ingredients: [{ ...meal.ingredients[0], food: { ...oats, details: { ...oats.details, fiber: "bad" } } }] },
  ]) assert.throws(() => parseCustomFoods(JSON.stringify({ ...saved, meals: [{ ...meal, ...patch }] })));
});

test("meal logging and editing scale the overridden snapshot without adding each ingredient twice", () => {
  const result = mealFromDraft({ ...draft, overrides: { protein: "35" } }, "meal-one");
  if (!result.ok) throw new Error("Expected a valid meal");
  const entry = entryForFood({ id: "entry", food: result.meal, grams: 250, meal: "breakfast" });
  assert.equal(entry.calories, 400);
  assert.equal(entry.protein, 35);
  assert.equal(nutritionForEntry(entry, 125).protein, 17.5);
  const saved = parseFoodLog(JSON.stringify({ version: 1, days: { "2026-10-01": [entry] } }));
  assert.equal(saved.days["2026-10-01"].length, 1);
  assert.ok(Math.abs((saved.days["2026-10-01"][0].details?.sodium ?? Infinity) - 41) < 1e-9);
});

test("small decimal ingredient weights and overrides survive durable saving and reload", async () => {
  const { store, raw } = await ready();
  for (const patch of [
    { ingredients: [{ ...draft.ingredients[0], amount: "0.0000001" }] },
    { overrides: { fat: "0.0000001" } },
  ]) {
    const meal = await store.addMeal({ ...draft, ...patch });
    assert.ok(meal, "valid decimal values must save");
    assert.deepEqual(parseCustomFoods(raw()).meals.at(-1), meal);
  }
  assert.deepEqual((await ready(raw())).store.getSnapshot().state, store.getSnapshot().state);
});

test("meal saves share the durable write lock with foods and keep existing records on failure", async () => {
  const { store, storage, raw } = await ready();
  await store.add({ name: "Yogurt", servingGrams: "100", calories: "100", carbs: "5", protein: "10", fat: "4" });
  const before = raw();
  const write = storage.setItem;
  storage.setItem = async () => { throw new Error("disk full"); };
  assert.equal(await store.addMeal(draft), null);
  assert.equal(raw(), before);
  assert.equal(store.getSnapshot().error, "Couldn't save your meal. Your ingredients and values are still here. Try again.");
  const gate = deferred<void>();
  storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const pending = store.addMeal(draft);
  assert.equal(store.getSnapshot().saving, true);
  assert.equal(parseCustomFoods(raw()).meals.length, 0);
  assert.equal(await store.addMeal(draft), null);
  assert.equal(await store.add({ name: "Duplicate", servingGrams: "100", calories: "0", carbs: "0", protein: "0", fat: "0" }), null);
  gate.resolve();
  assert.ok(await pending);
  assert.equal(parseCustomFoods(raw()).foods.length, 1);
  assert.equal(parseCustomFoods(raw()).meals.length, 1);
});

test("invalid meal drafts and failed meal updates retain their distinct feedback", async () => {
  const { store, storage, raw } = await ready();
  assert.equal(await store.addMeal({ ...draft, ingredients: [] }), null);
  assert.equal(store.getSnapshot().error, "Check the name, amounts, and nutrition values.");
  assert.equal(raw(), null);
  const meal = await store.addMeal(draft);
  assert.ok(meal);
  const saved = raw();
  storage.setItem = async () => { throw new Error("disk full"); };
  assert.equal(await store.updateMeal(meal.customId, { ...draft, name: "Edited breakfast" }), null);
  assert.equal(store.getSnapshot().error, "Couldn't update your meal. Your changes are still here. Try again.");
  assert.equal(raw(), saved);
});

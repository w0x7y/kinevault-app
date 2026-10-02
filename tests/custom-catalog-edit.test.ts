import assert from "node:assert/strict";
import test from "node:test";
import { createCustomFoodPersistence, customFoodStorageKey } from "../src/food/custom-persistence.ts";
import { customFoodToDraft, parseCustomFoods, type CustomFoodDraft } from "../src/food/custom-model.ts";
import { mealToDraft, mealFromDraft } from "../src/food/meal-model.ts";
import { entryForFood, nutritionForEntry } from "../src/food/log-model.ts";

const foodDraft: CustomFoodDraft = { name: "My oats", servingGrams: "100", calories: "400", carbs: "60", protein: "20", fat: "8" };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
async function ready(initial: string | null = null) {
  let raw = initial;
  const storage = {
    async getItem() { return raw; },
    async setItem(key: string, value: string) { assert.equal(key, customFoodStorageKey); raw = value; },
  };
  let sequence = 0;
  const store = createCustomFoodPersistence({ storage, createId: () => `custom-${++sequence}` });
  store.start(); await flush();
  return { store, storage, raw: () => raw };
}

test("editing a food replaces its catalog record and preserves saved meal ingredients and log snapshots", async () => {
  const { store, raw } = await ready();
  const food = await store.add(foodDraft);
  assert.ok(food);
  const meal = await store.addMeal({ name: "Oat bowl", ingredients: [{ id: "oats", food, amount: "50" }], overrides: {} });
  assert.ok(meal);
  const entry = entryForFood({ id: "logged", food, grams: 50, meal: "breakfast" });
  const edited = await store.updateFood(food.customId, { ...foodDraft, name: "Revised oats", servingGrams: "200", calories: "500" });
  assert.ok(edited);
  assert.equal(edited.customId, food.customId);
  const saved = parseCustomFoods(raw());
  assert.equal(saved.foods.length, 1);
  assert.equal(saved.foods[0].name, "Revised oats");
  assert.equal(saved.foods[0].per100g?.calories, 250);
  assert.deepEqual(saved.meals[0], meal);
  assert.equal(entry.calories, 200);
  assert.equal(nutritionForEntry(entry, 25).calories, 100);
  assert.deepEqual((await ready(raw())).store.getSnapshot().state, store.getSnapshot().state);
});

test("editing a meal replaces ingredients and overrides without creating a duplicate", async () => {
  const { store, raw } = await ready();
  const food = await store.add(foodDraft);
  assert.ok(food);
  const draft = { name: "Oat bowl", ingredients: [{ id: "oats", food, amount: "50" }], overrides: { protein: "15" } };
  const meal = await store.addMeal(draft);
  assert.ok(meal);
  const entry = entryForFood({ id: "logged-meal", food: meal, grams: 50, meal: "lunch" });
  const updated = await store.updateMeal(meal.customId, { ...draft, name: "Large bowl", ingredients: [{ ...draft.ingredients[0], amount: "100" }], overrides: { protein: "30", fat: "0" } });
  assert.ok(updated);
  const saved = parseCustomFoods(raw());
  assert.equal(saved.meals.length, 1);
  assert.equal(saved.meals[0].customId, meal.customId);
  assert.equal(saved.meals[0].portions[0].grams, 100);
  assert.equal(saved.meals[0].per100g.protein, 30);
  assert.equal(saved.meals[0].per100g.fat, 0);
  assert.equal(saved.foods.length, 1);
  assert.equal(entry.calories, 200);
  assert.equal(entry.protein, 15);
});

test("deleting foods and meals removes only the selected catalog item and preserves meal snapshots", async () => {
  const { store, raw } = await ready();
  const food = await store.add(foodDraft);
  assert.ok(food);
  const meal = await store.addMeal({ name: "Oat bowl", ingredients: [{ id: "oats", food, amount: "50" }], overrides: {} });
  assert.ok(meal);
  assert.equal(await store.remove(food.customId), true);
  assert.equal(parseCustomFoods(raw()).foods.length, 0);
  assert.deepEqual(parseCustomFoods(raw()).meals[0], meal);
  const updated = await store.updateMeal(meal.customId, { name: "Still usable", ingredients: [{ id: "oats", food: meal.ingredients[0].food, amount: "100" }], overrides: {} });
  assert.ok(updated);
  assert.equal(await store.remove(meal.customId), true);
  assert.deepEqual(parseCustomFoods(raw()), { version: 1, foods: [], meals: [] });
  assert.deepEqual((await ready(raw())).store.getSnapshot().state, store.getSnapshot().state);
});

test("failed, invalid and missing-item edits and deletes preserve durable records and support retry", async () => {
  const { store, storage, raw } = await ready();
  const food = await store.add(foodDraft);
  assert.ok(food);
  const before = raw();
  assert.equal(await store.updateFood(food.customId, { ...foodDraft, name: "" }), null);
  assert.equal(store.getSnapshot().error, "Check the name, amounts, and nutrition values.");
  assert.equal(await store.updateFood("missing", foodDraft), null);
  assert.equal(store.getSnapshot().error, "Check the name, amounts, and nutrition values.");
  assert.equal(await store.updateMeal(food.customId, { name: "Wrong kind", ingredients: [], overrides: {} }), null);
  assert.equal(store.getSnapshot().error, "Check the name, amounts, and nutrition values.");
  assert.equal(await store.remove("missing"), false);
  assert.equal(store.getSnapshot().error, "This item is no longer available in search.");
  assert.equal(raw(), before);
  const write = storage.setItem;
  storage.setItem = async () => { throw new Error("disk full"); };
  assert.equal(await store.updateFood(food.customId, { ...foodDraft, name: "New name" }), null);
  assert.equal(store.getSnapshot().error, "Couldn't update your food. Your changes are still here. Try again.");
  assert.equal(await store.remove(food.customId), false);
  assert.equal(store.getSnapshot().error, "Couldn't delete this item. It is still saved. Try again.");
  assert.equal(raw(), before);
  assert.equal(parseCustomFoods(raw()).foods[0].name, "My oats");
  storage.setItem = write;
  assert.ok(await store.updateFood(food.customId, { ...foodDraft, name: "New name" }));
  assert.equal(await store.remove(food.customId), true);
});

test("catalog edits and deletes share the durable write lock with creation", async () => {
  const { store, storage, raw } = await ready();
  const food = await store.add(foodDraft);
  assert.ok(food);
  const before = raw();
  const write = storage.setItem;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  storage.setItem = async (key, value) => { await gate; await write(key, value); };
  const pending = store.updateFood(food.customId, { ...foodDraft, name: "New name" });
  assert.equal(store.getSnapshot().saving, true);
  assert.equal(raw(), before);
  assert.equal(await store.remove(food.customId), false);
  assert.equal(await store.add(foodDraft), null);
  release();
  assert.ok(await pending);
  assert.equal(parseCustomFoods(raw()).foods.length, 1);
  assert.equal(parseCustomFoods(raw()).foods[0].name, "New name");
});

test("edit drafts retain serving nutrition, small decimals and only explicit meal overrides", async () => {
  const { store } = await ready();
  const food = await store.add({ ...foodDraft, servingGrams: "0.0000001", calories: "0.0000004", carbs: "0", protein: "0", fat: "0" });
  assert.ok(food);
  const editFood = customFoodToDraft(food);
  assert.equal(editFood.servingGrams, "0.0000001");
  assert.equal(editFood.calories, "0.0000004");
  assert.ok(await store.updateFood(food.customId, editFood));
  const meal = await store.addMeal({ name: "Small serving", ingredients: [{ id: "ingredient-1", food, amount: "0.0000001" }], overrides: { fat: "0.0000001", protein: "0" } });
  assert.ok(meal);
  const editMeal = mealToDraft(meal);
  assert.deepEqual(editMeal.overrides, { protein: "0", fat: "0.0000001" });
  assert.equal(editMeal.ingredients[0].amount, "0.0000001");
  const result = mealFromDraft(editMeal, meal.customId);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.meal, meal);
});

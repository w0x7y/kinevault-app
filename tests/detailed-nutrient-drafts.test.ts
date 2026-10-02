import assert from "node:assert/strict";
import test from "node:test";
import { customFoodFromDraft, customFoodToDraft, parseCustomFoods, type CustomFoodDraft } from "../src/food/custom-model.ts";
import { mealFromDraft, mealToDraft, type MealDraft } from "../src/food/meal-model.ts";
import { nutritionForGrams } from "../src/food/catalog.ts";
import { entryForFood } from "../src/food/log-model.ts";
import { createCustomFoodPersistence } from "../src/food/custom-persistence.ts";

const foodDraft: CustomFoodDraft = { name: "Oats", servingGrams: "250", calories: "300", carbs: "40", protein: "12", fat: "10" };
function foodFrom(draft: CustomFoodDraft = foodDraft) {
  const result = customFoodFromDraft(draft, "food-one");
  if (!result.ok) throw new Error("Expected valid food");
  return result.food;
}
function mealDraft(): MealDraft {
  return { name: "Oat bowl", ingredients: [{ id: "oats", food: foodFrom({ ...foodDraft,
    details: { fiber: "10", sodium: "25", transFat: "0" } }), amount: "125" }], overrides: {} };
}

test("food details distinguish blank unknown from known zero and normalize g, mg, and mcg serving values", () => {
  const food = foodFrom({ ...foodDraft, details: { fiber: "10", sodium: "25", vitaminD: "2,5", transFat: "0", iron: "  " } });
  assert.equal(food.details?.fiber, 4);
  assert.equal(food.details?.sodium, 10);
  assert.equal(food.details?.vitaminD, 1);
  assert.equal(food.details?.transFat, 0);
  assert.equal(food.details?.iron, null);
  assert.equal(food.details?.calcium, null);
  const serving = nutritionForGrams(food, 125);
  assert.equal(serving.details?.fiber, 5);
  assert.equal(serving.details?.vitaminD, 1.25);
  assert.deepEqual(customFoodToDraft(food).details, { transFat: "0", fiber: "10", sodium: "25", vitaminD: "2.5" });
  const edited = foodFrom(customFoodToDraft(food));
  assert.deepEqual(edited.details, food.details);
});

test("invalid optional food details block saving and normalization overflow reports the field", () => {
  for (const input of ["-1", "1e2", "Infinity", "NaN", "2g", "1.2.3"]) {
    const result = customFoodFromDraft({ ...foodDraft, details: { sodium: input } }, "food-one");
    assert.equal(result.ok, false, input);
    if (!result.ok) assert.ok(result.errors.details?.sodium);
  }
  const result = customFoodFromDraft({ ...foodDraft, servingGrams: "0.01", details: { iron: "1" + "0".repeat(307) } }, "food-one");
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.details?.iron);
});

test("persisted food details survive reload while absent old details remain unknown and malformed values reject", () => {
  const food = foodFrom({ ...foodDraft, details: { sodium: "0", fiber: "10" } });
  assert.deepEqual(parseCustomFoods(JSON.stringify({ version: 1, foods: [food] })).foods[0].details, food.details);
  const { details: _details, ...oldFood } = food;
  assert.equal(parseCustomFoods(JSON.stringify({ version: 1, foods: [oldFood] })).foods[0].details?.fiber, null);
  for (const details of [null, [], "bad", { fiber: -1 }, { sodium: "0" }, { vitaminD: {} }, { fiber: "Infinity" }, { unsupported: 1 }])
    assert.throws(() => parseCustomFoods(JSON.stringify({ version: 1, foods: [{ ...food, details }] })));
});

test("meal detail overrides use whole-meal amounts, preserve calculated values, and blank restores calculation", () => {
  const draft = mealDraft();
  const result = mealFromDraft({ ...draft, detailOverrides: { fiber: "12", sodium: "0", iron: "3,5", transFat: "  " } }, "meal-one");
  if (!result.ok) throw new Error("Expected valid meal");
  assert.deepEqual(result.meal.detailOverrides, { fiber: 12, sodium: 0, iron: 3.5 });
  const totals = nutritionForGrams(result.meal, 125);
  assert.ok(Math.abs((totals.details?.fiber ?? Infinity) - 12) < 1e-9);
  assert.equal(totals.details?.sodium, 0);
  assert.ok(Math.abs((totals.details?.iron ?? Infinity) - 3.5) < 1e-9);
  assert.equal(totals.details?.transFat, 0);
  assert.equal(totals.details?.calcium, null);
  const edit = mealToDraft(result.meal);
  assert.deepEqual(edit.detailOverrides, { fiber: "12", sodium: "0", iron: "3.5" });
  const reloaded = parseCustomFoods(JSON.stringify({ version: 1, foods: [], meals: [result.meal] })).meals[0];
  assert.deepEqual(reloaded, result.meal);
  const reset = mealFromDraft({ ...edit, detailOverrides: { ...edit.detailOverrides, fiber: "", iron: " " } }, "meal-one");
  if (!reset.ok) throw new Error("Expected valid reset");
  assert.equal(nutritionForGrams(reset.meal, 125).details?.fiber, 5);
  assert.equal(nutritionForGrams(reset.meal, 125).details?.iron, null);
  assert.equal(nutritionForGrams(reset.meal, 125).details?.sodium, 0);
  const changed = mealFromDraft({ ...edit, ingredients: [{ ...edit.ingredients[0], amount: "250" }] }, "meal-one");
  if (!changed.ok) throw new Error("Expected edited meal");
  assert.ok(Math.abs((nutritionForGrams(changed.meal, 250).details?.fiber ?? Infinity) - 12) < 1e-9);
});

test("old meals without detail overrides still calculate and malformed optional overrides reject", () => {
  const result = mealFromDraft(mealDraft(), "meal-one");
  if (!result.ok) throw new Error("Expected meal");
  assert.equal(result.meal.detailOverrides, undefined);
  assert.equal(parseCustomFoods(JSON.stringify({ version: 1, foods: [], meals: [result.meal] })).meals[0].details?.fiber, 4);
  for (const input of ["-1", "1e2", "Infinity", "2g"]) {
    const invalid = mealFromDraft({ ...mealDraft(), detailOverrides: { fiber: input } }, "meal-one");
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.ok(invalid.errors.detailOverrides?.fiber);
  }
  for (const detailOverrides of [null, [], "bad", { fiber: -1 }, { sodium: "0" }, { iron: null }, { unsupported: 1 }])
    assert.throws(() => parseCustomFoods(JSON.stringify({ version: 1, foods: [], meals: [{ ...result.meal, detailOverrides }] })));
  const overflow = mealFromDraft({ ...mealDraft(), ingredients: [{ ...mealDraft().ingredients[0], amount: "0.01" }],
    detailOverrides: { sodium: "1" + "0".repeat(307) } }, "meal-one");
  assert.equal(overflow.ok, false);
  if (!overflow.ok) assert.ok(overflow.errors.detailOverrides?.sodium);
});

test("editing detailed foods and meals preserves saved ingredient and logged snapshots across reload and failed retry", async () => {
  let raw: string | null = null;
  let fail = false;
  let sequence = 0;
  const store = createCustomFoodPersistence({ storage: {
    async getItem() { return raw; },
    async setItem(_key, value) { if (fail) throw new Error("Disk full"); raw = value; },
  }, createId: () => `custom-${++sequence}` });
  store.start(); await Promise.resolve(); await Promise.resolve();
  const food = await store.add({ ...foodDraft, details: { fiber: "10", sodium: "0" } });
  assert.ok(food);
  const meal = await store.addMeal({ name: "Bowl", ingredients: [{ id: "oats", food, amount: "125" }], overrides: {}, detailOverrides: { iron: "2" } });
  assert.ok(meal);
  const entry = entryForFood({ id: "log", food: meal, grams: 125, meal: "lunch" });
  const edit = { ...customFoodToDraft(food), details: { fiber: "20", sodium: "3" } };
  const before = raw;
  fail = true;
  assert.equal(await store.updateFood(food.customId, edit), null);
  assert.equal(raw, before);
  fail = false;
  assert.ok(await store.updateFood(food.customId, edit));
  assert.equal(parseCustomFoods(raw).foods[0].details?.fiber, 8);
  assert.equal(parseCustomFoods(raw).meals[0].ingredients[0].food.details?.fiber, 4);
  assert.equal(entry.details?.fiber, 5);
  assert.equal(entry.details?.iron, 2);
  assert.ok(await store.updateMeal(meal.customId, { ...mealToDraft(meal), detailOverrides: { iron: "0" } }));
  assert.equal(parseCustomFoods(raw).meals[0].detailOverrides?.iron, 0);
  assert.equal(entry.details?.iron, 2);
});

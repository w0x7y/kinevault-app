import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { beverageForFood, usFluidOunceMl, usCupMl } from "../src/food/beverage.ts";
import { nutritionForGrams, type CatalogFood } from "../src/food/catalog.ts";
import { customFoodFromDraft, customFoodToDraft, parseCustomFoods } from "../src/food/custom-model.ts";
import { calculateMeal, mealFromDraft } from "../src/food/meal-model.ts";
import { entryForFood, editedFoodEntry, parseFoodLog } from "../src/food/log-model.ts";
import { parseBrandedProduct } from "../src/food/product-model.ts";
import { unknownNutrients } from "../src/food/nutrients.ts";
const dataset: { foods: CatalogFood[] } = JSON.parse(readFileSync(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"));
function bundled(id: number) { const food = dataset.foods.find(food => food.fdcId === id); assert.ok(food); return food; }
const cola = bundled(2710541);

test("bundled classification is conservative and fluid source conversion excludes ice and guideline amounts", () => {
  for (const id of [2705402, 2710572, 2710631, 2709224]) assert.equal(beverageForFood(bundled(id)), null);
  for (const id of [2710541, 2710757, 2705385, 2705396, 2710707]) assert.equal(beverageForFood(bundled(id))?.kind, "known-volume");
  const basis = beverageForFood(cola); assert.ok(basis?.kind === "known-volume");
  const ounce = cola.portions.find(portion => portion.label === "1 fl oz" || portion.label === "1 fl oz (no ice)"); assert.ok(ounce && cola.per100g);
  assert.equal(basis.per100ml.calories, cola.per100g.calories * ounce.grams / usFluidOunceMl);
  const cup = beverageForFood({ ...cola, portions: [{ label: "1 cup", grams: 248 }] }); assert.ok(cup?.kind === "known-volume");
  assert.equal(cup.per100ml.calories, cola.per100g.calories * 248 / usCupMl);
  for (const label of ["1 fl oz (with ice)", "1 fl oz (NFS)", "1 cup ice", "Guideline amount per fl oz of beverage", "1 can"])
    assert.deepEqual(beverageForFood({ ...cola, portions: [{ label, grams: 20 }] }), { kind: "unknown-volume" });
  assert.equal(beverageForFood({ customId: "custom", name: "Cola", category: "Soft drinks", per100g: cola.per100g, portions: [] }), null);
});
test("concentrates and cooking ingredients retain gram logging and source nutrition without hydration", () => {
  for (const id of [2705402, 2710572, 2710631, 2709191, 2707568, 2707571]) {
    const food = bundled(id);
    assert.equal(beverageForFood(food), null, food.name);
    const entry = entryForFood({ id: `ingredient-${id}`, food, grams: 100, meal: "snacks" });
    assert.equal(entry.meal, "snacks", food.name);
    assert.equal(entry.grams, 100, food.name);
    assert.equal(entry.drinkMl, undefined, food.name);
    assert.equal(entry.measurement, undefined, food.name);
    const sourceNutrition = nutritionForGrams(food, 100);
    for (const key of ["calories", "carbs", "protein", "fat"] as const) assert.equal(entry[key], sourceNutrition[key], `${food.name}: ${key}`);
    assert.deepEqual(entry.details, sourceNutrition.details, food.name);
    assert.deepEqual(calculateMeal([{ id: "ingredient", food, grams: 100 }]).nutrition, sourceNutrition, food.name);
    assert.throws(() => entryForFood({ id: "invalid-drink", food, measurement: "volume", drinkMl: 100 }), /Select the drink setting/);
    const restored = parseFoodLog(JSON.stringify({ version: 1, days: { "2026-10-01": [entry] } })).days["2026-10-01"][0];
    assert.equal(restored.drinkMl, undefined, food.name);
    assert.equal(restored.grams, 100, food.name);
  }
  for (const id of [2709190, 2709192, 2709187, 2705413]) {
    const food = bundled(id);
    assert.equal(beverageForFood(food)?.kind, "known-volume", food.name);
    const drink = entryForFood({ id: `prepared-${id}`, food, measurement: "volume", drinkMl: 100 });
    assert.equal(drink.meal, "drinks", food.name);
    assert.equal(drink.drinkMl, 100, food.name);
    assert.equal(drink.grams, undefined, food.name);
  }
});
test("volume snapshots scale known zero and preserve unavailable details independently of catalog edits", () => {
  const food: CatalogFood = { ...cola, beverage: { kind: "known-volume", source: "label", per100ml: { calories: 40, carbs: 10, protein: 0, fat: 0, details: { ...unknownNutrients, sodium: 0, caffeine: 10 } } } };
  const entry = entryForFood({ id: "drink", food, measurement: "volume", drinkMl: 250 });
  assert.equal(entry.calories, 100); assert.equal(entry.grams, undefined); assert.equal(entry.details?.sodium, 0); assert.equal(entry.details?.fiber, null);
  const edit = editedFoodEntry(entry, { date: "2026-10-01", id: entry.id, measurement: "volume", drinkMl: 500 });
  assert.equal(edit.calories, 200); assert.equal(edit.details?.caffeine, 50); assert.equal(edit.details?.fiber, null);
  assert.deepEqual(parseFoodLog(JSON.stringify({ version: 1, days: { "2026-10-01": [edit] } })).days["2026-10-01"][0], edit);
});
test("custom label drinks are genuinely volume-only, editable, reloadable, and unavailable as gram ingredients", () => {
  const draft = { name: "Label drink", drink: true, servingGrams: "invalid-unused", calories: "40", carbs: "10", protein: "0", fat: "0", details: { sodium: "0", caffeine: "12" } };
  const result = customFoodFromDraft(draft, "label"); assert.ok(result.ok);
  assert.equal(result.food.per100g, undefined); assert.deepEqual(result.food.portions, []);
  const food = parseCustomFoods(JSON.stringify({ version: 1, foods: [result.food] })).foods[0];
  assert.deepEqual(food, result.food); assert.equal(customFoodToDraft(food).drink, true); assert.equal(customFoodToDraft(food).details?.sodium, "0");
  assert.equal(beverageForFood(food)?.kind, "known-volume");
  assert.throws(() => nutritionForGrams(food, 100)); assert.throws(() => calculateMeal([{ id: "i", food, grams: 100 }]));
  assert.equal(mealFromDraft({ name: "Invalid ingredient", ingredients: [{ id: "i", food, amount: "100" }], overrides: {} }, "meal").ok, false);
  for (const key of ["calories", "carbs", "protein", "fat"] as const) assert.equal(customFoodFromDraft({ ...draft, [key]: "" }, "label").ok, false);
  const corrupted = { ...food, beverage: { kind: "known-volume", source: "label", per100ml: { calories: 40, carbs: 10, protein: 0, fat: 0, details: { sodium: "0" } } } };
  assert.throws(() => parseCustomFoods(JSON.stringify({ version: 1, foods: [corrupted] })));
  // Bundled beverages retain real per-gram nutrition and remain valid ingredients.
  assert.equal(calculateMeal([{ id: "cola", food: cola, grams: 50 }]).nutrition.calories, nutritionForGrams(cola, 50).calories);
});
test("OFF drink taxonomy plus explicit volume preserves per100ml while sauce packaging remains unknown", () => {
  const product = { code: "3017620422003", product_name: "Label", quantity: "330 ml", categories_tags: ["en:beverages"], nutriments: { "energy-kcal_100g": 40, carbohydrates_100g: 10, proteins_100g: 0, sodium_100g: 0 } };
  const drink = parseBrandedProduct(product); assert.ok(drink); assert.equal(drink.draft.drink, true);
  assert.equal(drink.draft.calories, "40"); assert.equal(drink.draft.protein, "0"); assert.equal(drink.draft.fat, ""); assert.equal(drink.draft.details?.sodium, "0");
  const sauce = parseBrandedProduct({ ...product, categories_tags: ["en:sauces"] }); assert.ok(sauce);
  assert.equal(sauce.draft.drink, undefined); assert.equal(sauce.draft.calories, "");
  assert.equal(parseBrandedProduct({ ...product, quantity: "100 g" })?.draft.drink, undefined);
});

import assert from "node:assert/strict";
import test from "node:test";
import { sumDetailedNutrients } from "../src/daily/detailed-nutrition.ts";
import { nutritionForGrams, createFoodCatalog, type CatalogFood } from "../src/food/catalog.ts";
import { entryForFood, nutritionForEntry, parseFoodLog } from "../src/food/log-model.ts";
import { unknownNutrients, type DetailedNutrients } from "../src/food/nutrients.ts";

const details: DetailedNutrients = {
  saturatedFat: 0.112, transFat: null, fiber: 1.7, totalSugars: 15.8,
  sodium: 0, cholesterol: 0, potassium: 326, calcium: 5, iron: 0,
  vitaminD: 0, caffeine: 0, alcohol: 0,
};
const food: CatalogFood = {
  fdcId: 2709224, name: "Banana, raw", category: "Bananas", portions: [],
  per100g: { calories: 97, carbs: 22.7, protein: 0.74, fat: 0.28 }, details,
};
const entry = () => entryForFood({ id: "one", food, grams: 200, meal: "breakfast" });

test("source nutrient units scale into a saved serving and remain scaled when edited", () => {
  const nutrition = nutritionForGrams(food, 200);
  assert.equal(nutrition.details?.potassium, 652);
  assert.equal(nutrition.details?.fiber, 3.4);
  assert.equal(nutrition.details?.transFat, null);
  assert.equal(entry().details?.totalSugars, 31.6);
  const edited = nutritionForEntry(entry(), 100);
  assert.deepEqual(edited.details, details);
  const saved = parseFoodLog(JSON.stringify({ version: 1, days: { "2026-10-01": [entry()] } }));
  assert.deepEqual(saved.days["2026-10-01"][0].details, nutrition.details);
});

test("detailed totals include every serving and mark a missing value as unavailable", () => {
  const other = { ...entry(), id: "two", details: { ...details, fiber: null, potassium: 10 } };
  const totals = sumDetailedNutrients([entry(), other], () => undefined);
  assert.equal(totals.potassium, 662);
  assert.equal(totals.fiber, null);
  assert.equal(totals.sodium, 0);
  assert.equal(totals.transFat, null);
  assert.ok(Object.values(sumDetailedNutrients([], () => undefined)).every(value => value === 0));
});

test("older entries resolve nutrients by source ID and grams without replacing saved snapshots", () => {
  const old = { id: "old", name: food.name, fdcId: food.fdcId, grams: 200, meal: "lunch",
    calories: 194, carbs: 45.4, protein: 1.48, fat: 0.56 } as const;
  const catalog = createFoodCatalog([food]);
  assert.equal(typeof catalog.getById, "function");
  assert.equal(sumDetailedNutrients([old], catalog.getById).potassium, 652);
  const snapshot = { ...old, details: { ...details, potassium: 123 } };
  assert.equal(sumDetailedNutrients([snapshot], catalog.getById).potassium, 123);
  assert.deepEqual(sumDetailedNutrients([old], () => undefined), unknownNutrients);
});

test("invalid saved nutrient values fail validation while older entries remain readable", () => {
  for (const patch of [{ sodium: -1 }, { vitaminD: "0" }]) {
    assert.throws(() => parseFoodLog(JSON.stringify({ version: 1, days: {
      "2026-10-01": [{ ...entry(), details: { ...details, ...patch } }],
    } })));
  }
});

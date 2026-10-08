import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { FoodEntry } from "../src/daily/model.ts";
import { nutritionForGrams, type CatalogFood, type ServingNutrition } from "../src/food/catalog.ts";
import { detailedNutrientsForEntry } from "../src/food/entry-nutrients.ts";
import { entryForFood, editedFoodEntry, type FoodSaveTarget } from "../src/food/log-model.ts";
import {
  prepareFoodLogging,
  type FoodLoggingFields,
  type FoodLoggingPreparation,
} from "../src/food/logging-preparation.ts";
import { mealFromDraft } from "../src/food/meal-model.ts";
import { scaleNutrients, unknownNutrients } from "../src/food/nutrients.ts";

const dataset: { foods: CatalogFood[] } = JSON.parse(
  readFileSync(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"),
);
const findFood = (id: number) => dataset.foods.find((food) => food.fdcId === id);
const banana = dataset.foods.find((food) => food.name === "Banana, raw");
assert.ok(banana);
const cola = findFood(2710541);
assert.ok(cola);
const milk = findFood(2705385);
assert.ok(milk);
const date = "2026-10-01";
const blankLabel = { calories: "", carbs: "", protein: "", fat: "" };
const zeroLabel = { calories: "0", carbs: "0", protein: "0", fat: "0" };
const fields: FoodLoggingFields = {
  grams: "100",
  drinkMl: "",
  meal: "lunch",
  labelNutrition: blankLabel,
};
function prepare(
  target: FoodSaveTarget,
  changes: Partial<FoodLoggingFields> = {},
  catalogItem?: CatalogFood,
) {
  return prepareFoodLogging({
    target,
    date,
    fields: { ...fields, ...changes },
    findFood,
    catalogItem,
  });
}
function nutrition(entry: FoodEntry): ServingNutrition {
  return {
    calories: entry.calories,
    carbs: entry.carbs,
    protein: entry.protein,
    fat: entry.fat,
    ...(entry.details ? { details: entry.details } : {}),
  };
}
function assertReady(result: FoodLoggingPreparation, original?: FoodEntry) {
  assert.equal(result.status, "ready");
  const { write } = result;
  let entry: FoodEntry;
  if (write.kind === "add") entry = entryForFood({ ...write.input, id: "prepared" });
  else {
    assert.ok(original);
    entry = editedFoodEntry(original, write.input, findFood);
  }
  assert.deepEqual(
    result.nutrition,
    nutrition(entry),
    "shown nutrition equals the executable write including detailed zeros/nulls",
  );
  assert.equal(write.input.date, date);
  return { result, entry };
}
function assertUnavailable(
  result: FoodLoggingPreparation,
  status: "incomplete" | "invalid",
  reason: "amount" | "label" | "meal",
) {
  assert.equal(result.status, status);
  assert.equal(result.reason, reason);
  assert.equal("write" in result, false);
  assert.equal("nutrition" in result, false);
}

test("solid source grams prepare source servings, a selected day and meal, and the exact preview", () => {
  for (const grams of [100, 225]) {
    const { result, entry } = assertReady(
      prepare({ kind: "add", food: banana }, { grams: String(grams) }),
    );
    assert.equal(result.measurement, "grams");
    assert.equal(result.amount, grams);
    assert.equal(result.meal, "lunch");
    assert.equal(entry.meal, "lunch");
    assert.deepEqual(result.nutrition, nutritionForGrams(banana, grams));
  }
  for (const amount of ["0", "10001", "nope", "-1"])
    assertUnavailable(
      prepare({ kind: "add", food: banana }, { grams: amount }),
      "invalid",
      "amount",
    );
  assertUnavailable(prepare({ kind: "add", food: banana }, { grams: "" }), "incomplete", "amount");
  assertUnavailable(prepare({ kind: "add", food: banana }, { meal: "drinks" }), "invalid", "meal");
});

test("known Cola uses genuine source volume, fixes Drinks, and never invents gram mass", () => {
  const { result, entry } = assertReady(
    prepare({ kind: "add", food: cola }, { drinkMl: "250", grams: "garbage" }),
  );
  assert.equal(result.measurement, "volume");
  if (result.measurement !== "volume") throw new Error("Expected volume");
  assert.equal(result.label.kind, "source");
  assert.equal(result.amount, 250);
  assert.equal(result.meal, "drinks");
  assert.equal(entry.meal, "drinks");
  assert.equal(entry.grams, undefined);
  assert.equal(entry.drinkMl, 250);
  assert.equal(entry.calories, cola.per100g!.calories * (31 / 29.5735295625) * 2.5);
});

test("unknown basis requires each label value, distinguishes blank from zero, and rejects invalid labels", () => {
  assert.ok(cola.per100g);
  const food: CatalogFood = {
    ...cola,
    per100g: cola.per100g,
    beverage: { kind: "unknown-volume" },
  };
  for (const key of ["calories", "carbs", "protein", "fat"] as const) {
    const missing = prepare(
      { kind: "add", food },
      { drinkMl: "250", labelNutrition: { ...zeroLabel, [key]: "" } },
    );
    assertUnavailable(missing, "incomplete", "label");
    assert.equal(missing.measurement, "volume");
    if (missing.measurement === "volume")
      assert.deepEqual(missing.label, { kind: "required", status: "incomplete" });
    for (const invalid of ["-1", "NaN", "1e3", "x"])
      assertUnavailable(
        prepare(
          { kind: "add", food },
          {
            drinkMl: "250",
            labelNutrition: { ...zeroLabel, [key]: invalid },
          },
        ),
        "invalid",
        "label",
      );
  }
  const { result, entry } = assertReady(
    prepare({ kind: "add", food }, { drinkMl: "250", labelNutrition: zeroLabel }),
  );
  if (result.measurement === "volume")
    assert.deepEqual(result.label, { kind: "required", status: "valid" });
  assert.equal(entry.calories, 0);
  assert.equal(entry.protein, 0);
  assert.deepEqual(entry.details, unknownNutrients);
});

test("volume input only accepts whole millilitres from 1 through 10,000", () => {
  for (const drinkMl of ["0", "-1", "1.5", "250.0", "10,000", "10001", "Infinity", "abc"]) {
    assertUnavailable(prepare({ kind: "add", food: cola }, { drinkMl }), "invalid", "amount");
  }
  assertUnavailable(prepare({ kind: "add", food: cola }), "incomplete", "amount");
  for (const drinkMl of ["1", "10000"])
    assertReady(prepare({ kind: "add", food: cola }, { drinkMl }));
});

const legacy = {
  id: "legacy",
  name: milk.name,
  fdcId: 2705385,
  meal: "drinks",
  grams: 244,
  drinkMl: 240,
  calories: 145,
  carbs: 11,
  protein: 8,
  fat: 7,
} satisfies FoodEntry;
test("legacy known ml preserves macro snapshots and recovers only missing details from stored source grams", () => {
  for (const amount of [240, 480]) {
    const { entry, result } = assertReady(
      prepare(
        { kind: "edit", entry: legacy },
        { drinkMl: String(amount), labelNutrition: zeroLabel },
      ),
      legacy,
    );
    assert.equal(entry.calories, (legacy.calories * amount) / 240);
    assert.deepEqual(
      entry.details,
      scaleNutrients(detailedNutrientsForEntry(legacy, findFood), amount / 240),
    );
    assert.equal(entry.details?.calcium, (300.12 * amount) / 240);
    assert.equal(entry.grams, undefined);
    if (result.measurement === "volume") assert.equal(result.label.kind, "snapshot");
  }
  for (const details of [unknownNutrients, { ...unknownNutrients, sodium: 0 }]) {
    const snapshot = { ...legacy, details };
    const { entry } = assertReady(
      prepare({ kind: "edit", entry: snapshot }, { drinkMl: "480" }),
      snapshot,
    );
    assert.deepEqual(entry.details, scaleNutrients(details, 2));
  }
});

test("legacy missing ml requires entered label even when a current source has reliable volume nutrition", () => {
  const { drinkMl: _missing, ...entry } = legacy;
  assertUnavailable(prepare({ kind: "edit", entry }, { drinkMl: "250" }), "incomplete", "label");
  const { entry: saved } = assertReady(
    prepare(
      { kind: "edit", entry },
      { drinkMl: "250", labelNutrition: { ...zeroLabel, calories: "40" } },
    ),
    entry,
  );
  assert.equal(saved.calories, 100);
  assert.equal(saved.grams, undefined);
  assert.deepEqual(saved.details, unknownNutrients);
});

test("Custom meal overrides scale from their saved basis and logged edits keep their authoritative snapshot", () => {
  const meal = mealFromDraft(
    {
      name: "Override bowl",
      ingredients: [{ id: "banana", food: banana, amount: "100" }],
      overrides: { calories: "321", protein: "12" },
      detailOverrides: { sodium: "42" },
    },
    "bowl",
  );
  assert.ok(meal.ok);
  const { entry } = assertReady(
    prepare({ kind: "add", food: meal.meal }, { grams: "225", meal: "dinner" }),
  );
  assert.equal(entry.calories, 321 * 2.25);
  assert.equal(entry.protein, 12 * 2.25);
  assert.equal(entry.details?.sodium, 42 * 2.25);
  const current = { ...meal.meal, per100g: { calories: 999, carbs: 999, protein: 999, fat: 999 } };
  const { entry: edited } = assertReady(
    prepare({ kind: "edit", entry }, { grams: "100", meal: "snacks" }, current),
    entry,
  );
  assert.equal(edited.calories, 321);
  assert.equal(edited.protein, 12);
  assert.equal(edited.meal, "snacks");
  assert.equal(edited.details?.sodium, 42);
});

test("current catalog food-to-drink edits change add measurement and require explicit label for old gram intake", () => {
  const old: CatalogFood = {
    customId: "changed",
    name: "Changed food",
    category: "Custom food",
    portions: [{ label: "serving", grams: 100 }],
    per100g: { calories: 80, carbs: 10, protein: 1, fat: 1 },
  };
  const current: CatalogFood = {
    customId: old.customId,
    name: "Changed drink",
    category: "Custom food",
    portions: [],
    beverage: {
      kind: "known-volume",
      source: "label",
      per100ml: { calories: 40, carbs: 10, protein: 0, fat: 0 },
    },
  };
  const { entry } = assertReady(prepare({ kind: "add", food: old }, { drinkMl: "250" }, current));
  assert.equal(entry.name, current.name);
  assert.equal(entry.calories, 100);
  assert.equal(entry.grams, undefined);
  const snapshot = entryForFood({ id: "old", food: old, grams: 100, meal: "snacks" });
  assertUnavailable(
    prepare({ kind: "edit", entry: snapshot }, { drinkMl: "250" }, current),
    "incomplete",
    "label",
  );
  const { entry: converted } = assertReady(
    prepare(
      { kind: "edit", entry: snapshot },
      { drinkMl: "250", labelNutrition: zeroLabel },
      current,
    ),
    snapshot,
  );
  assert.equal(converted.meal, "drinks");
  assert.equal(converted.calories, 0);
});

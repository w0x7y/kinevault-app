import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createFoodCatalog, nutritionForGrams, type CatalogFood } from "../src/food/catalog.ts";
import { nutritionForEntryMl, editedFoodEntry, parseFoodLog } from "../src/food/log-model.ts";
import { createFoodLogPersistence, foodLogStorageKey } from "../src/food/log-persistence.ts";
import { sumDetailedNutrients } from "../src/daily/detailed-nutrition.ts";
import { scaleNutrients, unknownNutrients } from "../src/food/nutrients.ts";
import type { FoodEntry } from "../src/daily/model.ts";

const dataset: { foods: CatalogFood[] } = JSON.parse(readFileSync(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"));
const catalog = createFoodCatalog(dataset.foods);
const milk = catalog.getById(2705385); assert.ok(milk);
const date = "2026-10-01";
const nutrition = nutritionForGrams(milk, 244);
const legacy: FoodEntry = { id: "legacy-milk", fdcId: 2705385, name: milk.name, meal: "drinks", grams: 244, drinkMl: 240,
  calories: nutrition.calories, carbs: nutrition.carbs, protein: nutrition.protein, fat: nutrition.fat };
const document = (entry: FoodEntry) => ({ version: 1, days: { [date]: [entry] } });
const sourceDetails = sumDetailedNutrients([legacy], catalog.getById);
const noLookup = () => { throw new Error("Saved or unavailable source details must not consult the catalog"); };

test("legacy known-volume preview and conversion preserve the stored-gram source fallback and scale it by ml", () => {
  assert.equal(sourceDetails.calcium, 300.12);
  assert.equal(sourceDetails.sodium, 92.72);
  assert.equal(sourceDetails.vitaminD, 2.684);
  for (const drinkMl of [240, 480, 120]) {
    const expected = scaleNutrients(sourceDetails, drinkMl / 240);
    assert.deepEqual(nutritionForEntryMl(legacy, drinkMl, undefined, catalog.getById).details, expected);
    const edited = editedFoodEntry(legacy, { date, id: legacy.id, measurement: "volume", drinkMl }, catalog.getById);
    assert.equal(edited.grams, undefined);
    assert.equal(edited.measurement, "volume");
    assert.deepEqual(edited.details, expected);
    assert.deepEqual(sumDetailedNutrients([edited], noLookup), expected);
    for (const key of ["fiber", "iron", "caffeine"] as const) assert.equal(edited.details?.[key], 0);
    for (const key of ["calories", "carbs", "protein", "fat"] as const) assert.equal(edited[key], legacy[key] * (drinkMl / 240));
  }
});

test("explicit nulls and zeros stay authoritative and missing legacy or volume source details stay unknown", () => {
  for (const details of [unknownNutrients, { ...unknownNutrients, calcium: 0, sodium: 0 }]) {
    const entry = { ...legacy, details };
    const edited = editedFoodEntry(entry, { date, id: entry.id, measurement: "volume", drinkMl: 480 }, noLookup);
    assert.deepEqual(edited.details, scaleNutrients(details, 2));
  }
  const missingSource = editedFoodEntry(legacy, { date, id: legacy.id, measurement: "volume", drinkMl: 480 }, () => undefined);
  assert.deepEqual(missingSource.details, unknownNutrients);
  const volume: FoodEntry = { id: "volume", fdcId: 2705385, name: milk.name, meal: "drinks", measurement: "volume", drinkMl: 240,
    calories: legacy.calories, carbs: legacy.carbs, protein: legacy.protein, fat: legacy.fat };
  assert.deepEqual(nutritionForEntryMl(volume, 480, undefined, noLookup).details, unknownNutrients);
  const custom: FoodEntry = { id: "custom", customId: "custom", name: "Legacy custom", meal: "drinks", grams: 244, drinkMl: 240,
    calories: legacy.calories, carbs: legacy.carbs, protein: legacy.protein, fat: legacy.fat };
  assert.deepEqual(nutritionForEntryMl(custom, 480, undefined, noLookup).details, unknownNutrients);
  assert.deepEqual(nutritionForEntryMl(legacy, 240, { calories: 0, carbs: 0, protein: 0, fat: 0 }, noLookup).details, unknownNutrients);
});

test("legacy volume conversion persists a snapshot and reload scales it without the source catalog", async () => {
  let raw = JSON.stringify(document(legacy));
  const storage = {
    async getItem(key: string) { assert.equal(key, foodLogStorageKey); return raw; },
    async setItem(key: string, value: string) { assert.equal(key, foodLogStorageKey); raw = value; },
  };
  async function load(findFood: (id: number) => CatalogFood | undefined) {
    const log = createFoodLogPersistence({ storage, createId: () => "unused", findFood });
    log.start(); await Promise.resolve(); await Promise.resolve();
    assert.equal(log.getSnapshot().state.kind, "ready");
    return log;
  }
  const log = await load(catalog.getById);
  assert.equal(await log.edit({ date, id: legacy.id, measurement: "volume", drinkMl: 240 }), true);
  let saved = parseFoodLog(raw).days[date][0];
  assert.equal(saved.grams, undefined);
  assert.deepEqual(saved.details, sourceDetails);
  log.stop();
  const reloaded = await load(noLookup);
  assert.equal(await reloaded.edit({ date, id: legacy.id, measurement: "volume", drinkMl: 480 }), true);
  saved = parseFoodLog(raw).days[date][0];
  assert.deepEqual(saved.details, scaleNutrients(sourceDetails, 2));
  assert.deepEqual(sumDetailedNutrients([saved], noLookup), scaleNutrients(sourceDetails, 2));
  reloaded.stop();
});

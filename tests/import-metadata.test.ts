import assert from "node:assert/strict";
import test from "node:test";
import { customFoodFromDraft, customFoodToDraft, parseCustomFoods } from "../src/food/custom-model.ts";
import { createFoodCatalog } from "../src/food/catalog.ts";
import { parseCatalogFoodRecord } from "../src/food/catalog-record.ts";
import { parseFoodMetadata } from "../src/food/import-metadata.ts";

test("saved scan metadata and editable brand survive edits, reload and ingredient snapshots", () => {
  const result = customFoodFromDraft({ name: "My breakfast", brand: " Tnuva ", servingGrams: "100",
    calories: "200", carbs: "30", protein: "5", fat: "3", details: { sodium: "0" },
    importSource: { provider: "open-food-facts", method: "barcode", barcode: "7290004131074" } }, "scan");
  assert.ok(result.ok);
  const reloaded = parseCustomFoods(JSON.stringify({ version: 1, foods: [result.food] })).foods[0];
  assert.equal(reloaded.brand, "Tnuva");
  assert.deepEqual(reloaded.importSource, result.food.importSource);
  assert.deepEqual(parseCatalogFoodRecord(reloaded).importSource, result.food.importSource);
  const edited = customFoodFromDraft({ ...customFoodToDraft(reloaded), name: "Renamed", brand: "My brand" }, "scan");
  assert.ok(edited.ok);
  assert.deepEqual(edited.food.importSource, result.food.importSource);
  assert.equal(edited.food.details?.sodium, 0);
  assert.equal(createFoodCatalog([edited.food]).search("my brand").items[0]?.customId, "scan");
});

test("manual scanned foods preserve their origin without inventing provider provenance", () => {
  const metadata = parseFoodMetadata({ importSource: { provider: "manual", method: "barcode", barcode: "3017620422003" } });
  assert.equal(metadata.importSource?.provider, "manual");
  assert.equal(metadata.importSource?.method, "barcode");
  assert.deepEqual(parseFoodMetadata({}), {});
  assert.throws(() => parseFoodMetadata({ importSource: { provider: "manual", method: "brand", barcode: "3017620422003" } }));
});

test("stored import metadata rejects invalid codes, providers, methods and brands", () => {
  for (const source of [
    { provider: "open-food-facts", method: "barcode", barcode: "https://example.com" },
    { provider: "open-food-facts", method: "barcode", barcode: "3017620422004" },
    { provider: "unknown", method: "barcode", barcode: "3017620422003" },
    { provider: "open-food-facts", method: "qr", barcode: "3017620422003" },
  ]) assert.throws(() => parseFoodMetadata({ importSource: source }));
  assert.throws(() => parseFoodMetadata({ brand: 12 }));
  assert.throws(() => parseFoodMetadata({ brand: "x".repeat(401) }));
});

test("legacy non-scanned imports retain provenance through parsing, editing and reserialization", () => {
  const legacy = { customId: "legacy-import", name: "Saved cereal", brand: "FixtureBrand", category: "Custom food",
    per100g: { calories: 300, carbs: 45, protein: 10, fat: 5 }, portions: [{ label: "1 serving", grams: 100 }],
    importSource: { provider: "open-food-facts", barcode: "3017620422003", method: "brand" } };
  const parsed = parseCustomFoods(JSON.stringify({ version: 1, foods: [legacy], meals: [] })).foods[0];
  assert.deepEqual(parsed.importSource, { ...legacy.importSource, method: "import" });
  assert.equal(parsed.brand, legacy.brand);
  const edited = customFoodFromDraft({ ...customFoodToDraft(parsed), name: "Edited saved cereal" }, parsed.customId);
  assert.ok(edited.ok);
  const reloaded = parseCustomFoods(JSON.stringify({ version: 1, foods: [edited.food], meals: [] })).foods[0];
  assert.deepEqual(reloaded.importSource, parsed.importSource);
  assert.deepEqual(parseCatalogFoodRecord(reloaded).importSource, parsed.importSource);
  assert.equal(reloaded.importSource?.method, "import");
  assert.throws(() => parseFoodMetadata({ importSource: { ...legacy.importSource, provider: "manual", method: "import" } }));
  assert.throws(() => parseFoodMetadata({ importSource: { ...legacy.importSource, provider: "unknown" } }));
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createFoodCatalog, type CatalogFood } from "../src/food/catalog.ts";
import { detailedNutrients } from "../src/food/nutrients.ts";

const data: { source: { recordCount: number }; foods: CatalogFood[] } = JSON.parse(
  await readFile(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"),
);

test("the shipped food catalog has unique USDA IDs and complete per-100g nutrition", () => {
  assert.ok(data.foods.length > 5000, "the app must ship the full catalog, not a small sample");
  assert.equal(data.source.recordCount, data.foods.length);
  assert.equal(new Set(data.foods.map(food => food.fdcId)).size, data.foods.length);
  for (const food of data.foods) {
    assert.ok(Number.isInteger(food.fdcId) && food.fdcId > 0);
    assert.ok(food.name.trim());
    for (const key of ["calories", "carbs", "protein", "fat"] as const)
      assert.ok(Number.isFinite(food.per100g[key]) && food.per100g[key] >= 0, `${food.fdcId}: ${key}`);
    for (const { key } of detailedNutrients) {
      const value = food.details?.[key];
      assert.ok(value === null || typeof value === "number" && Number.isFinite(value) && value >= 0, `${food.fdcId}: ${key}`);
    }
    for (const portion of food.portions)
      assert.ok(portion.label.trim() && Number.isFinite(portion.grams) && portion.grams > 0);
  }
});

test("the shipped catalog finds everyday foods and retains the published banana nutrition", () => {
  const catalog = createFoodCatalog(data.foods);
  for (const query of ["chicken breast", "rice cooked", "hummus", "eggs", "apples"])
    assert.ok(catalog.search(query).total > 0, query);
  const banana = catalog.search("banana raw").items[0];
  assert.equal(banana?.fdcId, 2709224);
  assert.deepEqual(banana?.per100g, { calories: 97, carbs: 22.7, protein: 0.74, fat: 0.28 });
  assert.ok(banana?.portions.some(portion => portion.label === "1 banana" && portion.grams === 126));
});

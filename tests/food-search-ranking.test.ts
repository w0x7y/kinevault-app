import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createFoodSelection } from "../src/food/catalog-selection.ts";
import { createFoodCatalog, type CatalogFood } from "../src/food/catalog.ts";
import { commonFoodNames } from "../src/food/common-foods.ts";
import { entryForFood } from "../src/food/log-model.ts";

const bundled = JSON.parse(
  readFileSync(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"),
).foods as CatalogFood[];
const catalog = createFoodCatalog(bundled);
const names = (query: string, count: number) =>
  catalog
    .search(query)
    .items.slice(0, count)
    .map((food) => food.name);

test("every common food name exists in the bundled catalog", () => {
  const catalogNames = new Set(bundled.map((food) => food.name));
  assert.deepEqual(
    commonFoodNames.filter((name) => !catalogNames.has(name)),
    [],
  );
});

test("everyday foods lead their searches ahead of by-products and mixed drinks", () => {
  assert.equal(names("chicken", 1)[0], "Chicken breast, grilled without sauce, skin not eaten");
  assert.ok(!names("chicken", 10).includes("Chicken feet"));
  assert.equal(names("cola", 1)[0], "Soft drink, cola");
  assert.equal(names("rice", 1)[0], "Rice, white, cooked, no added fat");
  assert.equal(names("salmon", 1)[0], "Fish, salmon, baked or broiled");
});

test("a chicken by-product still ranks first when it is what was typed", () => {
  assert.equal(names("chicken feet", 1)[0], "Chicken feet");
});

test("foods logged on any day lead the logging results, most logged first", () => {
  const selection = createFoodSelection({
    savedFoods: [],
    savedMeals: [],
    bundledFoods: () => bundled,
  });
  const feet = bundled.find((food) => food.name === "Chicken feet")!;
  const kiev = bundled.find((food) => food.name === "Chicken kiev")!;
  let id = 0;
  const entry = (food: CatalogFood) =>
    entryForFood({ id: `entry-${++id}`, food, grams: 100, meal: "dinner" });
  const log = {
    version: 1 as const,
    days: {
      "2026-10-01": [entry(feet), entry(kiev)],
      "2026-10-02": [entry(feet)],
      "2026-10-03": [entry(feet)],
    },
  };
  const rows = selection.search({ purpose: "logging", query: "chicken", log }).rows;
  assert.deepEqual(
    rows.slice(0, 3).map((row) => row.food.name),
    ["Chicken feet", "Chicken kiev", "Chicken breast, grilled without sauce, skin not eaten"],
  );
});

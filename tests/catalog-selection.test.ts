import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createFoodSelection } from "../src/food/catalog-selection.ts";
import { createFoodCatalog, foodKey, type CatalogFood } from "../src/food/catalog.ts";
import {
  customFoodFromDraft,
  parseCustomFoods,
  type CustomFood,
} from "../src/food/custom-model.ts";
import { mealFromDraft } from "../src/food/meal-model.ts";

function savedFood(id: string, name: string, drink = false): CustomFood {
  const result = customFoodFromDraft(
    { name, drink, servingGrams: "100", calories: "40", carbs: "10", protein: "0", fat: "0" },
    id,
  );
  assert.ok(result.ok);
  return result.food;
}
const solids = Array.from({ length: 25 }, (_, i) =>
  savedFood(`solid-${i}`, `Fixture nourishing solid ${String(i).padStart(2, "0")}`),
);
const drinks = Array.from({ length: 25 }, (_, i) =>
  savedFood(`drink-${i}`, `Fixture sip ${String(i).padStart(2, "0")}`, true),
);
const mealResult = mealFromDraft(
  {
    name: "Fixture bowl",
    ingredients: [{ id: "ingredient", food: solids[0], amount: "100" }],
    overrides: {},
  },
  "meal",
);
assert.ok(mealResult.ok);
const meal = mealResult.meal;
const bundledFoods: CatalogFood[] = JSON.parse(
  readFileSync(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"),
).foods;

test("ingredient eligibility precedes paging, fills both pages and reports excluded matching drinks", () => {
  const selection = createFoodSelection({
    savedFoods: [...drinks, ...solids],
    savedMeals: [meal],
    bundledFoods: [],
  });
  const pages = [0, 1].map((page) =>
    selection.search({ purpose: "ingredient", query: "Fixture", page }),
  );
  assert.deepEqual(
    pages.map((result) => result.rows.length),
    [20, 5],
  );
  for (const result of pages) {
    assert.equal(result.total, 25);
    assert.equal(result.pageCount, 2);
    assert.equal(result.exclusions.volumeOnly, 25);
    assert.ok(
      result.rows.every((row) => row.kind === "food" && row.food.per100g && !row.genericMatch),
    );
  }
  assert.equal(
    new Set(pages.flatMap((result) => result.rows.map((row) => foodKey(row.food)))).size,
    25,
  );
  assert.deepEqual(
    pages.flatMap((result) => result.rows.map((row) => row.food.customId)),
    solids.map((food) => food.customId),
  );
  const onlyDrinks = selection.search({ purpose: "ingredient", query: "Fixture sip", page: 8 });
  assert.deepEqual(onlyDrinks, {
    rows: [],
    total: 0,
    page: 0,
    pageCount: 0,
    exclusions: { volumeOnly: 25 },
  });
  const absent = selection.search({ purpose: "ingredient", query: "no matching item" });
  assert.equal(absent.exclusions.volumeOnly, 0);
});

test("logging preserves all records, ranked pages and meal classification", () => {
  const bundled = {
    fdcId: 1,
    name: "Fixture bundled food",
    category: "Source",
    per100g: { calories: 40, carbs: 10, protein: 0, fat: 0 },
    portions: [],
  };
  const selection = createFoodSelection({
    savedFoods: [...drinks, ...solids],
    savedMeals: [meal],
    bundledFoods: [bundled],
  });
  const existing = createFoodCatalog([...drinks, ...solids, meal, bundled]);
  const pages = [0, 1, 2].map((page) =>
    selection.search({ purpose: "logging", query: "Fixture", page }),
  );
  assert.deepEqual(
    pages.map((result) => result.rows.length),
    [20, 20, 12],
  );
  for (const [page, result] of pages.entries()) {
    assert.equal(result.total, 52);
    assert.equal(result.exclusions.volumeOnly, 0);
    assert.deepEqual(
      result.rows.map((row) => row.food),
      existing.search("Fixture", page).items,
    );
  }
  assert.equal(
    pages.flatMap((result) => result.rows).find((row) => row.food.customId === meal.customId)?.kind,
    "meal",
  );
});

test("saved identity and kind resolve current reconstructed, edited, added and deleted records", () => {
  const document = parseCustomFoods(
    JSON.stringify({ version: 1, foods: [solids[0]], meals: [meal] }),
  );
  let selection = createFoodSelection({
    savedFoods: document.foods,
    savedMeals: document.meals,
    bundledFoods: [],
  });
  assert.deepEqual(selection.savedItem(solids[0].customId), {
    kind: "food",
    food: document.foods[0],
  });
  assert.deepEqual(selection.savedItem(meal.customId), { kind: "meal", food: document.meals[0] });
  assert.equal(selection.savedItem("missing"), undefined);
  const edited = savedFood(solids[0].customId, "Edited item", true);
  const editedMeal = { ...document.meals[0], name: "Edited meal" };
  selection = createFoodSelection({
    savedFoods: [edited, solids[1]],
    savedMeals: [editedMeal],
    bundledFoods: [],
  });
  assert.equal(selection.savedItem(edited.customId)?.food, edited);
  assert.equal(selection.savedItem(meal.customId)?.food, editedMeal);
  assert.equal(selection.savedItem(solids[1].customId)?.food, solids[1]);
  assert.equal(selection.search({ purpose: "ingredient", query: "Edited item" }).total, 0);
  selection = createFoodSelection({ savedFoods: [solids[1]], savedMeals: [], bundledFoods: [] });
  assert.equal(selection.savedItem(edited.customId), undefined);
  assert.equal(selection.savedItem(meal.customId), undefined);
  assert.equal(document.meals[0].ingredients[0].food.name, solids[0].name);
});

test("stale and invalid pages resolve within the current eligible catalog", () => {
  const selection = createFoodSelection({ savedFoods: solids, savedMeals: [], bundledFoods: [] });
  for (const page of [-1, NaN, Infinity])
    assert.equal(selection.search({ purpose: "ingredient", query: "Fixture", page }).page, 0);
  assert.equal(selection.search({ purpose: "ingredient", query: "Fixture", page: 1.9 }).page, 1);
  const shrunk = createFoodSelection({
    savedFoods: solids.slice(0, 3),
    savedMeals: [],
    bundledFoods: [],
  });
  for (const purpose of ["ingredient", "logging"] as const) {
    const result = shrunk.search({ purpose, query: "Fixture", page: 1 });
    assert.equal(result.page, 0);
    assert.equal(result.pageCount, 1);
    assert.deepEqual(
      result.rows.map((row) => row.food),
      solids.slice(0, 3),
    );
  }
});

test("selection preserves matching tolerance, qualifiers, generic metadata, saved precedence and gram source nutrition", () => {
  const imported = {
    ...savedFood("pepsi", "Pepsi Zero Sugar"),
    brand: "Pepsi",
    importSource: { provider: "open-food-facts", barcode: "3017620422003", method: "barcode" },
  } satisfies CustomFood;
  const volume = savedFood("volume", "Pepsi Zero Sugar label", true);
  const selection = createFoodSelection({
    savedFoods: [imported, volume],
    savedMeals: [meal],
    bundledFoods,
  });
  const oldIngredient = createFoodCatalog([imported, volume, ...bundledFoods]);
  const oldLogging = createFoodCatalog([imported, volume, meal, ...bundledFoods]);
  for (const query of [
    "Pepsi zero",
    "pepsizero",
    "drpeper",
    "Monster zero",
    "chiken grilled",
    "cola",
    "chicken raw",
    "",
  ]) {
    for (const purpose of ["ingredient", "logging"] as const) {
      const existing = purpose === "ingredient" ? oldIngredient : oldLogging;
      const first = existing.search(query);
      const oldPages = Array.from({ length: Math.ceil(first.total / 20) }, (_, page) =>
        existing.search(query, page),
      );
      const expected = oldPages
        .flatMap((result) =>
          result.items.map((food) => ({
            food,
            genericMatch: result.genericDrinkKeys.includes(foodKey(food)),
          })),
        )
        .filter((row) => purpose === "logging" || row.food.per100g !== undefined);
      const actual = selection.search({ purpose, query });
      assert.equal(actual.total, expected.length, `${purpose}: ${query}`);
      assert.deepEqual(
        actual.rows.map(({ food, genericMatch }) => ({ food, genericMatch })),
        expected.slice(0, 20),
        `${purpose}: ${query}`,
      );
    }
  }
  const pepsi = selection.search({ purpose: "ingredient", query: "Pepsi zero" });
  assert.equal(pepsi.rows[0].food, imported);
  assert.equal(pepsi.rows[0].genericMatch, false);
  assert.equal(pepsi.rows[0].food.importSource, imported.importSource);
  const generic = pepsi.rows.find((row) => row.genericMatch && row.food.fdcId === 2710542);
  assert.ok(generic);
  assert.equal(generic.food.per100g, bundledFoods.find((food) => food.fdcId === 2710542)?.per100g);
});

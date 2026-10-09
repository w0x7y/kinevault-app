import assert from "node:assert/strict";
import test from "node:test";
import {
  createFoodCatalog,
  nutritionForGrams,
  parseFoodGrams,
  type CatalogFood,
} from "../src/food/catalog.ts";

const banana: CatalogFood = {
  fdcId: 2709224,
  name: "Banana, raw",
  category: "Bananas",
  per100g: { calories: 97, carbs: 22.7, protein: 0.74, fat: 0.28 },
  portions: [{ label: "1 banana", grams: 126 }],
};
const food = (fdcId: number, name: string): CatalogFood => ({ ...banana, fdcId, name });

test("catalog construction, ID lookups and empty queries do not build the search index", () => {
  let nameReads = 0;
  const item: CatalogFood = {
    ...banana,
    get name() {
      nameReads++;
      return "Banana, raw";
    },
  };
  const catalog = createFoodCatalog([item]);
  assert.equal(catalog.getById(item.fdcId!), item);
  for (const query of ["", "   ", "!", "b", " b ! "]) assert.equal(catalog.search(query).total, 0);
  assert.equal(nameReads, 0, "non-search use must not initialize searchable fields");
  assert.equal(catalog.search("banana").items[0], item);
  assert.ok(nameReads > 0, "the first searchable query indexes the catalog");
  const indexedReads = nameReads;
  assert.equal(catalog.search("raw").items[0], item);
  assert.equal(nameReads, indexedReads, "later searches reuse the index");
});

test("a deferred search retains the catalog's original membership", () => {
  const foods: CatalogFood[] = [banana];
  const catalog = createFoodCatalog(foods);
  foods.push(food(1, "Apple, raw"));
  assert.equal(catalog.search("apple").total, 0);
  assert.equal(catalog.search("banana").items[0], banana);
});

test("food search matches words in any order, case, punctuation, and partial words", () => {
  const catalog = createFoodCatalog([
    food(1, "Chicken breast, grilled"),
    food(2, "Chicken soup"),
    banana,
  ]);
  assert.deepEqual(
    catalog.search("  BREAST, chi  ").items.map((f) => f.fdcId),
    [1],
  );
  assert.equal(catalog.search("chicken banana").total, 0);
  assert.equal(catalog.search("grill").items[0]?.name, "Chicken breast, grilled");
});

test("food search handles common plurals without matching the middle of another word", () => {
  const catalog = createFoodCatalog([
    food(1, "Apple, raw"),
    food(2, "Pineapple, raw"),
    banana,
    food(3, "Egg, boiled"),
  ]);
  assert.deepEqual(
    catalog.search("apples").items.map((f) => f.fdcId),
    [1],
  );
  assert.deepEqual(
    catalog.search("bananas").items.map((f) => f.fdcId),
    [2709224],
  );
  assert.deepEqual(
    catalog.search("eggs").items.map((f) => f.fdcId),
    [3],
  );
});

test("common food plurals ending in es find their singular food names", () => {
  const catalog = createFoodCatalog([
    food(1, "Potato, baked"),
    food(2, "Tomato sauce"),
    food(3, "Peach, raw"),
    food(4, "Mango, raw"),
  ]);
  for (const [query, id] of [
    ["potatoes baked", 1],
    ["tomatoes sauce", 2],
    ["peaches", 3],
    ["mangoes", 4],
  ] as const)
    assert.deepEqual(
      catalog.search(query).items.map((f) => f.fdcId),
      [id],
    );
});

test("exact and simple food names rank above dishes containing that food", () => {
  const catalog = createFoodCatalog([
    food(1, "Banana pudding"),
    food(2, "Cake, banana"),
    banana,
    food(3, "Banana"),
  ]);
  assert.deepEqual(
    catalog.search("banana").items.map((f) => f.name),
    ["Banana", "Banana, raw", "Banana pudding", "Cake, banana"],
  );
});

test("empty or short food queries do not dump the catalog", () => {
  const catalog = createFoodCatalog([banana]);
  for (const query of ["", "   ", "!", "b", " b ! "]) assert.equal(catalog.search(query).total, 0);
});

test("food result pages retain the total and never repeat or skip matches", () => {
  const catalog = createFoodCatalog(
    Array.from({ length: 45 }, (_, index) =>
      food(index + 1, `Apple variety ${String(index).padStart(2, "0")}`),
    ),
  );
  const pages = [0, 1, 2].map((page) => catalog.search("apple", page));
  assert.deepEqual(
    pages.map((page) => page.items.length),
    [20, 20, 5],
  );
  assert.deepEqual(
    pages.map((page) => page.total),
    [45, 45, 45],
  );
  assert.deepEqual(
    pages.flatMap((page) => page.items.map((f) => f.fdcId)),
    Array.from({ length: 45 }, (_, i) => i + 1),
  );
  assert.equal(catalog.search("apple", 99).items.length, 0);
});

test("nutrition scales USDA per-100g values for a weighed or listed portion", () => {
  assert.deepEqual(nutritionForGrams(banana, 50), {
    calories: 48.5,
    carbs: 11.35,
    protein: 0.37,
    fat: 0.14,
  });
  const serving = nutritionForGrams(banana, banana.portions[0]!.grams);
  assert.ok(Math.abs(serving.calories - 122.22) < 0.000001);
  assert.ok(Math.abs(serving.carbs - 28.602) < 0.000001);
  for (const grams of [0, -1, NaN, Infinity])
    assert.throws(() => nutritionForGrams(banana, grams), RangeError);
});

test("food amounts accept metric decimal edits and reject unsafe or invalid input", () => {
  for (const [input, expected] of [
    ["100", 100],
    [" 12,5 ", 12.5],
    [".5", 0.5],
    ["10000", 10000],
  ] as const)
    assert.equal(parseFoodGrams(input), expected);
  for (const input of ["", "0", "-1", "1e3", "NaN", "12g", "1,2.3", "10001"])
    assert.equal(parseFoodGrams(input), null);
});

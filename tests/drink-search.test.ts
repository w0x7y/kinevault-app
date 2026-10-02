import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createFoodCatalog, foodKey, nutritionForGrams, type CatalogFood } from "../src/food/catalog.ts";
import { isRecord, parseCatalogFoodRecord } from "../src/food/catalog-record.ts";

const data: unknown = JSON.parse(await readFile(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"));
assert.ok(isRecord(data) && Array.isArray(data.foods));
const foods = data.foods.map(parseCatalogFoodRecord);
const catalog = createFoodCatalog(foods);
const dietCola = catalog.getById(2710542);
assert.ok(dietCola);

test("common cola and Dr Pepper brand spellings find existing generic USDA drinks", () => {
  for (const query of ["Pepsi", "Coke", "Coca-Cola", "cocacola"]) {
    const result = catalog.search(query);
    assert.ok(result.items.some(food => food.fdcId === 2710541), query);
    assert.ok(result.items.every(food => [2710541, 2710542, 2710543, 2710544].includes(food.fdcId ?? 0)), query);
    assert.deepEqual(result.genericDrinkKeys, result.items.map(foodKey));
  }
  for (const query of ["Dr Pepper", "dr. pepper", "drpepper", "drpeper", "dr peper"]) {
    const result = catalog.search(query);
    assert.ok(result.items.some(food => food.fdcId === 2710545), query);
    assert.ok(result.items.every(food => [2710545, 2710546, 2710547, 2710548].includes(food.fdcId ?? 0)), query);
    assert.deepEqual(result.genericDrinkKeys, result.items.map(foodKey));
  }
});

test("zero, diet and sugar-free cola and pepper aliases never return regular sugary drinks", () => {
  for (const brand of ["Pepsi", "Coke", "Coca-Cola", "cola", "Dr Pepper", "drpeper"]) {
    for (const qualifier of ["zero", "zero sugar", "diet", "sugar-free", "sugarfree"]) {
      for (const query of [`${brand} ${qualifier}`, `${qualifier} ${brand}`]) {
        const result = catalog.search(query);
        assert.ok(result.total > 0, query);
        assert.ok(result.items.every(food => ![2710541, 2710543, 2710545, 2710547].includes(food.fdcId ?? 0)), query);
        assert.ok(result.items.filter(food => result.genericDrinkKeys.includes(foodKey(food)))
          .every(food => food.category === "Diet soft drinks"), query);
      }
    }
  }
  assert.equal(catalog.search("Pepsi mango").total, 0);
  assert.equal(catalog.search("drpeper banana").total, 0);
});

test("existing Monster records keep their USDA identity and match zero qualifiers to sugar-free", () => {
  assert.deepEqual(catalog.search("Monster").items.map(food => food.fdcId).sort(), [2710747, 2710757, 2710758]);
  assert.deepEqual(catalog.search("Monster").genericDrinkKeys, []);
  for (const query of ["Monster zero", "Monster zero sugar", "Monster sugarfree", "Monster sugar-free"]) {
    const result = catalog.search(query);
    assert.deepEqual(result.items.map(food => food.fdcId), [2710758], query);
    assert.deepEqual(result.genericDrinkKeys, []);
  }
  for (const query of ["Monster diet", "Monster lowcal", "Monster low calorie"])
    assert.deepEqual(catalog.search(query).items.map(food => food.fdcId), [2710757], query);
  for (const query of ["Red Bull", "Rockstar", "energy drink", "soft drink", "cola"])
    assert.ok(catalog.search(query).total > 0, query);
});

test("saved exact branded products rank ahead of generic aliases without a generic label", () => {
  // Saved manual labels use existing USDA fixture values, never invented brand nutrition.
  const saved = parseCatalogFoodRecord({ customId: "saved-pepsi", name: "Pepsi Zero Sugar", brand: "Pepsi",
    category: "Saved drinks", per100g: dietCola.per100g, portions: [] });
  const combined = createFoodCatalog([...foods, saved]);
  const result = combined.search("Pepsi zero");
  assert.equal(result.items[0], saved);
  assert.ok(result.genericDrinkKeys.length > 0);
  assert.ok(!result.genericDrinkKeys.includes(foodKey(saved)));
  assert.ok(result.items.slice(1).every(food => food.category === "Diet soft drinks"));
  const pepper = parseCatalogFoodRecord({ customId: "saved-dr-pepper", name: "Cherry drink", brand: "Dr Pepper",
    category: "Saved drinks", per100g: dietCola.per100g, portions: [] });
  const pepperResult = createFoodCatalog([...foods, pepper]).search("Dr Pepper");
  assert.equal(pepperResult.items[0], pepper);
  assert.ok(!pepperResult.genericDrinkKeys.includes(foodKey(pepper)));
});

test("drink aliases keep the USDA food, nutrition and weighed-gram portions unchanged", () => {
  const original = foods.find(food => food.fdcId === 2710541);
  assert.ok(original);
  const matched = catalog.search("Pepsi").items.find(food => food.fdcId === original.fdcId);
  assert.equal(matched, original);
  assert.equal(matched?.name, "Soft drink, cola");
  assert.equal(matched?.brand, undefined);
  assert.equal(catalog.getById(2710541), original);
  assert.equal(nutritionForGrams(original, 50).calories, (original.per100g?.calories ?? NaN) / 2);
  assert.equal(nutritionForGrams(original, 50).carbs, (original.per100g?.carbs ?? NaN) / 2);
});

test("aliases attach only to validated built-in records, never custom names or reused USDA IDs", () => {
  const original = foods.find(food => food.fdcId === 2710541);
  assert.ok(original);
  const unrelated: CatalogFood = { ...original, name: "Apple, raw", category: "Fruit" };
  const custom: CatalogFood = parseCatalogFoodRecord({ ...original, fdcId: undefined, customId: "custom-cola" });
  const branded: CatalogFood = { ...original, brand: "Other drink" };
  assert.equal(createFoodCatalog([unrelated, custom, branded]).search("Pepsi").total, 0);
});

test("generic alias labels and pagination contain only the results on the current page", () => {
  const saved = Array.from({ length: 25 }, (_, index) => parseCatalogFoodRecord({
    customId: `saved-${index}`, name: `Pepsi bottle ${String(index).padStart(2, "0")}`,
    category: "Saved drinks", per100g: dietCola.per100g, portions: [],
  }));
  const combined = createFoodCatalog([...foods, ...saved]);
  const first = combined.search("Pepsi", 0);
  const second = combined.search("Pepsi", 1);
  assert.equal(first.total, 29);
  assert.equal(second.total, 29);
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 9);
  assert.deepEqual(first.genericDrinkKeys, []);
  assert.equal(second.genericDrinkKeys.length, 4);
  assert.equal(new Set([...first.items, ...second.items].map(foodKey)).size, 29);
  assert.deepEqual(combined.search("", 0).genericDrinkKeys, []);
});

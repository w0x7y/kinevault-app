import assert from "node:assert/strict";
import test from "node:test";
import {
  customFoodFromDraft,
  parseCustomFoods,
  type CustomFoodDraft,
} from "../src/food/custom-model.ts";
import {
  createCustomFoodPersistence,
  customFoodStorageKey,
} from "../src/food/custom-persistence.ts";
import { createFoodCatalog, nutritionForGrams } from "../src/food/catalog.ts";
import { entryForFood, parseFoodLog } from "../src/food/log-model.ts";
import { sumDetailedNutrients } from "../src/daily/detailed-nutrition.ts";

const draft: CustomFoodDraft = {
  name: "  My oat bowl  ",
  servingGrams: "250",
  calories: "300",
  carbs: "40",
  protein: "12,5",
  fat: "10",
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function ready(initial: string | null = null) {
  let raw = initial;
  const storage = {
    async getItem(key: string) {
      assert.equal(key, customFoodStorageKey);
      return raw;
    },
    async setItem(key: string, value: string) {
      assert.equal(key, customFoodStorageKey);
      raw = value;
    },
  };
  let sequence = 0;
  const store = createCustomFoodPersistence({ storage, createId: () => `custom-${++sequence}` });
  store.start();
  await flush();
  return { store, storage, raw: () => raw };
}

test("custom foods normalize serving nutrition for search and log without a USDA identity", () => {
  const result = customFoodFromDraft(draft, "custom-one");
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected valid draft");
  const food = result.food;
  assert.equal(food.name, "My oat bowl");
  assert.equal(food.customId, "custom-one");
  assert.equal(food.fdcId, undefined);
  assert.deepEqual(food.per100g, { calories: 120, carbs: 16, protein: 5, fat: 4 });
  assert.deepEqual(food.portions, [{ label: "1 serving", grams: 250 }]);
  assert.equal(nutritionForGrams(food, 125).calories, 150);
  const catalog = createFoodCatalog([
    food,
    {
      fdcId: 1,
      name: "Oats",
      category: "Grains",
      per100g: { calories: 100, carbs: 10, protein: 5, fat: 2 },
      portions: [],
    },
  ]);
  assert.equal(catalog.search("oat bowl").items[0]?.customId, "custom-one");
  assert.equal(catalog.getById(1)?.name, "Oats");
  const entry = entryForFood({ id: "entry", food, grams: 125, meal: "lunch" });
  assert.equal(entry.customId, "custom-one");
  assert.equal(entry.calories, 150);
  assert.equal(entry.protein, 6.25);
  assert.equal(entry.details?.sodium, null);
  const document = { version: 1, days: { "2026-10-01": [entry] } };
  assert.deepEqual(parseFoodLog(JSON.stringify(document)), document);
  assert.equal(
    sumDetailedNutrients([entry], () => {
      throw new Error("Custom food must not look up USDA nutrients");
    }).fiber,
    null,
  );
  assert.throws(() =>
    parseFoodLog(JSON.stringify({ version: 1, days: { "2026-10-01": [{ ...entry, fdcId: 1 }] } })),
  );
});

test("custom food validation requires explicit macros, accepts zero and rejects invalid quantities", () => {
  for (const patch of [
    { name: " " },
    { name: "a".repeat(401) },
    { servingGrams: "0" },
    { servingGrams: "10001" },
    { calories: "" },
    { carbs: "" },
    { protein: "-1" },
    { fat: "1e3" },
    { calories: "Infinity" },
    { carbs: "4g" },
  ])
    assert.equal(customFoodFromDraft({ ...draft, ...patch }, "custom-one").ok, false);
  const result = customFoodFromDraft(
    { ...draft, calories: "0", carbs: "0", protein: ".5", fat: "0" },
    "custom-one",
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.food.per100g?.calories, 0);
});

test("custom foods with non-English names remain searchable", () => {
  for (const name of ["שיבולת שועל", "燕麦粥", "شوفان", "Crème d'avoine"]) {
    const result = customFoodFromDraft({ ...draft, name }, "custom-one");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(createFoodCatalog([result.food]).search(name).items[0]?.name, name);
  }
});

test("custom foods survive reload and invalid or duplicate stored records are rejected", async () => {
  const { store, raw } = await ready();
  assert.ok(await store.add(draft));
  const restored = await ready(raw());
  assert.deepEqual(restored.store.getSnapshot().state, store.getSnapshot().state);
  const document = parseCustomFoods(raw());
  for (const value of [
    { version: 2, foods: [] },
    { version: 1, foods: [document.foods[0], document.foods[0]] },
    { version: 1, foods: [{ ...document.foods[0], customId: "" }] },
    { version: 1, foods: [{ ...document.foods[0], fdcId: 1 }] },
    {
      version: 1,
      foods: [{ ...document.foods[0], per100g: { calories: -1, carbs: 1, protein: 1, fat: 1 } }],
    },
  ])
    assert.throws(() => parseCustomFoods(JSON.stringify(value)));
});

test("custom saves publish after durable success, block duplicates and preserve failed drafts for retry", async () => {
  const { store, storage, raw } = await ready();
  const write = storage.setItem;
  storage.setItem = async () => {
    throw new Error("disk full");
  };
  assert.equal(await store.add(draft), null);
  assert.equal(raw(), null);
  assert.equal(
    store.getSnapshot().error,
    "Couldn't save your custom food. Your values are still here. Try again.",
  );
  const gate = deferred<void>();
  storage.setItem = async (key, value) => {
    await gate.promise;
    await write(key, value);
  };
  const saving = store.add(draft);
  assert.equal(store.getSnapshot().saving, true);
  assert.deepEqual(store.getSnapshot().state, {
    kind: "ready",
    document: { version: 1, foods: [], meals: [] },
  });
  assert.equal(await store.add(draft), null);
  gate.resolve();
  assert.ok(await saving);
  assert.equal(parseCustomFoods(raw()).foods.length, 1);
  assert.equal(store.getSnapshot().error, null);
});

test("corrupt custom storage blocks creation and retry recovers without overwriting records", async () => {
  const { store, storage, raw } = await ready("corrupt");
  assert.equal(store.getSnapshot().state.kind, "error");
  assert.equal(await store.add(draft), null);
  assert.equal(raw(), "corrupt");
  await storage.setItem(customFoodStorageKey, JSON.stringify({ version: 1, foods: [] }));
  store.retryLoad();
  await flush();
  assert.ok(await store.add(draft));
});

test("invalid custom drafts use validation feedback and never write", async () => {
  const { store, raw } = await ready();
  assert.equal(await store.add({ ...draft, name: "" }), null);
  assert.equal(store.getSnapshot().error, "Check the name, amounts, and nutrition values.");
  assert.equal(raw(), null);
  assert.equal(store.getSnapshot().saving, false);
});

test("duplicate generated catalog identities fail canonical validation before writing", async () => {
  const { store, storage, raw } = await ready();
  const food = await store.add(draft);
  assert.ok(food);
  const saved = raw();
  const duplicate = createCustomFoodPersistence({ storage, createId: () => food.customId });
  duplicate.start();
  await flush();
  assert.equal(await duplicate.add(draft), null);
  assert.equal(
    duplicate.getSnapshot().error,
    "Couldn't save your custom food. Your values are still here. Try again.",
  );
  assert.equal(raw(), saved);
});

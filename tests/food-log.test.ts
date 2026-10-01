import assert from "node:assert/strict";
import test from "node:test";
import { parseFoodLog, entryForFood } from "../src/food/log-model.ts";
import { createFoodLogPersistence, foodLogStorageKey, type FoodLogStorage } from "../src/food/log-persistence.ts";
import type { CatalogFood } from "../src/food/catalog.ts";

const banana: CatalogFood = {
  fdcId: 2709224, name: "Banana, raw", category: "Bananas",
  per100g: { calories: 97, carbs: 22.7, protein: 0.74, fat: 0.28 }, portions: [],
};
const input = { date: "2026-10-01", food: banana, grams: 50, meal: "breakfast" } as const;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function memory(initial: string | null = null) {
  let raw = initial;
  const calls: string[] = [];
  const storage: FoodLogStorage = {
    async getItem(key) { assert.equal(key, foodLogStorageKey); calls.push("read"); return raw; },
    async setItem(key, value) { assert.equal(key, foodLogStorageKey); calls.push("write"); raw = value; },
  };
  return { storage, calls, raw: () => raw };
}
async function ready(initial: string | null = null) {
  const memoryStore = memory(initial);
  let counter = 0;
  const log = createFoodLogPersistence({ storage: memoryStore.storage, createId: () => `food-${++counter}` });
  log.start(); await flush();
  assert.equal(log.getSnapshot().state.kind, "ready");
  return { ...memoryStore, log };
}
function documentOf(log: ReturnType<typeof createFoodLogPersistence>) {
  const state = log.getSnapshot().state;
  if (state.kind !== "ready") throw new Error("Expected a loaded food log");
  return state.document;
}

test("logging snapshots nutrition for the chosen gram amount and meal", () => {
  assert.deepEqual(entryForFood({ id: "one", ...input }), {
    id: "one", name: "Banana, raw", meal: "breakfast", fdcId: 2709224, grams: 50,
    calories: 48.5, carbs: 11.35, protein: 0.37, fat: 0.14,
  });
  for (const grams of [0, -1, 10001, Infinity, NaN])
    assert.throws(() => entryForFood({ id: "one", ...input, grams }), RangeError);
});

test("logged foods round trip while invalid dates, meals, nutrition, and duplicate IDs fail", () => {
  const entry = entryForFood({ id: "one", ...input });
  const document = { version: 1, days: { "2026-10-01": [entry] } };
  assert.deepEqual(parseFoodLog(JSON.stringify(document)), document);
  assert.deepEqual(parseFoodLog(null), { version: 1, days: {} });
  for (const value of [
    { version: 2, days: {} }, { version: 1, days: [] },
    { version: 1, days: { "2026-02-30": [entry] } },
    ...[{ meal: "brunch" }, { grams: 0 }, { protein: -1 }, { calories: "97" }, { id: "" }]
      .map(patch => ({ version: 1, days: { "2026-10-01": [{ ...entry, ...patch }] } })),
    { version: 1, days: { "2026-10-01": [entry], "2026-10-02": [entry] } },
  ]) assert.throws(() => parseFoodLog(JSON.stringify(value)));
});

test("food logging persists separate dates and meals across a restart", async () => {
  const { log, raw } = await ready();
  assert.equal(await log.add(input), true);
  assert.equal(await log.add({ ...input, date: "2026-10-02", meal: "dinner", grams: 100 }), true);
  assert.equal(documentOf(log).days["2026-10-01"]?.[0]?.calories, 48.5);
  assert.equal(documentOf(log).days["2026-10-02"]?.[0]?.meal, "dinner");
  const restored = await ready(raw());
  assert.deepEqual(documentOf(restored.log), documentOf(log));
});

test("a pending food save publishes only after storage and blocks repeated writes", async () => {
  const { log, storage, calls, raw } = await ready();
  const gate = deferred<void>();
  const write = storage.setItem;
  storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const food = { ...banana, per100g: { ...banana.per100g } };
  const saving = log.add({ ...input, food });
  food.name = "Changed"; food.per100g.calories = 500;
  assert.equal(log.getSnapshot().saving, true);
  assert.deepEqual(documentOf(log).days, {});
  assert.equal(raw(), null);
  assert.equal(await log.add(input), false);
  assert.equal(await log.remove({ date: input.date, id: "food-1" }), false);
  log.retryLoad();
  assert.deepEqual(calls, ["read"]);
  gate.resolve(); assert.equal(await saving, true);
  assert.equal(documentOf(log).days[input.date]?.[0]?.name, "Banana, raw");
  assert.equal(documentOf(log).days[input.date]?.[0]?.calories, 48.5);
});

test("failed food writes preserve existing records and retry without duplicating the draft", async () => {
  const { log, storage, raw } = await ready();
  await log.add(input);
  const before = raw();
  const write = storage.setItem;
  storage.setItem = async () => { throw new Error("disk full"); };
  assert.equal(await log.add({ ...input, meal: "lunch" }), false);
  assert.equal(raw(), before);
  assert.equal(documentOf(log).days[input.date]?.length, 1);
  assert.ok(log.getSnapshot().error);
  storage.setItem = write;
  assert.equal(await log.add({ ...input, meal: "lunch" }), true);
  assert.equal(documentOf(log).days[input.date]?.length, 2);
  assert.equal(log.getSnapshot().error, null);
});

test("removing a food affects only that entry and persists only after a successful write", async () => {
  const { log, storage, raw } = await ready();
  await log.add(input);
  await log.add({ ...input, date: "2026-10-02" });
  const write = storage.setItem;
  storage.setItem = async () => { throw new Error("disk full"); };
  assert.equal(await log.remove({ date: input.date, id: "food-1" }), false);
  assert.equal(documentOf(log).days[input.date]?.length, 1);
  storage.setItem = write;
  assert.equal(await log.remove({ date: input.date, id: "food-1" }), true);
  assert.equal(documentOf(log).days[input.date]?.length ?? 0, 0);
  assert.equal(parseFoodLog(raw()).days["2026-10-02"]?.length, 1);
});

test("corrupt food storage blocks writes and retry can recover repaired data", async () => {
  const store = memory("corrupt");
  const log = createFoodLogPersistence({ storage: store.storage, createId: () => "one" });
  log.start(); await flush();
  assert.equal(log.getSnapshot().state.kind, "error");
  assert.equal(await log.add(input), false);
  assert.equal(store.raw(), "corrupt");
  await store.storage.setItem(foodLogStorageKey, JSON.stringify({ version: 1, days: {} }));
  log.retryLoad(); await flush();
  assert.equal(log.getSnapshot().state.kind, "ready");
  assert.equal(await log.add(input), true);
});

test("old food reads cannot overwrite a newer load or publish after stopping", async () => {
  const first = deferred<string | null>();
  const second = deferred<string | null>();
  let reads = 0;
  const store = memory();
  store.storage.getItem = () => ++reads === 1 ? first.promise : second.promise;
  const log = createFoodLogPersistence({ storage: store.storage, createId: () => "one" });
  log.start(); log.retryLoad();
  second.resolve(null); await flush();
  const loaded = log.getSnapshot();
  first.resolve("corrupt"); await flush();
  assert.equal(log.getSnapshot(), loaded);
  log.stop();
  assert.equal(await log.add(input), false);
});

test("a food write spanning stop and restart reloads the durable day without a competing write", async () => {
  const { log, storage, calls } = await ready();
  const gate = deferred<void>();
  const write = storage.setItem;
  storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const pending = log.add(input);
  log.stop(); log.start();
  assert.equal(log.getSnapshot().state.kind, "loading");
  assert.equal(await log.add({ ...input, date: "2026-10-02" }), false);
  assert.deepEqual(calls, ["read"]);
  gate.resolve(); assert.equal(await pending, false);
  await flush();
  assert.equal(documentOf(log).days[input.date]?.length, 1);
  assert.deepEqual(calls, ["read", "write", "read"]);
});

test("invalid food inputs never write a record", async () => {
  const { log, calls } = await ready();
  for (const patch of [{ date: "2026-02-30" }, { grams: 0 }, { grams: 10001 }])
    assert.equal(await log.add({ ...input, ...patch }), false);
  assert.deepEqual(calls, ["read"]);
  assert.deepEqual(documentOf(log).days, {});
});

test("editing scales saved nutrition and moves the meal without changing identity or another date", async () => {
  const { log, raw } = await ready();
  await log.add(input);
  await log.add({ ...input, date: "2026-10-02" });
  assert.equal(typeof log.edit, "function");
  assert.equal(await log.edit({ date: input.date, id: "food-1", grams: 100, meal: "dinner" }), true);
  const document = parseFoodLog(raw());
  assert.deepEqual(document.days[input.date], [{
    id: "food-1", name: "Banana, raw", fdcId: 2709224, grams: 100, meal: "dinner",
    calories: 97, carbs: 22.7, protein: 0.74, fat: 0.28,
  }]);
  assert.equal(document.days["2026-10-02"]?.[0]?.grams, 50);
  assert.deepEqual(documentOf((await ready(raw())).log), document);
});

test("editing publishes after a durable save and preserves the entry on failure for retry", async () => {
  const { log, storage, raw } = await ready();
  await log.add(input);
  assert.equal(typeof log.edit, "function");
  const before = raw();
  const write = storage.setItem;
  storage.setItem = async () => { throw new Error("disk full"); };
  const edit = { date: input.date, id: "food-1", grams: 100, meal: "lunch" } as const;
  assert.equal(await log.edit(edit), false);
  assert.equal(raw(), before);
  assert.equal(documentOf(log).days[input.date]?.[0]?.grams, 50);
  const gate = deferred<void>();
  storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const pending = log.edit(edit);
  assert.equal(documentOf(log).days[input.date]?.[0]?.grams, 50);
  assert.equal(await log.edit(edit), false);
  gate.resolve();
  assert.equal(await pending, true);
  assert.equal(documentOf(log).days[input.date]?.length, 1);
  assert.equal(documentOf(log).days[input.date]?.[0]?.grams, 100);
});

test("invalid or missing edit targets never overwrite another saved entry", async () => {
  const { log, calls, raw } = await ready();
  await log.add(input);
  assert.equal(typeof log.edit, "function");
  const before = raw();
  const edit = { date: input.date, id: "food-1", grams: 100, meal: "lunch" } as const;
  for (const patch of [{ date: "2026-02-30" }, { date: "2026-10-02" }, { id: "missing" }, { grams: 0 }, { grams: NaN }, { grams: 10001 }])
    assert.equal(await log.edit({ ...edit, ...patch }), false);
  assert.equal(raw(), before);
  assert.deepEqual(calls, ["read", "write"]);
});

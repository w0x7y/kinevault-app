import assert from "node:assert/strict";
import test from "node:test";
import { addWater, parseWaterLog, waterAmountFromText } from "../src/water/model.ts";
import { createWaterLogPersistence, waterLogStorageKey, type WaterLogStorage } from "../src/water/persistence.ts";

const date = "2026-10-01";
const otherDate = "2026-10-02";
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function memory(initial: string | null = null) {
  let raw = initial;
  const calls: string[] = [];
  const storage: WaterLogStorage = {
    async getItem(key) { assert.equal(key, waterLogStorageKey); calls.push("read"); return raw; },
    async setItem(key, value) { assert.equal(key, waterLogStorageKey); calls.push("write"); raw = value; },
  };
  return { storage, calls, raw: () => raw };
}
async function ready(initial: string | null = null) {
  const store = memory(initial);
  const log = createWaterLogPersistence({ storage: store.storage });
  log.start(); await flush();
  assert.equal(log.getSnapshot().state.kind, "ready");
  return { ...store, log };
}
function documentOf(log: ReturnType<typeof createWaterLogPersistence>) {
  const state = log.getSnapshot().state;
  if (state.kind !== "ready") throw new Error("Expected a loaded water log");
  return state.document;
}

test("water totals round trip, including zero, and unsupported or corrupt records fail", () => {
  const document = { version: 1, days: { [date]: 750, [otherDate]: 0 } };
  assert.deepEqual(parseWaterLog(JSON.stringify(document)), document);
  assert.deepEqual(parseWaterLog(null), { version: 1, days: {} });
  for (const raw of ["", "corrupt", "null", "[]", JSON.stringify({ version: 2, days: {} }),
    JSON.stringify({ version: 1, days: [] }), JSON.stringify({ version: 1, days: { "2026-02-30": 250 } }),
    ...[-1, 0.5, "250", null, Number.MAX_SAFE_INTEGER + 1].map(total => JSON.stringify({ version: 1, days: { [date]: total } })),
    `{"version":1,"days":{"${date}":1e309}}`,
  ]) assert.throws(() => parseWaterLog(raw));
});

test("water entry accepts only integer millilitres between 1 and 10000", () => {
  for (const [text, ml] of [["1", 1], ["250", 250], [" 500 ", 500], ["10000", 10000]] as const)
    assert.equal(waterAmountFromText(text), ml);
  for (const text of ["", " ", "0", "-1", "1.5", "10001", "NaN", "Infinity", "1e3", "250ml", "1,000", "+250"])
    assert.equal(waterAmountFromText(text), null);
  for (const ml of [0, -1, 0.5, 10001, Infinity, NaN])
    assert.throws(() => addWater(parseWaterLog(null), { date, ml }), RangeError);
  assert.throws(() => addWater(parseWaterLog(null), { date: "2026-02-30", ml: 250 }), RangeError);
  assert.throws(() => addWater({ version: 1, days: { [date]: Number.MAX_SAFE_INTEGER } }, { date, ml: 1 }), RangeError);
});

test("water increments only its captured date and persists across a restart", async () => {
  const { log, raw } = await ready();
  await log.add({ date, ml: 250 });
  await log.add({ date: otherDate, ml: 500 });
  await log.add({ date, ml: 100 });
  assert.deepEqual(documentOf(log).days, { [date]: 350, [otherDate]: 500 });
  const restored = await ready(raw());
  assert.deepEqual(documentOf(restored.log), documentOf(log));
});

test("a pending save keeps the previous total and rejects duplicate and competing-date writes", async () => {
  const { log, storage, calls, raw } = await ready();
  await log.add({ date, ml: 250 });
  const gate = deferred<void>();
  const write = storage.setItem;
  storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const input = { date, ml: 500 };
  const pending = log.add(input);
  input.date = otherDate; input.ml = 1000;
  assert.equal(log.getSnapshot().saving, true);
  assert.equal(documentOf(log).days[date], 250);
  assert.equal(parseWaterLog(raw()).days[date], 250);
  assert.equal(await log.add({ date, ml: 500 }), false);
  assert.equal(await log.add({ date: otherDate, ml: 500 }), false);
  log.retryLoad();
  assert.deepEqual(calls, ["read", "write"]);
  gate.resolve(); assert.equal(await pending, true);
  assert.deepEqual(documentOf(log).days, { [date]: 750 });
  assert.equal(log.getSnapshot().saving, false);
});

test("failed writes preserve the previous total and retry the same amount exactly once", async () => {
  const { log, storage, raw } = await ready();
  await log.add({ date, ml: 250 });
  const before = raw();
  const write = storage.setItem;
  storage.setItem = async () => { throw new Error("disk full"); };
  assert.equal(await log.add({ date, ml: 500 }), false);
  assert.equal(raw(), before);
  assert.equal(documentOf(log).days[date], 250);
  assert.ok(log.getSnapshot().error);
  assert.equal(log.getSnapshot().saving, false);
  storage.setItem = write;
  assert.equal(await log.add({ date, ml: 500 }), true);
  assert.equal(documentOf(log).days[date], 750);
  assert.equal(log.getSnapshot().error, null);
});

test("corruption and read failure block writes until retry loads valid durable data", async () => {
  for (const unreadable of ["corrupt", "read failure"]) {
    const store = memory(unreadable === "corrupt" ? unreadable : JSON.stringify({ version: 1, days: { [date]: 500 } }));
    const read = store.storage.getItem;
    if (unreadable === "read failure") store.storage.getItem = async () => { throw new Error("unavailable"); };
    const log = createWaterLogPersistence({ storage: store.storage });
    log.start(); await flush();
    assert.equal(log.getSnapshot().state.kind, "error");
    const before = store.raw();
    assert.equal(await log.add({ date, ml: 250 }), false);
    assert.equal(store.raw(), before);
    assert.ok(!store.calls.includes("write"));
    store.storage.getItem = read;
    if (unreadable === "corrupt") await store.storage.setItem(waterLogStorageKey, JSON.stringify({ version: 1, days: { [date]: 500 } }));
    log.retryLoad(); await flush();
    assert.equal(await log.add({ date, ml: 250 }), true);
    assert.equal(documentOf(log).days[date], 750);
  }
});

test("stale reads cannot replace a newer load or publish after stopping", async () => {
  const first = deferred<string | null>();
  const second = deferred<string | null>();
  const third = deferred<string | null>();
  let reads = 0;
  const store = memory();
  store.storage.getItem = () => [first, second, third][reads++]!.promise;
  const log = createWaterLogPersistence({ storage: store.storage });
  log.start(); log.retryLoad();
  second.resolve(JSON.stringify({ version: 1, days: { [date]: 500 } })); await flush();
  const loaded = log.getSnapshot();
  first.resolve("corrupt"); await flush();
  assert.equal(log.getSnapshot(), loaded);
  log.retryLoad();
  const loading = log.getSnapshot();
  log.stop(); third.resolve(null); await flush();
  assert.equal(log.getSnapshot(), loading);
  assert.equal(await log.add({ date, ml: 250 }), false);
});

test("an uncancelable write spanning stop and restart reloads its durable total before another write", async () => {
  const { log, storage, calls } = await ready();
  const gate = deferred<void>();
  const write = storage.setItem;
  storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const pending = log.add({ date, ml: 250 });
  log.stop(); log.start();
  assert.equal(log.getSnapshot().state.kind, "loading");
  assert.equal(await log.add({ date: otherDate, ml: 500 }), false);
  log.retryLoad();
  assert.deepEqual(calls, ["read"]);
  gate.resolve(); assert.equal(await pending, false);
  await flush();
  assert.deepEqual(documentOf(log).days, { [date]: 250 });
  assert.deepEqual(calls, ["read", "write", "read"]);
  assert.equal(await log.add({ date: otherDate, ml: 500 }), true);
  assert.deepEqual(documentOf(log).days, { [date]: 250, [otherDate]: 500 });
});

test("invalid dates, amounts and overflow never reach storage", async () => {
  const { log, calls, raw } = await ready(JSON.stringify({ version: 1, days: { [date]: Number.MAX_SAFE_INTEGER } }));
  const before = raw();
  for (const input of [{ date: "2026-02-30", ml: 250 }, ...[0, -1, 1.5, 10001, NaN, Infinity, 1].map(ml => ({ date, ml }))])
    assert.equal(await log.add(input), false);
  assert.deepEqual(calls, ["read"]);
  assert.equal(raw(), before);
});

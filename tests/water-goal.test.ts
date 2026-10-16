import assert from "node:assert/strict";
import test from "node:test";
import { createWaterGoalEdit } from "../src/water/goal-editing.ts";
import {
  parseWaterGoal,
  waterGoalFromText,
  waterGoalProgress,
  waterGoalRangeMessage,
} from "../src/water/goal-model.ts";
import {
  createWaterGoalPersistence,
  waterGoalStorageKey,
  type WaterGoalStorage,
} from "../src/water/goal-persistence.ts";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const encode = (dailyMl: number | null) => JSON.stringify({ version: 1, dailyMl });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function memory(initial: string | null = null) {
  let raw = initial;
  const calls: string[] = [];
  const external = new Set<() => void>();
  const storage: WaterGoalStorage = {
    async getItem(key) {
      assert.equal(key, waterGoalStorageKey);
      calls.push("read");
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, waterGoalStorageKey);
      calls.push("write");
      raw = value;
    },
    subscribeItem(key, listener) {
      assert.equal(key, waterGoalStorageKey);
      external.add(listener);
      return () => {
        external.delete(listener);
      };
    },
  };
  // Another device replaces the durable goal and notifies this one.
  async function replace(next: string) {
    raw = next;
    for (const listener of external) listener();
    await flush();
  }
  return { storage, calls, raw: () => raw, replace };
}
async function ready(initial: string | null = null) {
  const store = memory(initial);
  const goal = createWaterGoalPersistence({ storage: store.storage });
  goal.start();
  await flush();
  return { ...store, goal };
}
function mlOf(goal: ReturnType<typeof createWaterGoalPersistence>) {
  const state = goal.getSnapshot().state;
  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") throw new Error("Goal is not loaded");
  return state.document.dailyMl;
}

test("missing and legacy empty goals become 1500 ml and valid custom goals round trip", () => {
  assert.deepEqual(parseWaterGoal(null), { version: 1, dailyMl: 1500 });
  assert.deepEqual(parseWaterGoal(encode(null)), { version: 1, dailyMl: 1500 });
  for (const ml of [1, 2000, 10000]) assert.equal(parseWaterGoal(encode(ml)).dailyMl, ml);
  for (const raw of [
    "",
    "broken",
    "null",
    "[]",
    '{"version":2,"dailyMl":2000}',
    '{"version":1}',
    ...[0, -1, 1.5, 10001, "2000", true].map((ml) => JSON.stringify({ version: 1, dailyMl: ml })),
  ])
    assert.throws(() => parseWaterGoal(raw));
  for (const [text, ml] of [
    ["1", 1],
    [" 2000 ", 2000],
    ["10000", 10000],
  ] as const)
    assert.equal(waterGoalFromText(text), ml);
  for (const text of ["", " ", "0", "1.5", "10001", "2e3", "2,000", "+2000", "2000 ml"])
    assert.equal(waterGoalFromText(text), null);
});

test("goal progress fills to the rim, caps above goal, and leaves unknown totals unknown", () => {
  assert.equal(waterGoalProgress(0, 2000), 0);
  assert.equal(waterGoalProgress(500, 2000), 0.25);
  assert.equal(waterGoalProgress(2000, 2000), 1);
  assert.equal(waterGoalProgress(2500, 2000), 1);
  assert.equal(waterGoalProgress(null, 2000), null);
  assert.equal(waterGoalProgress(500, null), null);
  for (const amount of [-1, NaN, Infinity]) assert.equal(waterGoalProgress(amount, 2000), null);
});

test("default and custom goals survive restart in their independent document", async () => {
  const { goal, raw } = await ready();
  assert.equal(mlOf(goal), 1500);
  assert.equal(await goal.setGoal(2000), true);
  assert.equal(mlOf((await ready(raw())).goal), 2000);
  assert.equal(await goal.setGoal(1500), true);
  assert.equal(mlOf((await ready(raw())).goal), 1500);
  assert.equal(mlOf((await ready(encode(null))).goal), 1500);
});

test("pending and failed goal writes preserve the saved value and permit retry", async () => {
  const { goal, storage, raw, calls } = await ready(encode(1500));
  const gate = deferred<void>();
  const write = storage.setItem;
  storage.setItem = async (key, value) => {
    await gate.promise;
    await write(key, value);
  };
  const pending = goal.setGoal(2000);
  assert.equal(goal.getSnapshot().saving, true);
  assert.equal(mlOf(goal), 1500);
  assert.equal(await goal.setGoal(2500), false);
  goal.retryLoad();
  assert.deepEqual(calls, ["read"]);
  gate.resolve();
  assert.equal(await pending, true);
  const saved = raw();
  storage.setItem = async () => {
    throw new Error("disk full");
  };
  assert.equal(await goal.setGoal(2500), false);
  assert.equal(raw(), saved);
  assert.equal(mlOf(goal), 2000);
  assert.equal(goal.getSnapshot().error, "Couldn't save your water goal. Try again.");
  assert.equal(goal.getSnapshot().saving, false);
  storage.setItem = write;
  assert.equal(await goal.setGoal(2500), true);
  assert.equal(mlOf(goal), 2500);
  assert.equal(goal.getSnapshot().error, null);
});

test("unreadable goal data blocks writes until a successful retry", async () => {
  for (const corruption of [true, false]) {
    const store = memory(corruption ? "broken" : encode(2000));
    const read = store.storage.getItem;
    if (!corruption)
      store.storage.getItem = async () => {
        throw new Error("unavailable");
      };
    const goal = createWaterGoalPersistence({ storage: store.storage });
    goal.start();
    await flush();
    assert.equal(goal.getSnapshot().state.kind, "error");
    assert.equal(await goal.setGoal(1000), false);
    assert.ok(!store.calls.includes("write"));
    store.storage.getItem = read;
    if (corruption) await store.storage.setItem(waterGoalStorageKey, encode(2000));
    goal.retryLoad();
    await flush();
    assert.equal(mlOf(goal), 2000);
  }
});

test("invalid goals never reach durable storage", async () => {
  const { goal, raw, calls } = await ready(encode(1500));
  for (const ml of [null, undefined, 0, -1, 1.5, 10001, NaN, Infinity, "2000"])
    assert.equal(await goal.setGoal(ml as number), false);
  assert.deepEqual(calls, ["read"]);
  assert.equal(raw(), encode(1500));
  assert.equal(mlOf(goal), 1500);
});

async function editing(initial: string | null = encode(1500)) {
  const store = await ready(initial);
  const edit = createWaterGoalEdit(store.goal);
  edit.start();
  return { ...store, edit };
}

// The edit lifecycle (exclusion, feedback ownership, stale completions) is
// covered once in document-edit.test.ts.
test("an untouched goal draft follows the saved goal, including after its own save", async () => {
  const { edit, goal, replace } = await editing();
  assert.equal(edit.getSnapshot().draft, "1500");
  await replace(encode(2500));
  assert.equal(edit.getSnapshot().draft, "2500");
  assert.equal(edit.change("1800"), true);
  await replace(encode(3000));
  assert.equal(edit.getSnapshot().draft, "1800");
  assert.equal(edit.cancel(), true);
  assert.equal(edit.getSnapshot().draft, "3000");
  edit.change(" 2000 ");
  assert.equal(await edit.save(), true);
  assert.equal(mlOf(goal), 2000);
  assert.equal(edit.getSnapshot().draft, "2000");
  assert.equal(edit.getSnapshot().saved, true);
  await replace(encode(2200));
  assert.equal(edit.getSnapshot().draft, "2200");
});

test("invalid goal text shows the range message and never writes", async () => {
  const { edit, calls } = await editing();
  for (const text of ["", "0", "1.5", "10001", "2e3", "2,000"]) {
    edit.change(text);
    assert.equal(edit.getSnapshot().error, null);
    assert.equal(await edit.save(), false);
    assert.equal(edit.getSnapshot().error, waterGoalRangeMessage);
  }
  assert.equal(waterGoalRangeMessage, "Enter a whole number from 1 to 10,000 ml.");
  assert.deepEqual(calls, ["read"]);
});

test("a failed goal save reports the water goal message and keeps the entered goal", async () => {
  const { edit, goal, storage } = await editing();
  storage.setItem = async () => {
    throw new Error("disk full");
  };
  edit.change("2000");
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().error, "Couldn't save your water goal. Try again.");
  assert.equal(edit.getSnapshot().draft, "2000");
  assert.equal(mlOf(goal), 1500);
});

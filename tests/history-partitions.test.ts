import assert from "node:assert/strict";
import test from "node:test";
import {
  partitionHistory,
  assembleHistory,
  createPartitionedLocalStorage,
} from "../src/account/history-partitions.ts";
import { createAccountStorage, type CloudDocument } from "../src/account/storage.ts";
import { createFoodLogPersistence } from "../src/food/log-persistence.ts";

const foodKey = "kinevault-track.food-log.v1";
const exerciseKey = "kinevault-track.exercise.v1";
const session = (id: string, date: string, status = "planned") => ({
  id,
  date,
  name: id,
  status,
  startedAt: status === "active" ? 100 : null,
  durationSeconds: null,
  exercises: [],
});
const exercise = (sessions: unknown[]) =>
  JSON.stringify({ version: 1, exercises: [], workouts: [], sessions });
function memory() {
  const values = new Map<string, string>(),
    writes: string[] = [];
  let fail: string | null = null;
  return {
    values,
    writes,
    failNext: (key: string) => {
      fail = key;
    },
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      if (key === fail) {
        fail = null;
        throw new Error("Disk full");
      }
      writes.push(key);
      values.set(key, value);
    },
    async removeItem(key: string) {
      values.delete(key);
    },
  };
}

test("editing a workout writes only its month and preserves history order, libraries, and active timer", async () => {
  const local = memory(),
    storage = createPartitionedLocalStorage(local);
  const original = exercise([
    session("september", "2026-09-30"),
    session("january", "2026-01-01"),
    session("active", "2026-10-08", "active"),
  ]);
  await storage.setItem(exerciseKey, original);
  assert.equal(await storage.getItem(exerciseKey), original);
  local.writes.length = 0;
  const edited = JSON.parse(original);
  edited.sessions[2].name = "Active workout edited";
  await storage.setItem(exerciseKey, JSON.stringify(edited));
  assert.equal(local.writes.length, 2);
  assert.match(local.writes[0]!, /2026-10/);
  assert.equal(await storage.getItem(exerciseKey), JSON.stringify(edited));
  const restarted = createPartitionedLocalStorage({
    getItem: local.getItem,
    setItem: local.setItem,
    removeItem: local.removeItem,
  });
  assert.equal(await restarted.getItem(exerciseKey), JSON.stringify(edited));
});

test("a failed manifest commit leaves the previous history intact after restart", async () => {
  const local = memory(),
    storage = createPartitionedLocalStorage(local);
  const before = exercise([session("old", "2026-09-01")]);
  await storage.setItem(exerciseKey, before);
  local.failNext(exerciseKey);
  await assert.rejects(storage.setItem(exerciseKey, exercise([session("old", "2026-10-01")])));
  const restarted = createPartitionedLocalStorage({
    getItem: local.getItem,
    setItem: local.setItem,
    removeItem: local.removeItem,
  });
  assert.equal(await restarted.getItem(exerciseKey), before);
});

test("deleting an earlier session changes only that month and does not rewrite later history", async () => {
  const local = memory(),
    storage = createPartitionedLocalStorage(local);
  await storage.setItem(
    exerciseKey,
    exercise([
      session("first", "2026-01-01"),
      session("second", "2026-05-01"),
      session("third", "2026-10-01"),
    ]),
  );
  local.writes.length = 0;
  const after = exercise([session("second", "2026-05-01"), session("third", "2026-10-01")]);
  await storage.setItem(exerciseKey, after);
  assert.deepEqual(local.writes, [exerciseKey]);
  assert.equal(await storage.getItem(exerciseKey), after);
});

test("legacy dirty envelopes migrate losslessly and account-scoped fragments stay isolated", async () => {
  const local = memory(),
    a = `kinevault-track.account.a.${exerciseKey}`,
    b = `kinevault-track.account.b.${exerciseKey}`;
  const envelope = JSON.stringify({
    version: 1,
    payload: exercise([session("pending", "2026-09-01", "active")]),
    revision: 4,
    dirty: true,
    sequence: 7,
  });
  local.values.set(a, envelope);
  const storage = createPartitionedLocalStorage(local);
  assert.deepEqual(JSON.parse((await storage.getItem(a))!), JSON.parse(envelope));
  await storage.setItem(a, envelope);
  assert.deepEqual(JSON.parse((await storage.getItem(a))!), JSON.parse(envelope));
  assert.equal(await storage.getItem(b), null);
  assert.equal(JSON.parse(local.values.get(a)!).historyFormat, 2);
});

test("corrupt or missing fragments reject reads and a valid replacement recovers the document", async () => {
  const local = memory(),
    storage = createPartitionedLocalStorage(local),
    key = `kinevault-track.account.a.${exerciseKey}`;
  const envelope = JSON.stringify({
    version: 1,
    payload: exercise([session("one", "2026-09-01")]),
    revision: 3,
    dirty: true,
    sequence: 9,
  });
  await storage.setItem(key, envelope);
  const root = JSON.parse(local.values.get(key)!);
  local.values.delete(root.refs["2026-09"]);
  const restarted = createPartitionedLocalStorage({
    getItem: local.getItem,
    setItem: local.setItem,
    removeItem: local.removeItem,
  });
  await assert.rejects(restarted.getItem(key));
  const reset = JSON.stringify({
    version: 1,
    payload: null,
    revision: 3,
    dirty: true,
    sequence: 10,
  });
  await restarted.setItem(key, reset);
  assert.deepEqual(JSON.parse((await restarted.getItem(key))!), JSON.parse(reset));
});

test("food days preserve their insertion order and reject out-of-month or duplicate record corruption", () => {
  const food = JSON.stringify({
    version: 1,
    days: { "2026-10-01": [], "2026-01-01": [], "2026-10-03": [] },
  });
  const parts = partitionHistory(foodKey, food);
  assert.equal(assembleHistory(foodKey, parts), food);
  const wrongMonth: Record<string, string> = { ...parts, "2026-05": parts["2026-01"]! };
  delete wrongMonth["2026-01"];
  assert.throws(() => assembleHistory(foodKey, wrongMonth));
});

test("AccountStorage can reset or replace corrupt fragments without losing cloud CAS metadata", async () => {
  for (const replacement of [null, exercise([session("repaired", "2026-10-01")])]) {
    const local = memory(),
      scoped = `kinevault-track.account.a.${exerciseKey}`;
    const rows = new Map<string, CloudDocument>([
      [
        exerciseKey,
        {
          document_key: exerciseKey,
          payload: exercise([session("old", "2026-09-01")]),
          revision: 5,
        },
      ],
    ]);
    const remote = {
      async list() {
        return [...rows.values()];
      },
      async save(key: string, payload: string | null, revision: number) {
        if (rows.get(key)?.revision !== revision) return null;
        const row = { document_key: key, payload, revision: revision + 1 };
        rows.set(key, row);
        return row;
      },
    };
    const first = createAccountStorage({ userId: "a", local, remote });
    await first.start();
    first.stop();
    const root = JSON.parse(local.values.get(scoped)!);
    local.values.delete(root.refs["2026-09"]);
    const restartedLocal = {
      getItem: local.getItem,
      setItem: local.setItem,
      removeItem: local.removeItem,
    };
    const store = createAccountStorage({ userId: "a", local: restartedLocal, remote });
    await store.start();
    assert.equal(store.getSnapshot().state, "error");
    if (replacement === null) await store.removeItem(exerciseKey);
    else await store.setItem(exerciseKey, replacement);
    await store.retry();
    assert.equal(await store.getItem(exerciseKey), replacement);
    assert.equal(rows.get(exerciseKey)?.payload, replacement);
    assert.equal(rows.get(exerciseKey)?.revision, 6);
    store.stop();
  }
});

test("accepted prototype-looking session IDs round trip and remain editable", async () => {
  const local = memory(),
    storage = createPartitionedLocalStorage(local);
  const original = exercise([
    session("__proto__", "2026-09-01"),
    session("constructor", "2026-10-01"),
    session("toString", "2026-01-01"),
  ]);
  await storage.setItem(exerciseKey, original);
  assert.equal(await storage.getItem(exerciseKey), original);
  const edited = JSON.parse(original);
  edited.sessions[0].name = "Edited prototype ID";
  await storage.setItem(exerciseKey, JSON.stringify(edited));
  assert.equal(await storage.getItem(exerciseKey), JSON.stringify(edited));
});

test("the public food log persists edits by month and removes only the deleted entry across restart", async () => {
  const local = memory(),
    account = createAccountStorage({ userId: "a", local, remote: null });
  await account.start();
  let sequence = 0;
  const log = createFoodLogPersistence({ storage: account, createId: () => `entry-${++sequence}` });
  log.start();
  for (let index = 0; index < 50; index++) await Promise.resolve();
  const food = {
    fdcId: 2709224,
    name: "Banana",
    category: "Fruit",
    per100g: { calories: 97, carbs: 22.7, protein: 0.74, fat: 0.28 },
    portions: [],
  };
  assert.equal(await log.add({ date: "2026-01-01", food, grams: 100, meal: "breakfast" }), true);
  assert.equal(await log.add({ date: "2026-10-01", food, grams: 100, meal: "lunch" }), true);
  local.writes.length = 0;
  assert.equal(
    await log.edit({ date: "2026-10-01", id: "entry-2", grams: 50, meal: "dinner" }),
    true,
  );
  assert.equal(local.writes.length, 2);
  assert.match(local.writes[0]!, /2026-10/);
  local.writes.length = 0;
  assert.equal(await log.remove({ date: "2026-01-01", id: "entry-1" }), true);
  assert.equal(local.writes.length, 1);
  log.stop();
  account.stop();
  const restarted = createAccountStorage({ userId: "a", local, remote: null });
  await restarted.start();
  const restored = JSON.parse((await restarted.getItem(foodKey))!);
  assert.deepEqual(Object.keys(restored.days), ["2026-10-01"]);
  assert.equal(restored.days["2026-10-01"][0].calories, 48.5);
  restarted.stop();
});

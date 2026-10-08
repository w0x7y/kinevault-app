import assert from "node:assert/strict";
import test from "node:test";
import { parseProfile } from "../src/profile/model.ts";
import {
  createProfilePersistence,
  profileStorageKey,
  type ProfileStorage,
} from "../src/profile/persistence.ts";
import { calorieState } from "../src/profile/calories.ts";
import { emptyAnswers } from "../src/profile/answers.ts";
import {
  parseWeightEntries,
  saveWeightEntry,
  validateWeightEntry,
  weightFromInput,
  weightTrend,
} from "../src/profile/weight-model.ts";

const complete = {
  version: 1,
  kind: "complete",
  answers: {
    ...emptyAnswers,
    name: "Weight fixture",
    age: "30",
    height: "180",
    weight: "80",
    eligible: true,
    estimateEnabled: true,
    sex: "male",
    goal: "maintain",
    activity: "moderate",
    customCalories: "2200",
    customProtein: "125",
  },
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
async function ready(initial = JSON.stringify(complete)) {
  let raw: string | null = initial;
  let fail = false;
  let readsFail = false;
  let writes = 0;
  let itemListener: (() => void) | undefined;
  const storage: ProfileStorage = {
    async getItem(key) {
      assert.equal(key, profileStorageKey);
      if (readsFail) throw new Error("read failure");
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, profileStorageKey);
      writes++;
      if (fail) throw new Error("disk failure");
      raw = value;
    },
    async removeItem() {
      raw = null;
    },
    subscribeItem(_key, listener) {
      itemListener = listener;
      return () => {
        itemListener = undefined;
      };
    },
  };
  const store = createProfilePersistence(storage);
  store.start();
  await flush();
  function document() {
    const state = store.getSnapshot().state;
    assert.equal(state.kind, "ready");
    if (state.kind !== "ready") throw new Error("Not ready");
    return state.document;
  }
  return {
    store,
    storage,
    document,
    raw: () => raw,
    writes: () => writes,
    fail: (value: boolean) => {
      fail = value;
    },
    readsFail: (value: boolean) => {
      readsFail = value;
    },
    external: (value: string) => {
      raw = value;
      itemListener?.();
    },
  };
}

test("weight inputs validate real calendar dates and finite metric values", () => {
  assert.deepEqual(validateWeightEntry("2024-02-29", 70.25), { date: "2024-02-29", kg: 70.25 });
  for (const date of ["2026-02-29", "2026-13-01", "10/08/2026", "2026-1-01", ""])
    assert.throws(() => validateWeightEntry(date, 80), /date/);
  for (const kg of [0, -1, 0.99, 500.01, 80.123, NaN, Infinity, "80"])
    assert.throws(() => validateWeightEntry("2026-10-08", kg), /weight/);
  assert.equal(weightFromInput(" 80,25 "), 80.25);
  for (const value of ["", "Infinity", "80kg", "1e2", "80.123", "500.01", "0"])
    assert.throws(() => weightFromInput(value));
});

test("date identity replaces duplicates and moves edits into chronological order", () => {
  const saved = saveWeightEntry(
    [
      { date: "2026-10-08", kg: 80 },
      { date: "2026-10-01", kg: 82 },
    ],
    { date: "2026-10-04", kg: 81 },
  );
  assert.deepEqual(
    saved.map((entry) => entry.date),
    ["2026-10-01", "2026-10-04", "2026-10-08"],
  );
  assert.equal(saveWeightEntry(saved, { date: "2026-10-04", kg: 80.5 }).length, 3);
  assert.deepEqual(
    saveWeightEntry(saved, { previousDate: "2026-10-08", date: "2026-10-01", kg: 79 }),
    [
      { date: "2026-10-01", kg: 79 },
      { date: "2026-10-04", kg: 81 },
    ],
  );
  assert.throws(
    () => saveWeightEntry(saved, { previousDate: "2026-10-07", date: "2026-10-06", kg: 79 }),
    /changed/,
  );
  assert.throws(
    () =>
      parseWeightEntries([
        { date: "2026-10-01", kg: 80 },
        { date: "2026-10-01", kg: 81 },
      ]),
    /Duplicate/,
  );
  assert.throws(() => parseWeightEntries([{ date: "2026-10-01", kg: null }]));
});

test("trend uses calendar spacing, truthful missing dates, and stable empty/single/flat scales", () => {
  assert.deepEqual(weightTrend([]), { points: [], minimum: 0, maximum: 1, change: null });
  const single = weightTrend([{ date: "2026-10-08", kg: 80 }]);
  assert.equal(single.points[0]!.x, 0.5);
  assert.equal(single.change, null);
  assert.ok(single.maximum > single.minimum);
  const trend = weightTrend([
    { date: "2026-10-11", kg: 80 },
    { date: "2026-10-02", kg: 80 },
    { date: "2026-10-01", kg: 80 },
  ]);
  assert.deepEqual(
    trend.points.map((point) => point.x),
    [0, 0.1, 1],
  );
  assert.deepEqual(
    trend.points.map((point) => point.date),
    ["2026-10-01", "2026-10-02", "2026-10-11"],
  );
  assert.equal(trend.change, 0);
  assert.ok(trend.points.every((point) => Number.isFinite(point.y)));
  assert.equal(
    weightTrend([
      { date: "2026-10-01", kg: 80.3 },
      { date: "2026-10-02", kg: 80.1 },
    ]).change,
    -0.2,
  );
});

test("legacy profile hydration and ordinary answer edits preserve logged history and calorie policy", async () => {
  const fixture = await ready();
  assert.equal(fixture.document().weightEntries, undefined);
  const answers = { ...fixture.document().answers };
  const calories = calorieState(answers);
  assert.equal(await fixture.store.saveWeight({ date: "2026-10-08", kg: 79.5 }), true);
  assert.deepEqual(fixture.document().answers, answers);
  assert.deepEqual(calorieState(fixture.document().answers), calories);
  // An older caller's document has no history. Its answer save must keep it.
  const edited = parseProfile(JSON.stringify(complete));
  assert.equal(
    await fixture.store.save({ ...edited, answers: { ...edited.answers, name: "Renamed" } }),
    true,
  );
  assert.deepEqual(fixture.document().weightEntries, [{ date: "2026-10-08", kg: 79.5 }]);
  assert.equal(fixture.document().answers.customCalories, "2200");
  fixture.store.stop();
  fixture.store.start();
  await flush();
  assert.deepEqual(fixture.document().weightEntries, [{ date: "2026-10-08", kg: 79.5 }]);
  assert.equal(fixture.document().answers.name, "Renamed");
});

test("add/edit/delete publish only after durable success and failed writes preserve history", async () => {
  const fixture = await ready();
  assert.equal(await fixture.store.saveWeight({ date: "2026-10-08", kg: 80 }), true);
  const original = fixture.document(),
    raw = fixture.raw();
  fixture.fail(true);
  assert.equal(await fixture.store.saveWeight({ date: "2026-10-01", kg: 82 }), false);
  assert.equal(fixture.document(), original);
  assert.equal(fixture.raw(), raw);
  assert.equal(
    await fixture.store.saveWeight({ previousDate: "2026-10-08", date: "2026-10-08", kg: 79 }),
    false,
  );
  assert.equal(fixture.document(), original);
  assert.equal(await fixture.store.removeWeight("2026-10-08"), false);
  assert.equal(fixture.document(), original);
  assert.equal(fixture.raw(), raw);
  fixture.fail(false);
  assert.equal(await fixture.store.saveWeight({ date: "2026-10-01", kg: 82 }), true);
  assert.equal(await fixture.store.saveWeight({ date: "2026-10-08", kg: 79 }), true);
  assert.deepEqual(fixture.document().weightEntries, [
    { date: "2026-10-01", kg: 82 },
    { date: "2026-10-08", kg: 79 },
  ]);
  assert.equal(await fixture.store.removeWeight("2026-10-08"), true);
  assert.deepEqual(fixture.document().weightEntries, [{ date: "2026-10-01", kg: 82 }]);
  const writes = fixture.writes();
  assert.equal(await fixture.store.saveWeight({ date: "2026-02-29", kg: 80 }), false);
  assert.equal(await fixture.store.saveWeight({ date: "2026-10-02", kg: NaN }), false);
  assert.equal(await fixture.store.removeWeight("2026-10-08"), false);
  assert.equal(fixture.writes(), writes);
});

test("pending weight saves exclude competing profile writes and retain prior visible values", async () => {
  const fixture = await ready();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const originalWrite = fixture.storage.setItem;
  fixture.storage.setItem = async (key, value) => {
    await gate;
    await originalWrite(key, value);
  };
  const pending = fixture.store.saveWeight({ date: "2026-10-08", kg: 80 });
  assert.equal(fixture.store.getSnapshot().saving, true);
  assert.equal(fixture.document().weightEntries, undefined);
  assert.equal(await fixture.store.saveWeight({ date: "2026-10-01", kg: 82 }), false);
  assert.equal(await fixture.store.save(fixture.document()), false);
  release();
  assert.equal(await pending, true);
  assert.deepEqual(fixture.document().weightEntries, [{ date: "2026-10-08", kg: 80 }]);
});

test("external account document reloads history and blocks writes until failed refresh recovers", async () => {
  const fixture = await ready();
  fixture.readsFail(true);
  fixture.external(
    JSON.stringify({ ...complete, weightEntries: [{ date: "2026-10-04", kg: 81 }] }),
  );
  await flush();
  assert.ok(fixture.store.getSnapshot().refreshError);
  assert.equal(await fixture.store.saveWeight({ date: "2026-10-08", kg: 80 }), false);
  fixture.readsFail(false);
  fixture.store.retryLoad();
  await flush();
  assert.equal(fixture.store.getSnapshot().refreshError, null);
  assert.deepEqual(fixture.document().weightEntries, [{ date: "2026-10-04", kg: 81 }]);
  assert.equal(await fixture.store.saveWeight({ date: "2026-10-08", kg: 80 }), true);
  assert.equal(fixture.document().weightEntries?.length, 2);
});

test("corrupt weight history requires profile recovery and never silently removes measurements", async () => {
  const raw = JSON.stringify({ ...complete, weightEntries: [{ date: "2026-02-29", kg: 80 }] });
  const fixture = await ready(raw);
  assert.equal(fixture.store.getSnapshot().state.kind, "error");
  assert.equal(await fixture.store.saveWeight({ date: "2026-10-08", kg: 80 }), false);
  assert.equal(fixture.raw(), raw);
});

test("legacy age recovery retains measurements while returning setup to the age question", () => {
  const weightEntries = [{ date: "2026-10-08", kg: 80 }];
  const document = parseProfile(
    JSON.stringify({ ...complete, answers: { ...complete.answers, age: "" }, weightEntries }),
  );
  assert.equal(document.kind, "draft");
  if (document.kind === "draft") assert.equal(document.step, "age");
  assert.deepEqual(document.weightEntries, weightEntries);
  assert.equal(document.answers.customCalories, "2200");
});

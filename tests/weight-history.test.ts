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
  const storage: ProfileStorage = {
    async getItem(key) {
      assert.equal(key, profileStorageKey);
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, profileStorageKey);
      raw = value;
    },
    async removeItem() {
      raw = null;
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
  return { store, document, raw: () => raw };
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

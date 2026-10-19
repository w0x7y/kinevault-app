import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseSet } from "../src/exercise/model.ts";
import {
  createEmptySet,
  isBlankSet,
  setHint,
  setLines,
  setMeasurements,
  trackingMode,
  trackingModes,
  withSetValue,
} from "../src/exercise/tracking.ts";

const single: ExerciseSet = { id: "s", kind: "single", reps: "8", weightKg: "20" };
const sides: ExerciseSet = {
  id: "d",
  kind: "sides",
  left: { reps: "8", weightKg: "10" },
  right: { reps: "", weightKg: "" },
};
const timed: ExerciseSet = { id: "t", kind: "time", seconds: "40" };

test("every mode's empty set is blank, has the mode's kind and one value per column", () => {
  for (const mode of trackingModes) {
    const set = createEmptySet(mode, "x");
    assert.equal(set.kind, mode);
    assert.ok(isBlankSet(set), mode);
    const fields = trackingMode(mode).columns.map((column) => column.field);
    for (const line of setLines(set)) assert.deepEqual(Object.keys(line.values), fields, mode);
    assert.equal(setLines(set).length, trackingMode(mode).sided ? 2 : 1, mode);
  }
  assert.equal(trackingMode("alternating").columns[0]!.label, "Reps/side");
  assert.equal(trackingMode("time").chartable, false);
});

test("an entered value lands only where the set holds it", () => {
  assert.deepEqual(withSetValue(single, null, "reps", "9"), { ...single, reps: "9" });
  assert.deepEqual(withSetValue(sides, "right", "weightKg", "12"), {
    ...sides,
    right: { reps: "", weightKg: "12" },
  });
  assert.deepEqual(withSetValue(timed, null, "seconds", "30"), { ...timed, seconds: "30" });
  // Values the set doesn't hold leave it as it was.
  assert.equal(withSetValue(single, null, "seconds", "9"), single);
  assert.equal(withSetValue(single, "left", "reps", "9"), single);
  assert.equal(withSetValue(sides, null, "reps", "9"), sides);
  assert.equal(withSetValue(timed, null, "reps", "9"), timed);
});

test("hints carry over between modes only the values the set holds", () => {
  const blankTime = createEmptySet("time", "x");
  assert.deepEqual(setHint(blankTime, timed), [{ side: null, values: { seconds: "40" } }]);
  assert.deepEqual(setHint(blankTime, single), [{ side: null, values: { seconds: undefined } }]);
  assert.deepEqual(setHint(createEmptySet("alternating", "x"), single), [
    { side: null, values: { reps: "8", weightKg: "20" } },
  ]);
  assert.deepEqual(setHint(createEmptySet("single", "x"), timed), [
    { side: null, values: { reps: undefined, weightKg: undefined } },
  ]);
  assert.deepEqual(setHint(createEmptySet("single", "x"), undefined), [
    { side: null, values: { reps: undefined, weightKg: undefined } },
  ]);
});

test("measurements count both sides of an alternating set and each side of a left/right set", () => {
  assert.deepEqual(setMeasurements({ ...single, kind: "alternating" }), {
    reps: 16,
    volume: 320,
    weights: [20],
    left: null,
    right: null,
    seconds: 0,
  });
  assert.deepEqual(setMeasurements(sides), {
    reps: 8,
    volume: 80,
    weights: [10],
    left: 10,
    right: null,
    seconds: 0,
  });
  assert.equal(setMeasurements(timed).seconds, 40);
  assert.equal(setMeasurements(timed).reps, 0);
  assert.throws(() => setMeasurements({ ...timed, seconds: "0" }), /seconds/);
  assert.throws(() => setMeasurements({ ...single, kind: "alternating", reps: "" }), /repetitions/);
});

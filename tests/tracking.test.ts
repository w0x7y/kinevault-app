import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseSet } from "../src/exercise/model.ts";
import {
  columnText,
  createEmptySet,
  distanceMessage,
  isBlankSet,
  setHint,
  setLines,
  setMeasurements,
  isWarmUp,
  timedSeconds,
  trackingMode,
  trackingModes,
  withHintValues,
  withSetValue,
  withWarmUp,
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
  // Reps in reserve follows the weight in every mode with reps, never on a timed set.
  for (const mode of ["single", "sides", "alternating"] as const)
    assert.deepEqual(
      trackingMode(mode)
        .columns.map((column) => columnText(column, "metric").label)
        .slice(1),
      ["Weight (kg)", "RIR"],
    );
  // The weight column names the chosen unit, short and spoken too.
  const [, weight] = trackingMode("single").columns;
  assert.deepEqual(columnText(weight!, "metric"), {
    label: "Weight (kg)",
    short: "Kg",
    name: "weight (kg)",
  });
  assert.deepEqual(columnText(weight!, "imperial"), {
    label: "Weight (lb)",
    short: "Lb",
    name: "weight (lb)",
  });
  assert.deepEqual(
    trackingMode("time").columns.map((column) => column.field),
    ["seconds"],
  );
});

test("an entered value lands only where the set holds it", () => {
  assert.deepEqual(withSetValue(single, null, "reps", "9"), { ...single, reps: "9" });
  assert.deepEqual(withSetValue(sides, "right", "weightKg", "12"), {
    ...sides,
    right: { reps: "", weightKg: "12" },
  });
  assert.deepEqual(withSetValue(timed, null, "seconds", "30"), { ...timed, seconds: "30" });
  assert.deepEqual(withSetValue(single, null, "rir", "2"), { ...single, rir: "2" });
  assert.deepEqual(withSetValue(sides, "left", "rir", "1"), {
    ...sides,
    left: { reps: "8", weightKg: "10", rir: "1" },
  });
  assert.equal(withSetValue(timed, null, "rir", "1"), timed);
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
    { side: null, values: { reps: "8", weightKg: "20", rir: undefined } },
  ]);
  assert.deepEqual(setHint(createEmptySet("single", "x"), { ...single, rir: "2" }), [
    { side: null, values: { reps: "8", weightKg: "20", rir: "2" } },
  ]);
  assert.deepEqual(setHint(createEmptySet("single", "x"), timed), [
    { side: null, values: { reps: undefined, weightKg: undefined, rir: undefined } },
  ]);
  assert.deepEqual(setHint(createEmptySet("single", "x"), undefined), [
    { side: null, values: { reps: undefined, weightKg: undefined, rir: undefined } },
  ]);
});

test("measurements count both sides of an alternating set and each side of a left/right set", () => {
  assert.deepEqual(setMeasurements({ ...single, kind: "alternating" }), {
    reps: 16,
    volume: 320,
    lifts: [{ reps: 8, weightKg: 20 }],
    left: null,
    right: null,
    seconds: 0,
    meters: 0,
  });
  assert.deepEqual(setMeasurements(sides), {
    reps: 8,
    volume: 80,
    lifts: [{ reps: 8, weightKg: 10 }],
    left: 10,
    right: null,
    seconds: 0,
    meters: 0,
  });
  assert.equal(setMeasurements(timed).seconds, 40);
  assert.equal(setMeasurements(timed).reps, 0);
  assert.throws(() => setMeasurements({ ...timed, seconds: "0" }), /seconds/);
  assert.throws(() => setMeasurements({ ...single, kind: "alternating", reps: "" }), /repetitions/);
});

test("RIR is optional, from 0 to 10, and never a set by itself", () => {
  assert.equal(setMeasurements({ ...single, rir: "" }).reps, 8);
  assert.equal(setMeasurements({ ...single, rir: " 0 " }).reps, 8);
  assert.equal(setMeasurements({ ...single, rir: "10" }).reps, 8);
  for (const rir of ["11", "1.5", "-1", "two"])
    assert.throws(() => setMeasurements({ ...single, rir }), /reps in reserve/, rir);
  // An RIR alone is entered, so it isn't dropped as blank, but it needs reps to complete.
  const rirOnly = { ...createEmptySet("single", "x"), rir: "2" };
  assert.equal(isBlankSet(rirOnly), false);
  assert.throws(() => setMeasurements(rirOnly), /repetitions/);
  assert.throws(
    () => setMeasurements({ ...sides, right: { reps: "", weightKg: "", rir: "2" } }),
    /repetitions/,
  );
  assert.throws(
    () => setMeasurements({ ...sides, left: { reps: "8", weightKg: "10", rir: "11" } }),
    /reps in reserve/,
  );
});

test("a timed set's seconds count only as 1 to 86,400 whole seconds", () => {
  const timed = (seconds: string): ExerciseSet => ({ id: "t", kind: "time", seconds });
  for (const [text, seconds] of [
    ["30", 30],
    [" 45 ", 45],
    ["86400", 86400],
    ["", null],
    ["0", null],
    ["30.5", null],
    ["1e2", null],
    ["86401", null],
  ] as const)
    assert.equal(timedSeconds(timed(text)), seconds, text);
  assert.equal(timedSeconds({ id: "s", kind: "single", reps: "5", weightKg: "40" }), null);
});

const cardio = (seconds: string, distanceMeters: string): ExerciseSet => ({
  id: "c",
  kind: "cardio",
  seconds,
  distanceMeters,
});

test("a cardio set holds seconds and a distance saved in meters", () => {
  assert.deepEqual(
    trackingMode("cardio").columns.map((column) => [
      column.field,
      columnText(column, "metric").label,
      columnText(column, "imperial").label,
    ]),
    [
      ["seconds", "Seconds", "Seconds"],
      ["distance", "Distance (km)", "Distance (mi)"],
    ],
  );
  assert.equal(trackingMode("cardio").clock, true);
  assert.equal(trackingMode("cardio").chartable, false);
  assert.equal(trackingMode("cardio").weighted, false);
  // The set table converts km or miles; the set holds meters.
  assert.deepEqual(withSetValue(cardio("", ""), null, "distance", "5250"), cardio("", "5250"));
  assert.deepEqual(withSetValue(cardio("", ""), null, "seconds", "90"), cardio("90", ""));
  assert.deepEqual(setLines(cardio("90", "5250")), [
    { side: null, values: { seconds: "90", distance: "5250" } },
  ]);
  // A field the set doesn't hold leaves it as it was.
  const blank = cardio("", "");
  assert.equal(withSetValue(blank, null, "reps", "9"), blank);
  assert.equal(withSetValue(timed, null, "distance", "5"), timed);
  assert.equal(withSetValue(single, null, "distance", "5"), single);
  // A timed hint carries its seconds to a cardio set, and a cardio hint fills its meters.
  assert.deepEqual(setHint(createEmptySet("cardio", "x"), timed), [
    { side: null, values: { seconds: "40", distance: undefined } },
  ]);
  const hint = setHint(createEmptySet("cardio", "x"), cardio("600", "2500"))[0]!;
  assert.deepEqual(hint.values, { seconds: "600", distance: "2500" });
  assert.deepEqual(withHintValues(createEmptySet("cardio", "x"), hint), {
    ...cardio("600", "2500"),
    id: "x",
  });
  assert.equal(timedSeconds(cardio("1800", "")), 1800);
  assert.equal(isBlankSet(cardio(" ", "")), true);
  assert.equal(isBlankSet(cardio("", "5000")), false);
});

test("a cardio set needs 1 to 86,400 seconds and an optional 0.01 to 1,000 km", () => {
  assert.deepEqual(setMeasurements(cardio("1800", "5250")), {
    reps: 0,
    volume: 0,
    lifts: [],
    left: null,
    right: null,
    seconds: 1800,
    meters: 5250,
  });
  assert.equal(setMeasurements(cardio("60", "")).meters, 0);
  assert.equal(setMeasurements(cardio("60", "10")).meters, 10);
  assert.equal(setMeasurements(cardio("60", "1000000")).meters, 1000000);
  for (const seconds of ["", "0", "86401", "1.5"])
    assert.throws(() => setMeasurements(cardio(seconds, "5000")), /seconds for each cardio set/);
  // 0 km, past 1,000 km, three decimals and text that isn't a number.
  for (const meters of ["0", "1000010", "5", "5255", "abc", "5255.5"])
    assert.throws(() => setMeasurements(cardio("60", meters)), /distance/, meters);
  // The message names the limits in either system's unit.
  assert.equal(
    distanceMessage("metric"),
    "Enter a distance from 0.01 to 1,000 km with up to two decimals, or leave it blank.",
  );
  assert.equal(
    distanceMessage("imperial"),
    "Enter a distance from 0.01 to 621.37 mi with up to two decimals, or leave it blank.",
  );
});

test("only weighted sets can be warm-ups, and the flag comes off cleanly", () => {
  const warm = withWarmUp(single, true);
  assert.deepEqual(warm, { ...single, warmUp: true });
  assert.equal(isWarmUp(warm), true);
  assert.equal(withWarmUp(warm, true), warm);
  assert.deepEqual(withWarmUp(warm, false), single);
  assert.equal(isWarmUp(single), false);
  assert.deepEqual(withWarmUp(sides, true), { ...sides, warmUp: true });
  assert.equal(withWarmUp(timed, true), timed);
  assert.equal(withWarmUp(cardio("60", ""), true).kind, "cardio");
  assert.equal(isWarmUp(withWarmUp(cardio("60", ""), true)), false);
  for (const mode of trackingModes)
    assert.equal(trackingMode(mode).weighted, mode !== "time" && mode !== "cardio", mode);
  // A warm-up still validates like any set.
  assert.throws(() => setMeasurements({ ...warm, reps: "" }), /repetitions/);
});

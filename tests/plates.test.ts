import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseSet } from "../src/exercise/model.ts";
import {
  barChoices,
  barWeight,
  parseBarKg,
  plateLines,
  plateLoading,
  platesPerSide,
} from "../src/exercise/plates.ts";

test("plates load each side heaviest first and report what no plates make up", () => {
  assert.deepEqual(platesPerSide(100, 20), { plates: [25, 15], remainder: 0 });
  assert.deepEqual(platesPerSide(142.5, 20), { plates: [25, 25, 10, 1.25], remainder: 0 });
  assert.deepEqual(platesPerSide(60, 15), { plates: [20, 2.5], remainder: 0 });
  assert.deepEqual(platesPerSide(20, 20), { plates: [], remainder: 0 });
  // 101 kg is 40.5 kg a side; 0.5 kg on each side can't be loaded.
  assert.deepEqual(platesPerSide(101, 20), { plates: [25, 15], remainder: 1 });
  assert.deepEqual(platesPerSide(21, 20), { plates: [], remainder: 1 });
  // Weights keep their grams: 61.234 kg leaves 1.234 kg over.
  assert.deepEqual(platesPerSide(61.234, 20), { plates: [20], remainder: 1.234 });
  assert.deepEqual(platesPerSide(50, 0), { plates: [25], remainder: 0 });
  assert.equal(platesPerSide(15, 20), null);
  assert.equal(platesPerSide(5, 10), null);
});

test("Imperial loads pound plates on the saved bar's pound counterpart", () => {
  assert.deepEqual(
    barChoices.map((bar) => barWeight(bar, "imperial")),
    [45, 35, 15, 0],
  );
  // 225 lb on a 45 lb bar is 90 lb a side.
  assert.deepEqual(platesPerSide(225, 20, "imperial"), { plates: [45, 45], remainder: 0 });
  assert.deepEqual(platesPerSide(185, 20, "imperial"), {
    plates: [45, 25],
    remainder: 0,
  });
  assert.deepEqual(platesPerSide(140, 15, "imperial"), {
    plates: [45, 5, 2.5],
    remainder: 0,
  });
  assert.deepEqual(platesPerSide(50, 0, "imperial"), { plates: [25], remainder: 0 });
  assert.equal(platesPerSide(40, 20, "imperial"), null);
  assert.deepEqual(plateLoading(137, 20, "imperial"), {
    plates: "45 lb per side",
    remainder: "2 lb can't be loaded",
  });
  assert.deepEqual(plateLoading(45, 20, "imperial"), { plates: "Just the bar", remainder: null });
});

test("the plates read as words, per side, with any leftover", () => {
  assert.deepEqual(plateLoading(100, 20), { plates: "25 kg + 15 kg per side", remainder: null });
  assert.deepEqual(plateLoading(102.5, 20), {
    plates: "25 kg + 15 kg + 1.25 kg per side",
    remainder: null,
  });
  assert.deepEqual(plateLoading(101, 20), {
    plates: "25 kg + 15 kg per side",
    remainder: "1 kg can't be loaded",
  });
  assert.deepEqual(plateLoading(20, 20), { plates: "Just the bar", remainder: null });
  assert.deepEqual(plateLoading(2, 0), { plates: "No plates", remainder: "2 kg can't be loaded" });
  assert.deepEqual(plateLoading(15, 20), { plates: "Lighter than the bar", remainder: null });
});

test("a saved bar is one of the choices, or none", () => {
  for (const bar of barChoices) assert.equal(parseBarKg(String(bar)), bar);
  for (const value of [null, "", "25", "20.0", " 20", "abc"]) assert.equal(parseBarKg(value), null);
});

test("every set line with a weight gets plates; blank, zero and invalid weights don't", () => {
  const sets: ExerciseSet[] = [
    { id: "w", kind: "single", reps: "10", weightKg: "40", warmUp: true },
    { id: "a", kind: "single", reps: "5", weightKg: "100" },
    { id: "b", kind: "single", reps: "5", weightKg: "" },
    { id: "c", kind: "single", reps: "5", weightKg: "0" },
    { id: "d", kind: "single", reps: "5", weightKg: "abc" },
    {
      id: "e",
      kind: "sides",
      left: { reps: "8", weightKg: "12.5" },
      right: { reps: "8", weightKg: "" },
    },
  ];
  assert.deepEqual(plateLines(sets), [
    { key: "w-set", name: "Set 1", warmUp: true, weight: 40 },
    { key: "a-set", name: "Set 2", warmUp: false, weight: 100 },
    { key: "e-left", name: "Set 6 left", warmUp: false, weight: 12.5 },
  ]);
  // Imperial loads the pounds the set shows, not the fraction its kilograms make.
  assert.deepEqual(
    plateLines([{ id: "p", kind: "single", reps: "5", weightKg: "61.235" }], "imperial"),
    [{ key: "p-set", name: "Set 1", warmUp: false, weight: 135 }],
  );
  assert.deepEqual(plateLoading(135, 20, "imperial"), {
    plates: "45 lb per side",
    remainder: null,
  });
});

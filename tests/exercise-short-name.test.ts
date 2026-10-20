import assert from "node:assert/strict";
import test from "node:test";
import { exerciseRowLabel, shortExerciseName } from "../src/exercise/short-name.ts";

test("names of several words become at most three initials", () => {
  assert.equal(shortExerciseName("Shoulder Press Machine (Wide Grip/Top Half)"), "SPM");
  assert.equal(shortExerciseName("dumbbell shoulder press"), "DSP");
  assert.equal(shortExerciseName("Single-leg Romanian deadlift"), "SLR");
  assert.equal(shortExerciseName("Barbell curls"), "BC");
  assert.equal(shortExerciseName("Unilateral Seated Machine Fly Dead Stop"), "USM");
});

test("a single word keeps its first three letters", () => {
  assert.equal(shortExerciseName("Squat"), "SQU");
  assert.equal(shortExerciseName("Hyperextensions"), "HYP");
  assert.equal(shortExerciseName("Row"), "ROW");
});

test("parenthetical parts are ignored before deciding", () => {
  assert.equal(shortExerciseName("Leg press (Machine)"), "LP");
  assert.equal(shortExerciseName("  Row   (cable, seated)  "), "ROW");
  assert.equal(shortExerciseName("Lat pulldown (wide"), "LP");
  assert.equal(shortExerciseName("Chest Fly (Pec Deck) Machine Low"), "CFM");
});

test("initials keep letters and digits only", () => {
  assert.equal(shortExerciseName("21s & Barbell Curl Drop Set"), "2BC");
  assert.equal(shortExerciseName("Ángel's Weighted Pull-Up"), "ÁWP");
});

test("labels count whole characters and skip a single word's punctuation", () => {
  assert.equal(shortExerciseName("'Curl'"), "CUR");
  assert.equal(shortExerciseName("ßquat"), "SSQ");
  assert.equal(shortExerciseName("💪💪💪💪"), "💪💪💪");
});

test("a name that is only a parenthetical uses its inner words", () => {
  assert.equal(shortExerciseName("(Warm-up)"), "WU");
});

test("a repeated exercise's accessible name adds its position", () => {
  const rows = ["Squat", "Curl", "Squat"].map((name, index) => ({
    id: String(index),
    exercise: { name },
  }));
  assert.deepEqual(
    rows.map((row, index) => exerciseRowLabel(rows, row, index)),
    ["Squat exercise 1", "Curl", "Squat exercise 3"],
  );
});

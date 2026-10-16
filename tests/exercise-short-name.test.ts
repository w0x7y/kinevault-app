import assert from "node:assert/strict";
import test from "node:test";
import { exerciseChipLabels, shortExerciseName } from "../src/exercise/short-name.ts";

test("long exercise names become the initials of their words", () => {
  assert.equal(shortExerciseName("Shoulder Press Machine (Wide Grip/Top Half)"), "SPM");
  assert.equal(shortExerciseName("Unilateral Seated Machine Row"), "USMR");
  assert.equal(shortExerciseName("dumbbell shoulder press"), "DSP");
  assert.equal(shortExerciseName("Single-leg Romanian deadlift"), "SLRD");
  assert.equal(shortExerciseName("Barbell curls"), "BC");
});

test("single words and names that fit stay as they are", () => {
  assert.equal(shortExerciseName("Squat"), "Squat");
  assert.equal(shortExerciseName("Bench press"), "Bench press");
  assert.equal(shortExerciseName("Barbell curl"), "Barbell curl");
  assert.equal(shortExerciseName("Hyperextensions"), "Hyperextensions");
  assert.equal(shortExerciseName("Push-up"), "Push-up");
});

test("parenthetical parts are ignored before deciding", () => {
  assert.equal(shortExerciseName("Leg press (Machine)"), "Leg press");
  assert.equal(shortExerciseName("  Row   (cable, seated)  "), "Row");
  assert.equal(shortExerciseName("Lat pulldown (wide"), "Lat pulldown");
  assert.equal(shortExerciseName("Chest Fly (Pec Deck) Machine Low"), "CFML");
});

test("initials keep letters and digits only", () => {
  assert.equal(shortExerciseName("21s & Barbell Curl Drop Set"), "2BCDS");
  assert.equal(shortExerciseName("Ángel's Weighted Pull-Up"), "ÁWPU");
});

test("a name that is only a parenthetical keeps its full text", () => {
  assert.equal(shortExerciseName("(Warm-up)"), "(Warm-up)");
});

test("colliding chip labels add the row's position", () => {
  assert.deepEqual(
    exerciseChipLabels([
      "Shoulder Press Machine (Wide Grip/Top Half)",
      "Squat",
      "Shoulder Press Machine (Narrow Grip)",
    ]),
    ["SPM 1", "Squat", "SPM 3"],
  );
  assert.deepEqual(exerciseChipLabels(["Squat", "Squat"]), ["Squat 1", "Squat 2"]);
  assert.deepEqual(exerciseChipLabels(["Squat", "Curl"]), ["Squat", "Curl"]);
});

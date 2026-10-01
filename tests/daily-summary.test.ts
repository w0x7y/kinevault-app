import assert from "node:assert/strict";
import test from "node:test";
import { emptyDay, summarizeDay, progressFraction, type DailyActivity } from "../src/daily/model.ts";

test("empty selected days have no invented activity", () => {
  const day = emptyDay("2026-10-01");
  assert.equal(day.date, "2026-10-01");
  assert.deepEqual(summarizeDay(day), {
    calories: 0, carbs: 0, protein: 0, fat: 0,
    workout: {
      name: null, volume: 0, durationSeconds: 0, sets: 0, reps: 0,
      averageRepsPerSet: 0, exercises: [],
    },
  });
  assert.deepEqual(day.foods, []);
  assert.equal(day.workout, null);
  assert.equal(day.steps, 0);
  assert.equal(day.waterMl, 0);
});

test("food totals include all meals and retain macro grams", () => {
  const day: DailyActivity = { ...emptyDay("2026-10-01"), foods: [
    { id: "1", name: "Oats", meal: "breakfast", calories: 150, carbs: 27, protein: 5, fat: 3 },
    { id: "2", name: "Soup", meal: "lunch", calories: 240, carbs: 32, protein: 12, fat: 7 },
    { id: "3", name: "Milk", meal: "snacks", calories: 110, carbs: 12, protein: 8, fat: 4 },
  ] };
  const summary = summarizeDay(day);
  assert.equal(summary.calories, 500);
  assert.equal(summary.carbs, 71);
  assert.equal(summary.protein, 25);
  assert.equal(summary.fat, 14);
});

test("workout volume and rep totals count only completed sets", () => {
  const day: DailyActivity = { ...emptyDay("2026-10-02"), workout: {
    name: "Strength", durationSeconds: 1800, exercises: [
      { id: "squat", name: "Squat", sets: [
        { weightKg: 60, reps: 10, completed: true },
        { weightKg: 60, reps: 8, completed: true },
        { weightKg: 65, reps: 8, completed: false },
      ] },
      { id: "press", name: "Press", sets: [{ weightKg: 30, reps: 12, completed: true }] },
      { id: "planned", name: "Planned row", sets: [{ weightKg: 40, reps: 12, completed: false }] },
    ],
  } };
  const summary = summarizeDay(day).workout;
  assert.equal(summary.volume, 1440);
  assert.equal(summary.sets, 3);
  assert.equal(summary.reps, 30);
  assert.equal(summary.exercises.length, 2);
  assert.equal(summary.durationSeconds, 1800);
});

test("progress bars clamp overflow and handle unset or zero targets", () => {
  assert.equal(progressFraction(500, 2000), 0.25);
  assert.equal(progressFraction(2400, 2000), 1);
  assert.equal(progressFraction(-10, 2000), 0);
  assert.equal(progressFraction(20, 0), 0);
  assert.equal(progressFraction(20, null), 0);
});

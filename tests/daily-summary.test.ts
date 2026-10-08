import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDay, progressFraction, type FoodDay } from "../src/daily/model.ts";

test("a known empty food day has zero calories and macros", () => {
  assert.deepEqual(summarizeDay({ foods: [] }), { calories: 0, carbs: 0, protein: 0, fat: 0 });
});

test("food totals include all meals and retain macro grams", () => {
  const day: FoodDay = {
    date: "2026-10-01",
    foods: [
      {
        id: "1",
        name: "Oats",
        meal: "breakfast",
        fdcId: 1,
        grams: 100,
        calories: 150,
        carbs: 27,
        protein: 5,
        fat: 3,
      },
      {
        id: "2",
        name: "Soup",
        meal: "lunch",
        fdcId: 2,
        grams: 100,
        calories: 240,
        carbs: 32,
        protein: 12,
        fat: 7,
      },
      {
        id: "3",
        name: "Milk",
        meal: "snacks",
        fdcId: 3,
        grams: 100,
        calories: 110,
        carbs: 12,
        protein: 8,
        fat: 4,
      },
    ],
  };
  const summary = summarizeDay(day);
  assert.equal(summary.calories, 500);
  assert.equal(summary.carbs, 71);
  assert.equal(summary.protein, 25);
  assert.equal(summary.fat, 14);
});

test("progress bars clamp overflow and handle unset or zero targets", () => {
  assert.equal(progressFraction(500, 2000), 0.25);
  assert.equal(progressFraction(2400, 2000), 1);
  assert.equal(progressFraction(-10, 2000), 0);
  assert.equal(progressFraction(20, 0), 0);
  assert.equal(progressFraction(20, null), 0);
});

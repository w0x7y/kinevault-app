import assert from "node:assert/strict";
import test from "node:test";
import { calorieSegments } from "../src/daily/nutrition.ts";

test("calorie segments use macro energy shares while their total follows source calories", () => {
  const segments = calorieSegments({ calories: 100, carbs: 10, protein: 10, fat: 10 }, 400);
  for (const [index, expected] of [1 / 17, 1 / 17, 9 / 68, 0].entries())
    assert.ok(Math.abs(segments[index].fraction - expected) < 1e-12);
  assert.ok(Math.abs(segments.reduce((sum, part) => sum + part.fraction, 0) - 0.25) < 1e-12);
});

test("calorie segments clamp an exceeded goal without hiding a macro", () => {
  const segments = calorieSegments({ calories: 800, carbs: 10, protein: 10, fat: 10 }, 400);
  assert.ok(Math.abs(segments[0].fraction - 4 / 17) < 1e-12);
  assert.ok(Math.abs(segments[2].fraction - 9 / 17) < 1e-12);
  assert.equal(
    segments.reduce((sum, part) => sum + part.fraction, 0),
    1,
  );
});

test("empty or unset goals have no fill and calories without macros use a neutral segment", () => {
  const nutrition = { calories: 120, carbs: 0, protein: 0, fat: 0 };
  assert.equal(calorieSegments(nutrition, 240).find((part) => part.key === "other")?.fraction, 0.5);
  for (const goal of [null, 0])
    assert.ok(calorieSegments(nutrition, goal).every((part) => part.fraction === 0));
  assert.ok(
    calorieSegments({ ...nutrition, calories: 0 }, 240).every((part) => part.fraction === 0),
  );
});

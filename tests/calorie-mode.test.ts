import assert from "node:assert/strict";
import test from "node:test";
import { emptyAnswers, type Answers } from "../src/profile/answers.ts";
import { changeAnswers, calorieState, isCalorieTarget } from "../src/profile/calories.ts";
const adult: Answers = {
  ...emptyAnswers,
  age: "30",
  height: "180",
  weight: "80",
  goal: "maintain",
  activity: "moderate",
  sex: "male",
  eligible: true,
};

test("opting out resets formula fields and preserves a manual override", () => {
  const manual = changeAnswers(
    { ...adult, customCalories: "2400" },
    { kind: "estimate", enabled: false },
  );
  assert.equal(manual.estimateEnabled, false);
  assert.equal(manual.eligible, false);
  assert.equal(manual.sex, null);
  assert.deepEqual(calorieState(manual), {
    kind: "manual",
    estimate: null,
    target: 2400,
    source: "custom",
  });
});
test("a custom target remains fixed until use-estimate is selected", () => {
  let answers = changeAnswers(
    { ...adult, customCalories: "2400" },
    { kind: "fields", patch: { goal: "gain", weight: "90" } },
  );
  assert.equal(calorieState(answers).target, 2400);
  assert.equal(calorieState(answers).source, "custom");
  answers = changeAnswers(answers, { kind: "use-estimate" });
  assert.equal(calorieState(answers).target, 3160);
  assert.equal(calorieState(answers).source, "estimate");
});
test("opt-in restores eligibility without discarding an existing custom target", () => {
  const manual = changeAnswers(
    { ...adult, customCalories: "2300" },
    { kind: "estimate", enabled: false },
  );
  const estimated = changeAnswers(manual, { kind: "estimate", enabled: true });
  assert.equal(estimated.eligible, true);
  assert.equal(calorieState(estimated).source, "custom");
  assert.equal(calorieState(estimated).target, 2300);
  assert.equal(calorieState(estimated).estimate, null); // Coefficient must be selected again.
});

test("an invalid nonempty override remains custom so the estimate reset stays available", () => {
  const state = calorieState({ ...adult, customCalories: "2 400" });
  assert.equal(state.source, "custom");
  assert.equal(state.target, null);
  assert.equal(state.estimate?.target, 2760);
});

test("a calorie target is whole kcal from 1,200 to 10,000", () => {
  for (const value of [1200, 2500, 10000]) assert.equal(isCalorieTarget(value), true);
  for (const value of [null, 1199, 10001, 2000.5, NaN]) assert.equal(isCalorieTarget(value), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyAnswers,
  estimateCalories,
  parseProfile,
  validateAnswers,
} from "../src/profile/model.ts";

const adult = {
  ...emptyAnswers,
  name: "Alex",
  goal: "maintain" as const,
  activity: "moderate" as const,
  age: "30",
  height: "180",
  weight: "80",
  sex: "male" as const,
  estimateEnabled: true,
  eligible: true,
};

test("adult estimate includes activity and the selected weight goal", () => {
  // Resting energy: 800 + 1125 - 150 + 5 = 1780. Activity: 1780 * 1.55 = 2759.
  assert.deepEqual(estimateCalories(adult), {
    resting: 1780,
    maintenance: 2760,
    adjustment: 0,
    target: 2760,
  });
  assert.equal(estimateCalories({ ...adult, goal: "lose" })?.target, 2510);
  assert.equal(estimateCalories({ ...adult, goal: "gain" })?.target, 3010);
  assert.equal(estimateCalories({ ...adult, sex: "female" })?.target, 2500);
});

test("estimates require complete eligible adult inputs", () => {
  for (const patch of [
    { age: "17" },
    { age: "NaN" },
    { age: "30.5" },
    { height: "" },
    { weight: "Infinity" },
    { eligible: false },
    { activity: null },
    { sex: null },
    { estimateEnabled: false },
  ]) {
    assert.equal(estimateCalories({ ...adult, ...patch }), null);
  }
  assert.notDeepEqual(validateAnswers({ ...adult, age: "17" }), {});
});

test("optional manual profile accepts missing metrics and decimal commas", () => {
  assert.deepEqual(
    validateAnswers({ ...emptyAnswers, estimateEnabled: false }),
    {},
  );
  assert.deepEqual(
    validateAnswers({ ...adult, height: "180,5", weight: "80,5" }),
    {},
  );
  for (const value of ["Infinity", "1e3", "-20", "80kg", "", "0"]) {
    assert.ok(validateAnswers({ ...adult, weight: value }).weight);
  }
  assert.ok(
    validateAnswers({ ...adult, customCalories: "900" }).customCalories,
  );
  assert.ok(
    validateAnswers({ ...adult, customCalories: "2400.5" }).customCalories,
  );
});

test("drafts resume at their saved step and complete profiles round trip", () => {
  const draft = {
    version: 1,
    kind: "draft",
    step: "body",
    answers: { ...emptyAnswers, name: "Alex" },
  };
  assert.deepEqual(parseProfile(JSON.stringify(draft)), draft);
  const complete = { version: 1, kind: "complete", answers: adult };
  assert.deepEqual(parseProfile(JSON.stringify(complete)), complete);
});

test("malformed and incompatible records cannot count as completed setup", () => {
  assert.equal(parseProfile(null).kind, "draft");
  for (const record of [
    "broken",
    "null",
    "{}",
    JSON.stringify({ version: 2, kind: "complete", answers: adult }),
    JSON.stringify({
      version: 1,
      kind: "complete",
      answers: { ...adult, age: "17" },
    }),
    JSON.stringify({
      version: 1,
      kind: "draft",
      step: "unknown",
      answers: adult,
    }),
  ]) {
    assert.throws(() => parseProfile(record));
  }
});

test("completed custom targets survive other profile changes", async () => {
  const { calorieTarget } = await import("../src/profile/model.ts");
  const complete = parseProfile(
    JSON.stringify({
      version: 1,
      kind: "complete",
      answers: { ...adult, customCalories: "2400" },
    }),
  );
  assert.equal(calorieTarget(complete.answers), 2400);
  assert.equal(
    calorieTarget({ ...complete.answers, goal: "gain", weight: "90" }),
    2400,
  );
  assert.equal(
    calorieTarget({ ...complete.answers, customCalories: "" }),
    2760,
  );
});

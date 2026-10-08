import assert from "node:assert/strict";
import test from "node:test";
import { emptyAnswers, type Answers } from "../src/profile/answers.ts";
import {
  estimateCalories,
  validateAnswers,
  changeAnswers,
  calorieState,
} from "../src/profile/calories.ts";
import { parseProfile } from "../src/profile/model.ts";

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
  assert.ok(validateAnswers({ ...adult, age: "15" }).age);
});

test("optional manual profile accepts missing metrics and decimal commas", () => {
  assert.deepEqual(validateAnswers({ ...emptyAnswers, age: "30", estimateEnabled: false }), {});
  assert.deepEqual(validateAnswers({ ...adult, height: "180,5", weight: "80,5" }), {});
  for (const value of ["Infinity", "1e3", "-20", "80kg", "", "0"]) {
    assert.ok(validateAnswers({ ...adult, weight: value }).weight);
  }
  assert.ok(validateAnswers({ ...adult, customCalories: "900" }).customCalories);
  assert.ok(validateAnswers({ ...adult, customCalories: "2400.5" }).customCalories);
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
      kind: "draft",
      step: "unknown",
      answers: adult,
    }),
  ]) {
    assert.throws(() => parseProfile(record));
  }
});

test("16 and 17 year olds can join without an adult calorie estimate", () => {
  for (const age of ["16", "17"]) {
    const teen = { ...emptyAnswers, age };
    assert.deepEqual(validateAnswers(teen), {});
    assert.equal(estimateCalories({ ...adult, age }), null);
    assert.deepEqual(validateAnswers({ ...teen, customCalories: "2300" }), {});
    assert.equal(
      parseProfile(JSON.stringify({ version: 1, kind: "complete", answers: teen })).kind,
      "complete",
    );
  }
  for (const age of ["", "15", "16.5", "101"])
    assert.ok(validateAnswers({ ...emptyAnswers, age, estimateEnabled: false }).age);
  assert.notEqual(estimateCalories({ ...adult, age: "18" }), null);
  assert.equal(
    changeAnswers({ ...adult, customCalories: "2000" }, { kind: "fields", patch: { age: "16" } })
      .customCalories,
    "",
  );
});

test("older profiles without a supported age keep their answers for re-checking", () => {
  const answers = { ...adult, age: "" };
  assert.deepEqual(parseProfile(JSON.stringify({ version: 1, kind: "complete", answers })), {
    version: 1,
    kind: "draft",
    step: "age",
    answers,
  });
});

test("typing a new teen age preserves a manual target through incomplete input", () => {
  let teen: Answers = {
    ...adult,
    age: "16",
    estimateEnabled: false,
    customCalories: "2300",
  };
  for (const age of ["", "1", "17"]) teen = changeAnswers(teen, { kind: "fields", patch: { age } });
  assert.equal(teen.customCalories, "2300");
  let estimated: Answers = { ...adult, customCalories: "2000" };
  for (const age of ["", "1", "16"])
    estimated = changeAnswers(estimated, { kind: "fields", patch: { age } });
  assert.equal(estimated.customCalories, "");
  assert.equal(estimated.estimateEnabled, false);
});

test("completed custom targets survive other profile changes", async () => {
  const complete = parseProfile(
    JSON.stringify({
      version: 1,
      kind: "complete",
      answers: { ...adult, customCalories: "2400" },
    }),
  );
  assert.equal(calorieState(complete.answers).target, 2400);
  assert.equal(calorieState({ ...complete.answers, goal: "gain", weight: "90" }).target, 2400);
  assert.equal(calorieState({ ...complete.answers, customCalories: "" }).target, 2760);
});

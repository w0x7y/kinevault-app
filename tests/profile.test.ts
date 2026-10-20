import assert from "node:assert/strict";
import test from "node:test";
import { answerSummary, choiceLabels, emptyAnswers } from "../src/profile/answers.ts";
import { estimateCalories, validateAnswers } from "../src/profile/calories.ts";
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

test("the app is for ages 18 and up", () => {
  for (const age of ["", "15", "16", "17", "18.5", "101"])
    assert.ok(validateAnswers({ ...emptyAnswers, age, estimateEnabled: false }).age);
  assert.deepEqual(validateAnswers({ ...emptyAnswers, age: "18", estimateEnabled: false }), {});
  assert.notEqual(estimateCalories({ ...adult, age: "18" }), null);
  // A profile saved while 16 and 17 were allowed goes back to the age question.
  const answers = { ...emptyAnswers, age: "17", estimateEnabled: false };
  assert.deepEqual(parseProfile(JSON.stringify({ version: 1, kind: "complete", answers })), {
    version: 1,
    kind: "draft",
    step: "age",
    answers,
  });
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

test("the chosen goal and activity read as their labels, unanswered ones as null", () => {
  assert.deepEqual(choiceLabels({ goal: "lose", activity: "light" }), {
    goal: "Lose weight",
    activity: "Lightly active",
  });
  assert.deepEqual(choiceLabels(emptyAnswers), { goal: null, activity: null });
});

test("an unanswered summary reads Not set and each figure keeps its unit on its line", () => {
  assert.deepEqual(answerSummary(emptyAnswers, null), {
    name: "Not set",
    goal: "Not set",
    age: "Not set",
    height: "Not set",
    weight: "Not set",
    body: "Not set",
    activity: "Not set",
    calories: "Not set",
  });
  const answers = {
    ...emptyAnswers,
    name: " Kim ",
    goal: "gain" as const,
    activity: "very" as const,
    age: "30",
    height: "180",
    weight: "80.5",
  };
  assert.deepEqual(answerSummary(answers, 2760), {
    name: "Kim",
    goal: "Gain weight",
    age: "30\u00a0years",
    height: "180\u00a0cm",
    weight: "80.5\u00a0kg",
    body: "180\u00a0cm · 80.5\u00a0kg",
    activity: "Very active",
    calories: `${(2760).toLocaleString()}\u00a0kcal`,
  });
  assert.equal(answerSummary({ ...emptyAnswers, weight: "80" }, null).body, "80\u00a0kg");
});

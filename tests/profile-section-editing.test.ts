import assert from "node:assert/strict";
import test from "node:test";
import { emptyAnswers } from "../src/profile/answers.ts";
import {
  changeAnswers,
  calorieState,
  validateAnswers,
} from "../src/profile/calories.ts";
import { editedProfileAnswers } from "../src/profile/section-editing.ts";
const saved = {
  ...emptyAnswers,
  name: "Saved",
  age: "30",
  height: "180",
  weight: "80",
  goal: "maintain" as const,
  activity: "moderate" as const,
  sex: "male" as const,
  eligible: true,
};
test("name save keeps the latest unrelated weight and targets", () => {
  const current = { ...saved, weight: "81", customProtein: "0" };
  assert.deepEqual(
    editedProfileAnswers(current, { ...saved, name: "New name" }, "name"),
    { ...current, name: "New name" },
  );
});
test("each focused section owns only its fields", () => {
  const draft = {
    ...saved,
    name: "Stale",
    age: "45",
    height: "175",
    weight: "70",
    goal: "gain" as const,
    activity: "light" as const,
    customCalories: "2200",
    customCarbs: "0",
    customProtein: "90",
    customFat: "50",
  };
  for (const [section, fields] of [
    ["age", ["age"]],
    ["goal", ["goal"]],
    ["activity", ["activity"]],
    [
      "calories",
      ["customCalories", "customCarbs", "customProtein", "customFat"],
    ],
  ] as const) {
    const expected = { ...saved };
    for (const field of fields)
      Object.assign(expected, { [field]: draft[field] });
    assert.deepEqual(editedProfileAnswers(saved, draft, section), expected);
  }
});
test("age save applies the current estimator teen transition and keeps unrelated macros", () => {
  const current = { ...saved, customCalories: "2500", customProtein: "0" };
  const next = editedProfileAnswers(current, { ...saved, age: "17" }, "age");
  assert.equal(next.estimateEnabled, false);
  assert.equal(next.eligible, false);
  assert.equal(next.sex, null);
  assert.equal(next.customCalories, "");
  assert.equal(next.customProtein, "0");
  assert.equal(calorieState(next).kind, "teen");
  assert.deepEqual(validateAnswers(next), {});
});
test("adult age change never silently re-enables the estimator", () => {
  const teen = changeAnswers(saved, { kind: "fields", patch: { age: "17" } });
  const next = editedProfileAnswers(teen, { ...saved, age: "18" }, "age");
  assert.equal(next.estimateEnabled, false);
  assert.equal(next.sex, null);
  assert.equal(calorieState(next).kind, "manual");
});
test("body save uses estimator policy without overwriting latest targets and age", () => {
  const current = { ...saved, age: "31", customCalories: "2300" };
  const draft = changeAnswers(saved, { kind: "estimate", enabled: false });
  const next = editedProfileAnswers(
    current,
    { ...draft, height: "177", weight: "77" },
    "body",
  );
  assert.equal(next.age, "31");
  assert.equal(next.customCalories, "2300");
  assert.equal(next.height, "177");
  assert.equal(next.estimateEnabled, false);
  assert.equal(next.eligible, false);
  assert.equal(next.sex, null);
});
test("stale body estimator cannot re-enable estimation after a concurrent teen age save", () => {
  const teen = changeAnswers(saved, { kind: "fields", patch: { age: "17" } });
  const next = editedProfileAnswers(teen, { ...saved, weight: "75" }, "body");
  assert.equal(next.weight, "75");
  assert.equal(next.age, "17");
  assert.equal(next.estimateEnabled, false);
  assert.equal(next.sex, null);
});

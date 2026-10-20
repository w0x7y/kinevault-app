import assert from "node:assert/strict";
import test from "node:test";
import { emptyAnswers } from "../src/profile/answers.ts";
import { changeAnswers } from "../src/profile/calories.ts";
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
    ["name", ["name"]],
    ["age", ["age"]],
    ["goal", ["goal"]],
    ["activity", ["activity"]],
    ["calories", ["customCalories", "customCarbs", "customProtein", "customFat"]],
  ] as const) {
    const expected = { ...saved };
    for (const field of fields) Object.assign(expected, { [field]: draft[field] });
    assert.deepEqual(editedProfileAnswers(saved, draft, section), expected);
  }
});
test("body save uses estimator policy without overwriting latest targets and age", () => {
  const current = { ...saved, age: "31", customCalories: "2300" };
  const draft = changeAnswers(saved, { kind: "estimate", enabled: false });
  const next = editedProfileAnswers(current, { ...draft, height: "177", weight: "77" }, "body");
  assert.equal(next.age, "31");
  assert.equal(next.customCalories, "2300");
  assert.equal(next.height, "177");
  assert.equal(next.estimateEnabled, false);
  assert.equal(next.eligible, false);
  assert.equal(next.sex, null);
});

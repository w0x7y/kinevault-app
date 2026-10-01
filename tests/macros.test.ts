import assert from "node:assert/strict";
import test from "node:test";
import { emptyAnswers } from "../src/profile/answers.ts";
import { calorieState, changeAnswers, validateAnswers } from "../src/profile/calories.ts";
import { macroTargets } from "../src/profile/macros.ts";
import { parseProfile } from "../src/profile/model.ts";

const adult = {
  ...emptyAnswers,
  age: "30",
  height: "180",
  weight: "80",
  goal: "maintain" as const,
  activity: "moderate" as const,
  sex: "male" as const,
  eligible: true,
};

test("automatic macro grams use 50/25/25 of the active calorie target", () => {
  assert.deepEqual(macroTargets(adult), { carbs: 345, protein: 173, fat: 77 });
  assert.deepEqual(macroTargets({ ...adult, customCalories: "2400" }), {
    carbs: 300, protein: 150, fat: 67,
  });
  assert.deepEqual(macroTargets({ ...emptyAnswers, age: "30", estimateEnabled: false }), {
    carbs: null, protein: null, fat: null,
  });
});

test("custom grams preserve zero and leave the other macros automatic", () => {
  const custom = changeAnswers(adult, {
    kind: "fields", patch: { customCarbs: "0", customProtein: "180" },
  });
  assert.deepEqual(macroTargets(custom), { carbs: 0, protein: 180, fat: 77 });
  assert.equal(calorieState(custom).target, 2760);
  const changed = changeAnswers(custom, { kind: "fields", patch: { customCalories: "2400" } });
  assert.deepEqual(macroTargets(changed), { carbs: 0, protein: 180, fat: 67 });
  assert.deepEqual(macroTargets({ ...changed, customCarbs: "", customProtein: "" }), {
    carbs: 300, protein: 150, fat: 67,
  });
});

test("macro inputs validate whole nonnegative grams within calorie-supported bounds", () => {
  for (const field of ["customCarbs", "customProtein", "customFat"] as const) {
    for (const value of ["-1", "1.5", "1e3", "NaN", "10001", "20g"]) {
      assert.ok(validateAnswers({ ...adult, [field]: value })[field]);
      const name = field === "customCarbs" ? "carbs" : field === "customProtein" ? "protein" : "fat";
      assert.equal(macroTargets({ ...adult, [field]: value })[name], null);
    }
    for (const value of ["", "0", "100", " 100 "])
      assert.equal(validateAnswers({ ...adult, [field]: value })[field], undefined);
  }
  assert.ok(validateAnswers({ ...adult, customFat: "1112" }).customFat);
  assert.ok(validateAnswers({ ...adult, customCarbs: "2501" }).customCarbs);
  assert.ok(validateAnswers({ ...adult, customProtein: "2501" }).customProtein);
});

test("macro overrides round trip in completed profiles and unfinished drafts", () => {
  const answers = { ...adult, customCarbs: "250", customProtein: "180", customFat: "0" };
  for (const document of [
    { version: 1, kind: "complete", answers },
    { version: 1, kind: "draft", step: "calories", answers: { ...answers, customCarbs: "-" } },
  ]) assert.deepEqual(parseProfile(JSON.stringify(document)), document);
});

test("version 1 profiles without macro fields keep their old target and gain defaults", () => {
  const { customCarbs, customProtein, customFat, ...legacy } = adult;
  for (const document of [
    { version: 1, kind: "complete", answers: legacy },
    { version: 1, kind: "draft", step: "body", answers: legacy },
  ]) {
    const parsed = parseProfile(JSON.stringify(document));
    assert.deepEqual(parsed.answers, adult);
    assert.deepEqual(macroTargets(parsed.answers), { carbs: 345, protein: 173, fat: 77 });
  }
  assert.throws(() => parseProfile(JSON.stringify({
    version: 1, kind: "complete", answers: { ...adult, customCarbs: 100 },
  })));
});

test("teen manual targets support macros without enabling adult estimates", () => {
  const teen = { ...emptyAnswers, age: "16", estimateEnabled: false, customCalories: "2400" };
  assert.deepEqual(macroTargets(teen), { carbs: 300, protein: 150, fat: 67 });
  assert.equal(calorieState(teen).estimate, null);
});

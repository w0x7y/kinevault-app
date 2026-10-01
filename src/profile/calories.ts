import {
  activities,
  macroInputs,
  macroInputValue,
  numericValue,
  type Answers,
  type FieldErrors,
} from "./answers.ts";

function isTeen(answers: Pick<Answers, "age">): boolean {
  const age = numericValue(answers.age);
  return age !== null && age >= 16 && age < 18 && Number.isInteger(age);
}

export function estimateCalories(answers: Answers) {
  const age = numericValue(answers.age);
  const height = numericValue(answers.height);
  const weight = numericValue(answers.weight);
  const activity = activities.find(({ value }) => value === answers.activity);
  if (
    !answers.estimateEnabled ||
    !answers.eligible ||
    !answers.goal ||
    !answers.sex ||
    !activity ||
    age === null ||
    age < 18 ||
    age > 100 ||
    !Number.isInteger(age) ||
    height === null ||
    height < 100 ||
    height > 250 ||
    weight === null ||
    weight < 30 ||
    weight > 350
  )
    return null;
  const resting =
    10 * weight + 6.25 * height - 5 * age + (answers.sex === "male" ? 5 : -161);
  const maintenance = Math.round((resting * activity.factor) / 10) * 10;
  // A transparent product default, not a personalized prescription or pace prediction.
  const adjustment =
    answers.goal === "lose" ? -250 : answers.goal === "gain" ? 250 : 0;
  const target = maintenance + adjustment;
  if (target < 1200 || target > 10000) return null;
  return { resting, maintenance, adjustment, target };
}

export function validateAnswers(answers: Answers): FieldErrors {
  const errors: FieldErrors = {};
  const needsEstimate = calorieState(answers).kind === "estimate";
  if (answers.name.trim().length > 40)
    errors.name = "Use 40 characters or fewer.";
  const metrics = [
    {
      key: "age",
      min: 16,
      max: 100,
      label: "age",
      unit: "years",
    },
    { key: "height", min: 100, max: 250, label: "height", unit: "cm" },
    { key: "weight", min: 30, max: 350, label: "weight", unit: "kg" },
  ] as const;
  for (const { key, min, max, label, unit } of metrics) {
    if (key !== "age" && !answers[key].trim() && !needsEstimate) continue;
    const value = numericValue(answers[key]);
    if (
      value === null ||
      value < min ||
      value > max ||
      (key === "age" && !Number.isInteger(value))
    ) {
      errors[key] =
        `Enter ${label} between ${min} and ${max} ${unit}${key === "age" ? " in whole years" : ""}.`;
    }
  }
  if (needsEstimate) {
    if (!answers.goal) errors.goal = "Choose a goal for your estimate.";
    if (!answers.activity)
      errors.activity = "Choose your usual activity level.";
    if (!answers.sex) errors.sex = "Choose a formula or skip the estimate.";
    if (!answers.eligible)
      errors.eligible = "Confirm the standard estimate applies, or skip it.";
  }
  if (answers.customCalories.trim()) {
    const target = numericValue(answers.customCalories);
    if (
      target === null ||
      !Number.isInteger(target) ||
      target < 1200 ||
      target > 10000
    )
      errors.customCalories =
        "Enter a whole number between 1,200 and 10,000 kcal.";
  }
  for (const { field, label, max } of macroInputs) {
    if (answers[field].trim() && macroInputValue(answers[field], max) === null)
      errors[field] = `Enter ${label.toLowerCase()} as whole grams between 0 and ${max.toLocaleString("en-US")}.`;
  }
  if (
    needsEstimate &&
    Object.keys(errors).length === 0 &&
    !estimateCalories(answers)
  )
    errors.customCalories =
      "This estimate is outside our supported range. Skip the estimate and enter your own target.";
  return errors;
}

type Estimate = NonNullable<ReturnType<typeof estimateCalories>>;
export type CalorieState =
  | {
      kind: "teen" | "manual";
      estimate: null;
      target: number | null;
      source: "custom" | null;
    }
  | {
      kind: "estimate";
      estimate: Estimate | null;
      target: number | null;
      source: "custom" | "estimate" | null;
    };

export type AnswerChange =
  | {
      kind: "fields";
      patch: Partial<Omit<Answers, "estimateEnabled" | "eligible">>;
    }
  | { kind: "estimate"; enabled: boolean }
  | { kind: "use-estimate" };

// Inputs keep their transient strings; policy owns related changes and target meaning.
export function changeAnswers(answers: Answers, change: AnswerChange): Answers {
  let next: Answers;
  switch (change.kind) {
    case "fields":
      next = { ...answers, ...change.patch };
      if (
        change.patch.age !== undefined &&
        isTeen(next) &&
        answers.estimateEnabled
      )
        return {
          ...next,
          estimateEnabled: false,
          eligible: false,
          sex: null,
          customCalories: "",
        };
      return next;
    case "estimate":
      if (change.enabled && !isTeen(answers))
        return { ...answers, estimateEnabled: true, eligible: true };
      return { ...answers, estimateEnabled: false, eligible: false, sex: null };
    case "use-estimate":
      return { ...answers, customCalories: "" };
    default: {
      const exhaustive: never = change;
      return exhaustive;
    }
  }
}

export function calorieState(answers: Answers): CalorieState {
  const overridden = answers.customCalories.trim() !== "";
  const custom = overridden ? numericValue(answers.customCalories) : null;
  if (isTeen(answers) || !answers.estimateEnabled)
    return {
      kind: isTeen(answers) ? "teen" : "manual",
      estimate: null,
      target: custom,
      source: overridden ? "custom" : null,
    };
  const estimate = estimateCalories(answers);
  const target = overridden ? custom : (estimate?.target ?? null);
  return {
    kind: "estimate",
    estimate,
    target,
    source: overridden ? "custom" : estimate ? "estimate" : null,
  };
}

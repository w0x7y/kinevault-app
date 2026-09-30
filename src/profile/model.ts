export const steps = [
  "welcome",
  "name",
  "goal",
  "body",
  "activity",
  "calories",
  "review",
] as const;
export type Step = (typeof steps)[number];
export const goals = [
  {
    value: "lose",
    label: "Lose weight",
    description: "Start below your estimated maintenance.",
  },
  {
    value: "maintain",
    label: "Maintain weight",
    description: "Find a steady daily target.",
  },
  {
    value: "gain",
    label: "Gain weight",
    description: "Start above your estimated maintenance.",
  },
] as const;
export const activities = [
  {
    value: "sedentary",
    label: "Mostly sitting",
    description: "Little exercise or movement day to day.",
    factor: 1.2,
  },
  {
    value: "light",
    label: "Lightly active",
    description: "Light exercise about 1–3 days a week.",
    factor: 1.375,
  },
  {
    value: "moderate",
    label: "Moderately active",
    description: "Moderate exercise about 3–5 days a week.",
    factor: 1.55,
  },
  {
    value: "very",
    label: "Very active",
    description: "Hard exercise most days or a physical job.",
    factor: 1.725,
  },
] as const;
export type Answers = {
  name: string;
  goal: (typeof goals)[number]["value"] | null;
  activity: (typeof activities)[number]["value"] | null;
  age: string;
  height: string;
  weight: string;
  sex: "female" | "male" | null;
  estimateEnabled: boolean;
  eligible: boolean;
  customCalories: string;
};
export const emptyAnswers: Answers = {
  name: "",
  goal: null,
  activity: null,
  age: "",
  height: "",
  weight: "",
  sex: null,
  estimateEnabled: true,
  eligible: false,
  customCalories: "",
};
export type ProfileDocument =
  | { version: 1; kind: "draft"; step: Step; answers: Answers }
  | { version: 1; kind: "complete"; answers: Answers };
export type FieldErrors = Partial<Record<keyof Answers, string>>;

export function numericValue(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
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
  if (answers.name.trim().length > 40)
    errors.name = "Use 40 characters or fewer.";
  const metrics = [
    {
      key: "age",
      min: answers.estimateEnabled ? 18 : 1,
      max: 100,
      label: "age",
      unit: "years",
    },
    { key: "height", min: 100, max: 250, label: "height", unit: "cm" },
    { key: "weight", min: 30, max: 350, label: "weight", unit: "kg" },
  ] as const;
  for (const { key, min, max, label, unit } of metrics) {
    if (!answers[key].trim() && !answers.estimateEnabled) continue;
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
  if (answers.estimateEnabled) {
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
  if (
    answers.estimateEnabled &&
    Object.keys(errors).length === 0 &&
    !estimateCalories(answers)
  )
    errors.customCalories =
      "This estimate is outside our supported range. Skip the estimate and enter your own target.";
  return errors;
}

export function calorieTarget(answers: Answers): number | null {
  return answers.customCalories.trim()
    ? numericValue(answers.customCalories)
    : (estimateCalories(answers)?.target ?? null);
}

export function parseProfile(raw: string | null): ProfileDocument {
  if (raw === null)
    return {
      version: 1,
      kind: "draft",
      step: "welcome",
      answers: { ...emptyAnswers },
    };
  const value: unknown = JSON.parse(raw);
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 1 ||
    !("kind" in value) ||
    !("answers" in value)
  )
    throw new Error("Unsupported profile record");
  const data = value.answers;
  if (
    typeof data !== "object" ||
    data === null ||
    !("name" in data) ||
    typeof data.name !== "string" ||
    data.name.length > 40 ||
    !("age" in data) ||
    typeof data.age !== "string" ||
    data.age.length > 16 ||
    !("height" in data) ||
    typeof data.height !== "string" ||
    data.height.length > 16 ||
    !("weight" in data) ||
    typeof data.weight !== "string" ||
    data.weight.length > 16 ||
    !("customCalories" in data) ||
    typeof data.customCalories !== "string" ||
    data.customCalories.length > 16 ||
    !("estimateEnabled" in data) ||
    typeof data.estimateEnabled !== "boolean" ||
    !("eligible" in data) ||
    typeof data.eligible !== "boolean" ||
    !("sex" in data) ||
    (data.sex !== null && data.sex !== "male" && data.sex !== "female") ||
    !("goal" in data) ||
    (data.goal !== null &&
      data.goal !== "lose" &&
      data.goal !== "maintain" &&
      data.goal !== "gain") ||
    !("activity" in data) ||
    (data.activity !== null &&
      data.activity !== "sedentary" &&
      data.activity !== "light" &&
      data.activity !== "moderate" &&
      data.activity !== "very")
  )
    throw new Error("Invalid profile answers");
  const answers: Answers = {
    name: data.name,
    age: data.age,
    height: data.height,
    weight: data.weight,
    customCalories: data.customCalories,
    estimateEnabled: data.estimateEnabled,
    eligible: data.eligible,
    sex: data.sex,
    goal: data.goal,
    activity: data.activity,
  };
  if (
    value.kind === "complete" &&
    Object.keys(validateAnswers(answers)).length === 0
  )
    return { version: 1, kind: "complete", answers };
  if (value.kind === "draft" && "step" in value) {
    const step = steps.find((step) => step === value.step);
    if (step) return { version: 1, kind: "draft", step, answers };
  }
  throw new Error("Invalid profile state");
}

import { emptyAnswers, steps, type Answers, type Step } from "./answers.ts";
import { validateAnswers } from "./calories.ts";

export type ProfileDocument =
  | { version: 1; kind: "draft"; step: Step; answers: Answers }
  | { version: 1; kind: "complete"; answers: Answers };

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
  if (value.kind === "complete") {
    const errors = validateAnswers(answers);
    if (Object.keys(errors).length === 0)
      return { version: 1, kind: "complete", answers };
    // Older versions allowed setup without age. Keep the profile and ask again.
    if (errors.age) return { version: 1, kind: "draft", step: "body", answers };
  }
  if (value.kind === "draft" && "step" in value) {
    const step = steps.find((step) => step === value.step);
    if (step) return { version: 1, kind: "draft", step, answers };
  }
  throw new Error("Invalid profile state");
}

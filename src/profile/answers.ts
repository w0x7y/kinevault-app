export const steps = [
  "welcome",
  "goal",
  "age",
  "name",
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
  customCarbs: string;
  customProtein: string;
  customFat: string;
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
  customCarbs: "",
  customProtein: "",
  customFat: "",
};

export const macroInputs = [
  { field: "customCarbs", macro: "carbs", label: "Carbs", max: 2500 },
  { field: "customProtein", macro: "protein", label: "Protein", max: 2500 },
  { field: "customFat", macro: "fat", label: "Fat", max: 1111 },
] as const;

export function macroInputValue(value: string, max: number): number | null {
  const grams = numericValue(value);
  return grams !== null && Number.isInteger(grams) && grams >= 0 && grams <= max
    ? grams
    : null;
}
export type FieldErrors = Partial<Record<keyof Answers, string>>;

export function numericValue(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export type EditableStep = Exclude<Step, "welcome" | "review">;

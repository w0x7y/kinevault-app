import { macroInputs, macroInputValue, type Answers } from "./answers.ts";
import { calorieState } from "./calories.ts";

export type MacroTargets = { carbs: number | null; protein: number | null; fat: number | null };

export function macroTargets(answers: Answers): MacroTargets {
  const target = calorieState(answers).target;
  const calories = target !== null && Number.isInteger(target) && target >= 1200 && target <= 10000
    ? target
    : null;
  const automatic: MacroTargets = {
    carbs: calories === null ? null : Math.round(calories * 0.5 / 4),
    protein: calories === null ? null : Math.round(calories * 0.25 / 4),
    fat: calories === null ? null : Math.round(calories * 0.25 / 9),
  };
  for (const { field, macro, max } of macroInputs) {
    if (answers[field].trim()) automatic[macro] = macroInputValue(answers[field], max);
  }
  return automatic;
}

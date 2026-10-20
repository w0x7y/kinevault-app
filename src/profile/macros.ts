import { macroInputs, macroInputValue, type Answers } from "./answers.ts";
import { calorieState, isCalorieTarget } from "./calories.ts";
import { kcalPerGram } from "../daily/nutrition.ts";

type MacroTargets = { carbs: number | null; protein: number | null; fat: number | null };

export function macroTargets(answers: Answers): MacroTargets {
  const target = calorieState(answers).target;
  const calories = isCalorieTarget(target) ? target : null;
  const automatic: MacroTargets = {
    carbs: calories === null ? null : Math.round((calories * 0.5) / kcalPerGram.carbs),
    protein: calories === null ? null : Math.round((calories * 0.25) / kcalPerGram.protein),
    fat: calories === null ? null : Math.round((calories * 0.25) / kcalPerGram.fat),
  };
  for (const { field, macro, max } of macroInputs) {
    if (answers[field].trim()) automatic[macro] = macroInputValue(answers[field], max);
  }
  return automatic;
}

/** The calories a full set of macro targets adds up to; null while any target is missing. */
export function macroCalories({ carbs, protein, fat }: MacroTargets): number | null {
  return carbs === null || protein === null || fat === null
    ? null
    : carbs * kcalPerGram.carbs + protein * kcalPerGram.protein + fat * kcalPerGram.fat;
}

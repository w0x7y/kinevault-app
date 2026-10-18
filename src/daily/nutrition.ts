import type { Nutrition } from "../food/catalog.ts";
import { progressFraction } from "./model.ts";

/** The energy in a gram of each macro. */
export const kcalPerGram = { carbs: 4, protein: 4, fat: 9 } as const;
export const macroCategories = [
  { key: "carbs", label: "Carbs", icon: "wheat-awn", kcalPerGram: kcalPerGram.carbs },
  { key: "protein", label: "Protein", icon: "egg", kcalPerGram: kcalPerGram.protein },
  { key: "fat", label: "Fat", icon: "seedling", kcalPerGram: kcalPerGram.fat },
] as const;
type MacroKey = (typeof macroCategories)[number]["key"];
type CalorieSegment = { key: MacroKey | "other"; fraction: number };

export function calorieSegments(nutrition: Nutrition, goal: number | null): CalorieSegment[] {
  const fill = progressFraction(nutrition.calories, goal);
  const energy = macroCategories.map(({ key, kcalPerGram }) => nutrition[key] * kcalPerGram);
  const total = energy.reduce((sum, value) => sum + value, 0);
  const hasShares = total > 0 && Number.isFinite(total);
  return [
    ...macroCategories.map(({ key }, index) => ({
      key,
      fraction: hasShares ? (fill * energy[index]) / total : 0,
    })),
    { key: "other", fraction: hasShares ? 0 : fill },
  ];
}

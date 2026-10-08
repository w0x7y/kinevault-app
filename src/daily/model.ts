import type { DetailedNutrients } from "../food/nutrients.ts";
import type { FoodIdentity } from "../food/catalog.ts";

export const meals = [
  { key: "breakfast", label: "Breakfast", icon: "mug-hot" },
  { key: "lunch", label: "Lunch", icon: "sun" },
  { key: "dinner", label: "Dinner", icon: "utensils" },
  { key: "snacks", label: "Snacks", icon: "apple-whole" },
  { key: "drinks", label: "Drinks", icon: "glass-water" },
] as const;
export type Meal = (typeof meals)[number]["key"];
export type FoodEntry = FoodIdentity & {
  id: string;
  name: string;
  meal: Meal;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  details?: DetailedNutrients;
} & (
    | { measurement?: "grams"; grams: number; drinkMl?: number }
    | { measurement: "volume"; drinkMl: number; meal: "drinks"; grams?: never }
  );
export type FoodDay = { date: string; foods: FoodEntry[] };

export function summarizeDay(day: Pick<FoodDay, "foods">) {
  const nutrition = day.foods.reduce(
    (sum, food) => ({
      calories: sum.calories + food.calories,
      carbs: sum.carbs + food.carbs,
      protein: sum.protein + food.protein,
      fat: sum.fat + food.fat,
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
  );
  return nutrition;
}

export function progressFraction(value: number, target: number | null) {
  if (target === null || target <= 0 || !Number.isFinite(target) || !Number.isFinite(value))
    return 0;
  return Math.min(1, Math.max(0, value / target));
}

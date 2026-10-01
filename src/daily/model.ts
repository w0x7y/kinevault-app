import { interpretWorkout } from "./workout.ts";
import type { DetailedNutrients } from "../food/nutrients.ts";

export const meals = [
  { key: "breakfast", label: "Breakfast", icon: "mug-hot" },
  { key: "lunch", label: "Lunch", icon: "sun" },
  { key: "dinner", label: "Dinner", icon: "utensils" },
  { key: "snacks", label: "Snacks / Drinks", icon: "apple-whole" },
] as const;
export type Meal = (typeof meals)[number]["key"];
export type FoodEntry = {
  id: string;
  name: string;
  meal: Meal;
  fdcId: number;
  grams: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  details?: DetailedNutrients;
};
type WorkoutSet = { weightKg: number; reps: number; completed: boolean };
type WorkoutExercise = { id: string; name: string; sets: WorkoutSet[] };
export type Workout = {
  name: string;
  durationSeconds: number;
  exercises: WorkoutExercise[];
};
export type DailyActivity = {
  date: string;
  foods: FoodEntry[];
  workout: Workout | null;
  steps: number;
  waterMl: number;
};

// Workouts, steps, and water have no logging source yet.
export function emptyDay(date: string): DailyActivity {
  return { date, foods: [], workout: null, steps: 0, waterMl: 0 };
}

export function summarizeDay(day: DailyActivity) {
  const nutrition = day.foods.reduce(
    (sum, food) => ({
      calories: sum.calories + food.calories,
      carbs: sum.carbs + food.carbs,
      protein: sum.protein + food.protein,
      fat: sum.fat + food.fat,
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
  );
  return { ...nutrition, workout: interpretWorkout(day.workout) };
}

export function progressFraction(value: number, target: number | null) {
  if (target === null || target <= 0 || !Number.isFinite(target) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value / target));
}

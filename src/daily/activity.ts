import type { FoodLogSnapshot } from "../food/log-persistence.ts";
import type { WaterLogSnapshot } from "../water/persistence.ts";
import type { WaterGoalSnapshot } from "../water/goal-persistence.ts";
import { waterGoalProgress } from "../water/goal-model.ts";
import { summarizeDay, type DailyActivity } from "./model.ts";
import { interpretWorkout } from "./workout.ts";

type Unavailable = { kind: "loading" } | { kind: "error" };
type FoodDay = Pick<DailyActivity, "date" | "foods" | "workout">;
type FoodActivity = Unavailable | { kind: "ready"; day: FoodDay; summary: ReturnType<typeof summarizeDay> };
type WaterTotal = Unavailable | { kind: "ready"; manualMl: number; drinkMl: number; ml: number };
type WaterGoal = Unavailable | { kind: "ready"; ml: number };

export function interpretDayActivity({ selectedDay, food, water, goal }: {
  selectedDay: string;
  food: FoodLogSnapshot["state"];
  water: WaterLogSnapshot["state"];
  goal: WaterGoalSnapshot["state"];
}) {
  let foodActivity: FoodActivity;
  if (food.kind === "ready") {
    const day: FoodDay = { date: selectedDay, foods: food.document.days[selectedDay] ?? [], workout: null };
    foodActivity = { kind: "ready", day, summary: summarizeDay(day) };
  } else {
    foodActivity = { kind: food.kind };
  }

  let total: WaterTotal;
  if (foodActivity.kind === "ready" && water.kind === "ready") {
    const manualMl = water.document.days[selectedDay] ?? 0;
    const drinkMl = foodActivity.day.foods.reduce((sum, entry) =>
      sum + (entry.meal === "drinks" ? entry.drinkMl ?? 0 : 0), 0);
    total = { kind: "ready", manualMl, drinkMl, ml: manualMl + drinkMl };
  } else {
    // A failed source needs recovery even if the other source is still loading.
    total = { kind: food.kind === "error" || water.kind === "error" ? "error" : "loading" };
  }
  const waterGoal: WaterGoal = goal.kind === "ready"
    ? { kind: "ready", ml: goal.document.dailyMl } : { kind: goal.kind };
  const progress = waterGoalProgress(total.kind === "ready" ? total.ml : null,
    waterGoal.kind === "ready" ? waterGoal.ml : null);

  // Workouts and steps have no logging source yet and remain independently usable.
  return { date: selectedDay, food: foodActivity, steps: 0, workout: interpretWorkout(null),
    water: { total, goal: waterGoal, progress } };
}

export type DayActivity = ReturnType<typeof interpretDayActivity>;

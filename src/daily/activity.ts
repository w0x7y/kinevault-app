import type { FoodLogSnapshot } from "../food/log-persistence.ts";
import type { WaterLogSnapshot } from "../water/persistence.ts";
import type { WaterGoalSnapshot } from "../water/goal-persistence.ts";
import { waterGoalProgress } from "../water/goal-model.ts";
import { summarizeDay, type FoodDay } from "./model.ts";
import type { ExerciseSnapshot } from "../exercise/persistence.ts";
import { summarizeSessions } from "../exercise/summary.ts";

type Unavailable = { kind: "loading" } | { kind: "error" };
type FoodActivity =
  Unavailable | { kind: "ready"; day: FoodDay; summary: ReturnType<typeof summarizeDay> };
type WaterTotal = Unavailable | { kind: "ready"; manualMl: number; drinkMl: number; ml: number };
type WaterGoal = Unavailable | { kind: "ready"; ml: number };

export function interpretDayActivity({
  selectedDay,
  food,
  water,
  goal,
  exercise,
}: {
  selectedDay: string;
  food: FoodLogSnapshot["state"];
  water: WaterLogSnapshot["state"];
  goal: WaterGoalSnapshot["state"];
  exercise?: ExerciseSnapshot["state"];
}) {
  let foodActivity: FoodActivity;
  if (food.kind === "ready") {
    const day: FoodDay = { date: selectedDay, foods: food.document.days[selectedDay] ?? [] };
    foodActivity = { kind: "ready", day, summary: summarizeDay(day) };
  } else {
    foodActivity = { kind: food.kind };
  }

  let total: WaterTotal;
  if (foodActivity.kind === "ready" && water.kind === "ready") {
    const manualMl = water.document.days[selectedDay] ?? 0;
    const drinkMl = foodActivity.day.foods.reduce(
      (sum, entry) => sum + (entry.meal === "drinks" ? (entry.drinkMl ?? 0) : 0),
      0,
    );
    total = { kind: "ready", manualMl, drinkMl, ml: manualMl + drinkMl };
  } else {
    // A failed source needs recovery even if the other source is still loading.
    total = { kind: food.kind === "error" || water.kind === "error" ? "error" : "loading" };
  }
  const waterGoal: WaterGoal =
    goal.kind === "ready" ? { kind: "ready", ml: goal.document.dailyMl } : { kind: goal.kind };
  const progress = waterGoalProgress(
    total.kind === "ready" ? total.ml : null,
    waterGoal.kind === "ready" ? waterGoal.ml : null,
  );

  const workoutState = exercise?.kind ?? "ready";
  const workout =
    exercise?.kind === "ready"
      ? summarizeSessions(
          exercise.document.sessions.filter((session) => session.date === selectedDay),
        )
      : summarizeSessions([]);
  return {
    date: selectedDay,
    food: foodActivity,
    steps: null,
    workout,
    workoutState,
    water: { total, goal: waterGoal, progress },
  };
}

export type DayActivity = ReturnType<typeof interpretDayActivity>;

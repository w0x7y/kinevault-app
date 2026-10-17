import type { FoodLogSnapshot } from "../food/log-persistence.ts";
import type { WaterLogSnapshot } from "../water/persistence.ts";
import type { WaterGoalSnapshot } from "../water/goal-persistence.ts";
import { waterGoalProgress } from "../water/goal-model.ts";
import { summarizeDay, type FoodDay } from "./model.ts";
import type { ExerciseSnapshot } from "../exercise/persistence.ts";
import { summarizeSessions } from "../exercise/summary.ts";
import type { ProfileSnapshot } from "../profile/persistence.ts";
import { calorieState } from "../profile/calories.ts";
import { macroTargets } from "../profile/macros.ts";

type Unavailable = { kind: "loading" } | { kind: "error" };
type FoodActivity =
  Unavailable | { kind: "ready"; day: FoodDay; summary: ReturnType<typeof summarizeDay> };
type WaterTotal = Unavailable | { kind: "ready"; manualMl: number; drinkMl: number; ml: number };
type WaterGoal = Unavailable | { kind: "ready"; ml: number };
type Targets =
  | Unavailable
  | {
      kind: "ready";
      calories: number | null;
      carbs: number | null;
      protein: number | null;
      fat: number | null;
    };

// One day's tracking and targets, for the Selected day or, in the Personal journal, Today.
export function interpretDayActivity({
  date,
  profile,
  food,
  water,
  goal,
  exercise,
}: {
  date: string;
  profile: ProfileSnapshot["state"];
  food: FoodLogSnapshot["state"];
  water: WaterLogSnapshot["state"];
  goal: WaterGoalSnapshot["state"];
  exercise?: ExerciseSnapshot["state"];
}) {
  let foodActivity: FoodActivity;
  if (food.kind === "ready") {
    const day: FoodDay = { date, foods: food.document.days[date] ?? [] };
    foodActivity = { kind: "ready", day, summary: summarizeDay(day) };
  } else {
    foodActivity = { kind: food.kind };
  }

  let total: WaterTotal;
  if (foodActivity.kind === "ready" && water.kind === "ready") {
    const manualMl = water.document.days[date] ?? 0;
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

  const targets: Targets =
    profile.kind === "ready"
      ? {
          kind: "ready",
          calories: calorieState(profile.document.answers).target,
          ...macroTargets(profile.document.answers),
        }
      : { kind: profile.kind };

  const workoutState = exercise?.kind ?? "ready";
  const sessions =
    exercise?.kind === "ready"
      ? exercise.document.sessions.filter((session) => session.date === date)
      : [];
  // The Active workout stays on its original date; an unnamed one keeps a generic label.
  const active = sessions.find((session) => session.status === "active");
  return {
    date,
    targets,
    food: foodActivity,
    workout: summarizeSessions(sessions),
    workoutState,
    activeWorkoutName: active ? active.name || "Active workout" : undefined,
    water: { total, goal: waterGoal, progress },
  };
}

export type DayActivity = ReturnType<typeof interpretDayActivity>;

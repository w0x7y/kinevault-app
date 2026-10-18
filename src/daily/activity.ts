import { shortDayLabel } from "../calendar/dates.ts";
import type { FoodLogSnapshot } from "../food/log-persistence.ts";
import type { WaterLogSnapshot } from "../water/persistence.ts";
import type { WaterGoalSnapshot } from "../water/goal-persistence.ts";
import { waterGoalProgress } from "../water/goal-model.ts";
import type { StepsLogSnapshot } from "../steps/persistence.ts";
import type { PhoneStepsReading } from "../steps/summary.ts";
import { progressFraction, summarizeDay, type FoodDay } from "./model.ts";
import { calorieSegments, macroCategories } from "./nutrition.ts";
import type { ExerciseSnapshot } from "../exercise/persistence.ts";
import { summarizeSessions } from "../exercise/summary.ts";
import { activeWorkout } from "../exercise/model.ts";
import type { ProfileSnapshot } from "../profile/persistence.ts";
import { calorieState } from "../profile/calories.ts";
import { macroTargets } from "../profile/macros.ts";
import { profileStreak } from "../profile/activity.ts";

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
/** A saved document as its provider reports it. */
type Source<State> = { state: State; retryLoad: () => void };
/** Whether a saved source of the day could be read, and how to read it again. */
export type DaySource = { kind: "loading" | "error" | "ready"; retry: () => void };

/** A missing calorie or macro target: a dash on screen, a word for assistive technology. */
export const unsetTarget = { shown: "—", spoken: "unset" } as const;

const source = ({ state, retryLoad }: Source<{ kind: DaySource["kind"] }>): DaySource => ({
  kind: state.kind,
  retry: retryLoad,
});

// One day's tracking and targets, for the Selected day or, in the Personal journal, Today.
export function interpretDayActivity({
  date,
  profile,
  food,
  water,
  goal,
  exercise,
  phoneSteps,
  loggedSteps,
}: {
  date: string;
  profile: ProfileSnapshot["state"];
  food: Source<FoodLogSnapshot["state"]>;
  water: Source<WaterLogSnapshot["state"]>;
  goal: Source<WaterGoalSnapshot["state"]>;
  exercise: Source<ExerciseSnapshot["state"]>;
  phoneSteps: PhoneStepsReading;
  loggedSteps: Source<StepsLogSnapshot["state"]>;
}) {
  let foodActivity: FoodActivity;
  if (food.state.kind === "ready") {
    const day: FoodDay = { date, foods: food.state.document.days[date] ?? [] };
    foodActivity = { kind: "ready", day, summary: summarizeDay(day) };
  } else {
    foodActivity = { kind: food.state.kind };
  }

  let total: WaterTotal;
  if (foodActivity.kind === "ready" && water.state.kind === "ready") {
    const manualMl = water.state.document.days[date] ?? 0;
    const drinkMl = foodActivity.day.foods.reduce(
      (sum, entry) => sum + (entry.meal === "drinks" ? (entry.drinkMl ?? 0) : 0),
      0,
    );
    total = { kind: "ready", manualMl, drinkMl, ml: manualMl + drinkMl };
  } else {
    // A failed source needs recovery even if the other source is still loading.
    total = {
      kind: food.state.kind === "error" || water.state.kind === "error" ? "error" : "loading",
    };
  }
  const waterGoal: WaterGoal =
    goal.state.kind === "ready"
      ? { kind: "ready", ml: goal.state.document.dailyMl }
      : { kind: goal.state.kind };
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

  const sessions =
    exercise.state.kind === "ready"
      ? exercise.state.document.sessions.filter((session) => session.date === date)
      : [];
  // The Active workout stays on its original date; an unnamed one keeps a generic label.
  const active = activeWorkout(sessions) ?? undefined;
  const logged =
    loggedSteps.state.kind === "ready" ? (loggedSteps.state.document.days[date] ?? 0) : null;
  let streak: ReturnType<typeof profileStreak> | null | undefined;
  return {
    date,
    targets,
    food: foodActivity,
    nutrition:
      foodActivity.kind === "ready"
        ? nutritionProgress(
            foodActivity.summary,
            targets.kind === "ready"
              ? targets
              : { calories: null, carbs: null, protein: null, fat: null },
          )
        : null,
    workout: summarizeSessions(sessions),
    workoutState: exercise.state.kind,
    activeWorkoutName: active ? active.name || "Active workout" : undefined,
    water: { total, goal: waterGoal, progress, tile: waterTile(total, waterGoal, progress) },
    steps: { phone: phoneSteps, tile: stepsTile(date, phoneSteps, logged) },
    /** Each saved source on its own, so a screen can show and retry the one that failed. */
    sources: {
      food: source(food),
      water: source(water),
      waterGoal: source(goal),
      workouts: source(exercise),
      loggedSteps: source(loggedSteps),
    },
    /** The journal's streak up to this day, once food, water and workouts are known. Only the
     * journal shows it, so it is counted on first use. */
    streak() {
      if (streak !== undefined) return streak;
      streak =
        food.state.kind === "ready" &&
        water.state.kind === "ready" &&
        exercise.state.kind === "ready"
          ? profileStreak({
              today: date,
              food: food.state.document,
              water: water.state.document,
              sessions: exercise.state.document.sessions,
            })
          : null;
      return streak;
    },
  };
}

export type DayActivity = ReturnType<typeof interpretDayActivity>;

type Nutrition = ReturnType<typeof summarizeDay>;

/** Eaten against target, rounded the way every screen shows it. */
function nutrientProgress(value: number, target: number | null, eaten: number) {
  const fraction = progressFraction(value, target);
  return { eaten, target, fraction, percentage: Math.round(fraction * 100) };
}

/** The day's calories and macros against their targets. Calories are whole kcal and macros
 * grams to one decimal, on screen and in accessibility labels alike. */
function nutritionProgress(summary: Nutrition, targets: Record<keyof Nutrition, number | null>) {
  const goal = targets.calories;
  const calories = nutrientProgress(summary.calories, goal, Math.round(summary.calories));
  const remaining = goal === null ? null : goal - calories.eaten;
  const macros = Object.fromEntries(
    macroCategories.map(({ key, label }) => {
      const target = targets[key];
      const progress = nutrientProgress(summary[key], target, Math.round(summary[key] * 10) / 10);
      return [
        key,
        {
          ...progress,
          label: `${label}, ${progress.eaten} grams consumed, target ${target === null ? unsetTarget.spoken : `${target} grams`}`,
        },
      ];
    }),
  ) as Record<
    (typeof macroCategories)[number]["key"],
    ReturnType<typeof nutrientProgress> & { label: string }
  >;
  return {
    calories: {
      ...calories,
      /** Calories left before the goal; negative once over it. */
      remaining,
      /** How far past the goal, as a share of it. */
      overFraction: remaining !== null && remaining < 0 ? progressFraction(-remaining, goal) : 0,
      /** The eaten share split by each macro's energy. */
      segments: calorieSegments(summary, goal),
      label: `${calories.eaten} kilocalories consumed, calorie goal ${goal === null ? unsetTarget.spoken : `${goal} kilocalories`}`,
    },
    ...macros,
  };
}
export type NutritionProgress = ReturnType<typeof nutritionProgress>;

/** The Home Water tile: the day's total against the Water goal, and what is missing. */
function waterTile(total: WaterTotal, goal: WaterGoal, progress: number | null) {
  const goalMl = goal.kind === "ready" ? goal.ml : null;
  const label =
    goalMl === null
      ? `Add water. ${total.kind === "ready" ? `${total.ml.toLocaleString()} ml consumed` : `Water total ${total.kind === "loading" ? "loading" : "unavailable"}`}. Daily goal ${goal.kind === "loading" ? "loading" : "unavailable"}. Progress unavailable.${goal.kind === "error" ? " Retry water goal in Settings." : ""}`
      : progress === null || total.kind !== "ready"
        ? `Add water. Water total ${total.kind === "loading" ? "loading" : "unavailable"}. Daily goal: ${goalMl.toLocaleString()} ml. Progress unavailable.`
        : `Add water. ${total.ml.toLocaleString()} ml consumed of a ${goalMl.toLocaleString()} ml daily goal. ${Math.round(progress * 100)}% of goal.`;
  return {
    /** Litres, or null while the total is unavailable. */
    value: total.kind === "ready" ? (total.ml / 1000).toLocaleString() : null,
    status:
      total.kind === "ready" ? null : total.kind === "loading" ? "loading..." : "tap to retry",
    progress:
      progress === null ? "Goal progress unavailable" : `${Math.round(progress * 100)}% of goal`,
    captions: [
      ...(goalMl !== null ? [`Goal: ${goalMl.toLocaleString()} ml`] : []),
      ...(goal.kind === "loading" ? ["Goal loading..."] : []),
      ...(goal.kind === "error" ? ["Goal unavailable", "Retry in Settings"] : []),
      "Includes Drinks",
    ],
    label,
  };
}

/** The Home Steps tile: phone steps plus steps logged by hand, with what the figure includes. */
function stepsTile(date: string, phone: PhoneStepsReading, logged: number | null) {
  const read = phone.access === "granted" && phone.state === "ready" ? phone.steps : null;
  const extra = logged ?? 0;
  const value = read === null && extra === 0 ? null : (read ?? 0) + extra;
  let captions: string[];
  if (phone.access === null || (phone.access === "granted" && phone.state === "loading"))
    captions = ["loading..."];
  else if (phone.access === "granted")
    captions =
      phone.state === "error"
        ? ["Couldn't read phone steps"]
        : ["From your phone", ...(extra > 0 ? [`Includes ${extra.toLocaleString()} logged`] : [])];
  else if (phone.access === "unavailable")
    captions = [extra > 0 ? "Logged manually" : "Tap to log steps"];
  else captions = ["Not connected"];
  const figure = value === null ? "No steps yet" : `${value.toLocaleString()} steps`;
  return {
    value,
    captions,
    label: `Log steps. ${figure} for ${shortDayLabel(date)}. ${captions.join(". ")}.`,
  };
}

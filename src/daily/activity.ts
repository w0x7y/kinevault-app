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
import {
  summarizeSessions,
  type CompletedLoad,
  type CompletedWorkout,
} from "../exercise/summary.ts";
import { activeWorkout, formatElapsed } from "../exercise/model.ts";
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
const unsetTarget = { shown: "—", spoken: "unset" } as const;

const source = ({ state, retryLoad }: Source<{ kind: DaySource["kind"] }>): DaySource => ({
  kind: state.kind,
  retry: retryLoad,
});

// One day's tracking and targets, for the Selected day or, in the Personal journal, Today.
export function interpretDayActivity({
  date,
  today,
  profile,
  food,
  water,
  goal,
  exercise,
  phoneSteps,
  loggedSteps,
}: {
  date: string;
  today: string;
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
  const active = activeWorkout(sessions);
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
    /** What the journal shows in place of `nutrition` while the food log isn't loaded. */
    unavailableNutrition: unavailableNutrition(
      targets.kind === "ready"
        ? targets
        : { calories: null, carbs: null, protein: null, fat: null },
    ),
    workout: workoutTile(
      source(exercise),
      summarizeSessions(sessions),
      active && (active.name || "Active workout"),
      date === today,
    ),
    water: {
      total,
      goal: waterGoal,
      progress,
      ...waterFigure(total, waterGoal),
      tile: waterTile(total, waterGoal, progress),
    },
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

/** Eaten against target, rounded and written the way every screen shows it. */
function nutrientProgress(value: number, target: number | null, eaten: number, unit: string) {
  const fraction = progressFraction(value, target);
  const ofTarget = ofTargetText(target, unit);
  return {
    eaten,
    target,
    fraction,
    percentage: Math.round(fraction * 100),
    /** The eaten figure: "1,380". */
    value: eaten.toLocaleString(),
    /** What follows the eaten figure: "/ 2,760 kcal", or "/ — kcal" while unset. */
    ofTarget,
    /** Eaten against target: "1,380 / 2,760 kcal". */
    figure: `${eaten.toLocaleString()} ${ofTarget}`,
  };
}
const ofTargetText = (target: number | null, unit: string) =>
  `/ ${target === null ? unsetTarget.shown : target.toLocaleString()} ${unit}`;
const spokenTarget = (target: number | null, unit: string) =>
  target === null ? unsetTarget.spoken : `${target} ${unit}`;

/** The day's calories and macros against their targets. Calories are whole kcal and macros
 * grams to one decimal, on screen and in accessibility labels alike. */
function nutritionProgress(summary: Nutrition, targets: Record<keyof Nutrition, number | null>) {
  const goal = targets.calories;
  const calories = nutrientProgress(summary.calories, goal, Math.round(summary.calories), "kcal");
  const remaining = goal === null ? null : goal - calories.eaten;
  const macros = Object.fromEntries(
    macroCategories.map(({ key, label }) => {
      const target = targets[key];
      const progress = nutrientProgress(
        summary[key],
        target,
        Math.round(summary[key] * 10) / 10,
        "g",
      );
      return [
        key,
        {
          ...progress,
          label: `${label}, ${progress.eaten} grams consumed, target ${spokenTarget(target, "grams")}`,
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
      /** The ring's figure and caption, and Daily macros' "N left" or "N over": what is left
       * or over the goal, or what was eaten while it is unset. */
      balance:
        remaining === null
          ? { value: calories.eaten.toLocaleString(), caption: "eaten" }
          : {
              value: Math.abs(remaining).toLocaleString(),
              caption: remaining < 0 ? "over" : "left",
            },
      /** The Food title, which leaves out an unset goal: "1,380 kcal". */
      title: goal === null ? `${calories.eaten.toLocaleString()} kcal` : calories.figure,
      /** How far past the goal, as a share of it. */
      overFraction: remaining !== null && remaining < 0 ? progressFraction(-remaining, goal) : 0,
      /** The eaten share split by each macro's energy. */
      segments: calorieSegments(summary, goal),
      label: `${calories.eaten} kilocalories consumed, calorie goal ${spokenTarget(goal, "kilocalories")}`,
    },
    ...macros,
  };
}
export type NutritionProgress = ReturnType<typeof nutritionProgress>;

/** Each target against an unavailable eaten figure: spelled out for calories, a dash for
 * the macro rows. */
function unavailableNutrition(targets: Record<keyof Nutrition, number | null>) {
  const nutrient = (value: string, target: number | null, unit: string, label: string) => ({
    value,
    ofTarget: ofTargetText(target, unit),
    fraction: 0,
    label,
  });
  return {
    calories: nutrient(
      "Unavailable",
      targets.calories,
      "kcal",
      `Calories consumed unavailable, calorie goal ${spokenTarget(targets.calories, "kilocalories")}`,
    ),
    ...(Object.fromEntries(
      macroCategories.map(({ key, label }) => [
        key,
        nutrient(
          "—",
          targets[key],
          "g",
          `${label}, consumed unavailable, target ${spokenTarget(targets[key], "grams")}`,
        ),
      ]),
    ) as Record<(typeof macroCategories)[number]["key"], ReturnType<typeof nutrient>>),
  };
}

/** The day's water total against the Water goal in ml, a dash for either while unavailable. */
function waterFigure(total: WaterTotal, goal: WaterGoal) {
  const totalMl = total.kind === "ready" ? total.ml : null;
  const goalMl = goal.kind === "ready" ? goal.ml : null;
  return {
    /** The total: "2,500", or "—". */
    value: totalMl === null ? "—" : totalMl.toLocaleString(),
    /** What follows the total: "/ 1,500 ml", or "/ — ml". */
    ofTarget: ofTargetText(goalMl, "ml"),
    label: `${totalMl === null ? "Water consumed unavailable" : `${totalMl} milliliters consumed`}, water goal ${goalMl === null ? "unavailable" : `${goalMl} milliliters`}`,
  };
}

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

/** A completed exercise on the detailed Workout card: its counts and its weight or time. */
type WorkoutExerciseRow = {
  id: string;
  name: string;
  counts: string[];
  amount: string;
  /** The amount's accessible name, e.g. "weight 40 kg". */
  amountLabel: string;
};
function loadAmount(load: CompletedLoad): Pick<WorkoutExerciseRow, "amount" | "amountLabel"> {
  const weight = (amount: string) => ({ amount, amountLabel: `weight ${amount}` });
  switch (load.kind) {
    case "bodyweight":
      return weight("Bodyweight");
    case "weight":
      return weight(`${load.weightKg.toLocaleString()} kg`);
    case "range":
      return weight(`${load.minKg.toLocaleString()}–${load.maxKg.toLocaleString()} kg`);
    case "time": {
      const time = formatElapsed(load.seconds);
      return { amount: time, amountLabel: `time ${time}` };
    }
  }
}

/** The Home and Exercise Workout tile: workouts loading or failed, an empty day, the Active
 * workout before anything is completed, or the day's Completed workout. Minutes round the same
 * way in the Exercise title and on the card. */
function workoutTile(
  { kind, retry }: DaySource,
  completed: CompletedWorkout,
  activeName: string | null,
  today: boolean,
): { retry: () => void; summary: string | null } & (
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty"; message: string }
  | { kind: "live"; name: string }
  | {
      kind: "done";
      name: string;
      /** "Live" while a workout still runs on the day. */
      status: "Live" | "Done";
      completed: CompletedWorkout;
      /** The card's Total lifted in kg, rounded like the summary. */
      lifted: string;
      /** The detailed card's exercise rows. */
      exercises: WorkoutExerciseRow[];
      stats: { label: string; value: string }[];
    }
) {
  if (kind !== "ready") return { kind, retry, summary: null };
  const minutes = `${Math.round(completed.durationSeconds / 60)} min`;
  const lifted = Math.round(completed.volume).toLocaleString();
  // The day's training in one line: volume when weights were logged, then duration.
  let summary = "No workouts yet";
  if (completed.sets > 0) {
    summary =
      completed.volume > 0
        ? `${lifted} kg`
        : `${completed.sets} ${completed.sets === 1 ? "set" : "sets"}`;
    if (completed.durationKnown && completed.durationSeconds > 0) summary += ` · ${minutes}`;
  }
  if (completed.name === null)
    return activeName === null
      ? {
          kind: "empty",
          retry,
          summary: today ? summary : "No workouts logged",
          message: today ? "Nothing logged yet today." : "No workouts logged.",
        }
      : { kind: "live", retry, summary, name: activeName };
  return {
    kind: "done",
    retry,
    summary,
    name: completed.name,
    status: activeName === null ? "Done" : "Live",
    completed,
    lifted,
    exercises: completed.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      // A timed exercise counts its sets; its time is its amount.
      counts: [
        exercise.sets === 1 ? "1 set" : `${exercise.sets} sets`,
        ...(exercise.load.kind === "time"
          ? []
          : [exercise.reps === 1 ? "1 rep" : `${exercise.reps} reps`]),
      ],
      ...loadAmount(exercise.load),
    })),
    stats: [
      { label: "Duration", value: completed.durationKnown ? minutes : "Not recorded" },
      { label: "Sets", value: String(completed.sets) },
      { label: "Reps", value: String(completed.reps) },
    ],
  };
}

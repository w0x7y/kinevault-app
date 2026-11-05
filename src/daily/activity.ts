import { parseDay, shortDayLabel } from "../calendar/dates.ts";
import type { FoodLogSnapshot } from "../food/log-persistence.ts";
import type { WaterLogSnapshot } from "../water/persistence.ts";
import type { WaterGoalSnapshot } from "../water/goal-persistence.ts";
import { waterGoalProgress } from "../water/goal-model.ts";
import type { StepsLogSnapshot } from "../steps/persistence.ts";
import { phoneStepsKind, type PhoneStepsKind, type PhoneStepsReading } from "../steps/summary.ts";
import { drinksMl, progressFraction, summarizeDay, type FoodDay } from "./model.ts";
import { calorieSegments, macroCategories } from "./nutrition.ts";
import type { ExerciseSnapshot } from "../exercise/persistence.ts";
import {
  summarizeSessions,
  type CompletedLoad,
  type CompletedWorkout,
} from "../exercise/summary.ts";
import { activeWorkout, formatElapsed } from "../exercise/model.ts";
import { inUnits, measureFigure, measureText, unitName, type UnitSystem } from "../units/units.ts";
import { personalRecords, type PersonalRecord } from "../exercise/records.ts";
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
  units = "metric",
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
  /** How figures read; the day's numbers stay metric. */
  units?: UnitSystem;
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
    const drinkMl = drinksMl(foodActivity.day.foods);
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
      summarizeSessions(
        sessions,
        exercise.state.kind === "ready"
          ? personalRecords(exercise.state.document.sessions, date)
          : undefined,
      ),
      active && (active.name || "Active workout"),
      date === today,
      date,
      units,
    ),
    water: {
      total,
      goal: waterGoal,
      progress,
      ...waterFigure(total, waterGoal, units),
      tile: waterTile(total, waterGoal, progress, units),
    },
    steps: { phone: phoneSteps, tile: stepsTile(date, phoneSteps, logged) },
    /** Each saved source on its own, so a screen can show and retry the one that failed. */
    sources: {
      food: source(food),
      water: source(water),
      waterGoal: source(goal),
      workouts: source(exercise),
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

/** Water in words for assistive technology: "2500 milliliters" or "85 fluid ounces". */
const spokenFluid = (ml: number, units: UnitSystem) =>
  units === "metric"
    ? `${ml} milliliters`
    : `${Math.round(inUnits("fluid", ml, units))} fluid ounces`;

/** The day's water total against the Water goal, a dash for either while unavailable. */
function waterFigure(total: WaterTotal, goal: WaterGoal, units: UnitSystem) {
  const totalMl = total.kind === "ready" ? total.ml : null;
  const goalMl = goal.kind === "ready" ? goal.ml : null;
  return {
    /** The total: "2,500", or "—". */
    value: totalMl === null ? "—" : measureFigure("fluid", totalMl, units),
    /** What follows the total: "/ 1,500 ml", or "/ — ml". */
    ofTarget: ofTargetText(
      goalMl === null ? null : Math.round(inUnits("fluid", goalMl, units)),
      unitName("fluid", units),
    ),
    label: `${totalMl === null ? "Water consumed unavailable" : `${spokenFluid(totalMl, units)} consumed`}, water goal ${goalMl === null ? "unavailable" : spokenFluid(goalMl, units)}`,
  };
}

/** The Home Water tile: the day's total against the Water goal, and what is missing. */
function waterTile(total: WaterTotal, goal: WaterGoal, progress: number | null, units: UnitSystem) {
  const goalMl = goal.kind === "ready" ? goal.ml : null;
  const fluid = (ml: number) => measureText("fluid", ml, units);
  const label =
    goalMl === null
      ? `Add water. ${total.kind === "ready" ? `${fluid(total.ml)} consumed` : `Water total ${total.kind === "loading" ? "loading" : "unavailable"}`}. Daily goal ${goal.kind === "loading" ? "loading" : "unavailable"}. Progress unavailable.${goal.kind === "error" ? " Retry water goal in Settings." : ""}`
      : progress === null || total.kind !== "ready"
        ? `Add water. Water total ${total.kind === "loading" ? "loading" : "unavailable"}. Daily goal: ${fluid(goalMl)}. Progress unavailable.`
        : `Add water. ${fluid(total.ml)} consumed of a ${fluid(goalMl)} daily goal. ${Math.round(progress * 100)}% of goal.`;
  return {
    /** Liters, or fluid ounces in Imperial; null while the total is unavailable. */
    value:
      total.kind !== "ready"
        ? null
        : units === "metric"
          ? (total.ml / 1000).toLocaleString()
          : measureFigure("fluid", total.ml, units),
    unit: units === "metric" ? "L" : unitName("fluid", units),
    status:
      total.kind === "ready" ? null : total.kind === "loading" ? "loading..." : "tap to retry",
    progress:
      progress === null ? "Goal progress unavailable" : `${Math.round(progress * 100)}% of goal`,
    captions: [
      ...(goalMl !== null ? [`Goal: ${fluid(goalMl)}`] : []),
      ...(goal.kind === "loading" ? ["Goal loading..."] : []),
      ...(goal.kind === "error" ? ["Goal unavailable", "Retry in Settings"] : []),
      "Includes Drinks",
    ],
    label,
  };
}

/** The Home Steps tile: phone steps plus steps logged by hand, with what the figure includes. */
function stepsTile(date: string, phone: PhoneStepsReading, logged: number | null) {
  const kind = phoneStepsKind(phone);
  const read = kind === "counted" ? phone.steps : null;
  const extra = logged ?? 0;
  const value = read === null && extra === 0 ? null : (read ?? 0) + extra;
  const captions = stepsCaptions(kind, extra);
  const figure = value === null ? "No steps yet" : `${value.toLocaleString()} steps`;
  return {
    value,
    captions,
    label: `Log steps. ${figure} for ${shortDayLabel(date)}. ${captions.join(". ")}.`,
  };
}

/** Where the Steps tile's figure comes from, or why the phone adds nothing. */
function stepsCaptions(phone: PhoneStepsKind, logged: number): string[] {
  switch (phone) {
    case "counted":
      return [
        "From your phone",
        ...(logged > 0 ? [`Includes ${logged.toLocaleString()} logged`] : []),
      ];
    case "loading":
      return ["loading..."];
    case "error":
      return ["Couldn't read phone steps"];
    case "connect":
    case "denied":
    case "install":
      return ["Not connected"];
    case "unavailable":
      return [logged > 0 ? "Logged manually" : "Tap to log steps"];
  }
}

/** A completed exercise on the detailed Workout card: its counts and its weight or time. */
type WorkoutExerciseRow = {
  id: string;
  name: string;
  counts: string[];
  amount: string;
  /** The amount's accessible name, e.g. "weight 40 kg". */
  amountLabel: string;
  /**
   * A Personal record this exercise set: "New record", its lift and, past one rep, its estimated
   * one-rep max, e.g. ["New record", "100 kg × 5", "est. 1RM 117 kg"].
   */
  record: { parts: string[]; label: string } | null;
};
function recordLine(
  record: PersonalRecord | null,
  units: UnitSystem,
): WorkoutExerciseRow["record"] {
  if (!record) return null;
  const { reps, weightKg, oneRepMaxKg } = record;
  const weight = measureText("weight", weightKg, units);
  // A single rep is its own one-rep max.
  const max = reps === 1 ? null : measureText("weight", oneRepMaxKg, units, 0);
  return {
    parts: ["New record", `${weight} × ${reps}`, ...(max ? [`est. 1RM ${max}`] : [])],
    label: `New record, ${weight} for ${reps === 1 ? "1 rep" : `${reps} reps`}${max ? `, estimated one-rep max ${max}` : ""}`,
  };
}
function loadAmount(
  load: CompletedLoad,
  units: UnitSystem,
): Pick<WorkoutExerciseRow, "amount" | "amountLabel"> {
  const weight = (amount: string) => ({ amount, amountLabel: `weight ${amount}` });
  switch (load.kind) {
    case "bodyweight":
      return weight("Bodyweight");
    case "weight":
      return weight(measureText("weight", load.weightKg, units));
    case "range":
      return weight(
        `${measureFigure("weight", load.minKg, units)}–${measureText("weight", load.maxKg, units)}`,
      );
    case "time":
    case "cardio": {
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
  date: string,
  units: UnitSystem,
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
      /** The card's Total lifted in the chosen units, rounded like the summary, and its unit. */
      lifted: string;
      liftedUnit: string;
      /** The detailed card's line under the total: "4 exercises · 10 reps per set on average". */
      detail: string;
      /** The detailed card's exercise rows. */
      exercises: WorkoutExerciseRow[];
      stats: { label: string; value: string }[];
      share: WorkoutShare;
    }
) {
  if (kind !== "ready") return { kind, retry, summary: null };
  const minutes = `${Math.round(completed.durationSeconds / 60)} min`;
  const lifted = measureFigure("weight", completed.volume, units, 0);
  const exerciseCount =
    completed.exercises.length === 1 ? "1 exercise" : `${completed.exercises.length} exercises`;
  const distance = completed.meters > 0 ? measureText("distance", completed.meters, units) : null;
  // The day's training in one line: volume and distance when logged, then duration.
  let summary = "No workouts yet";
  if (completed.sets > 0) {
    const figures = [
      completed.volume > 0 ? `${lifted} ${unitName("weight", units)}` : null,
      distance,
    ].filter(Boolean);
    summary = figures.length
      ? figures.join(" · ")
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
    lifted,
    liftedUnit: unitName("weight", units),
    // Timed sets have no reps, so a Timed-only day has no average.
    detail:
      completed.reps > 0
        ? `${exerciseCount} · ${completed.averageRepsPerSet} reps per set on average`
        : exerciseCount,
    exercises: completed.exercises.map((exercise) => ({
      record: recordLine(exercise.record, units),
      id: exercise.id,
      name: exercise.name,
      // A timed or cardio exercise counts its sets and distance; its time is its amount.
      counts: [
        exercise.sets === 1 ? "1 set" : `${exercise.sets} sets`,
        ...(exercise.load.kind === "cardio" && exercise.load.meters > 0
          ? [measureText("distance", exercise.load.meters, units)]
          : []),
        ...(exercise.load.kind === "time" || exercise.load.kind === "cardio"
          ? []
          : [exercise.reps === 1 ? "1 rep" : `${exercise.reps} reps`]),
      ],
      ...loadAmount(exercise.load, units),
    })),
    stats: [
      { label: "Duration", value: completed.durationKnown ? minutes : "Not recorded" },
      { label: "Sets", value: String(completed.sets) },
      // Three columns fit a 320 pt card, so a day without reps shows its distance instead.
      completed.reps === 0 && distance
        ? { label: "Distance", value: distance }
        : { label: "Reps", value: String(completed.reps) },
    ],
    share: workoutShare(completed.name, completed, date, units),
  };
}

/** One line of the share image: an exercise or a record, and its figure. */
type ShareLine = { name: string; figure: string };
/** A list's lines and, when it was cut short, how many more there are: "+3 more exercises". */
type ShareList = { lines: ShareLine[]; more: string | null };
/** The share image's text: what the Workout card shows, with each exercise's top set. */
export type WorkoutShare = {
  name: string;
  /** "Thursday, October 1, 2026". */
  date: string;
  stats: { label: string; value: string }[];
  exercises: ShareList;
  records: ShareList;
};

/** At most `max` lines; past that, the last line's place says how many more there are. */
function shareList(lines: ShareLine[], max: number, noun: string): ShareList {
  if (lines.length <= max) return { lines, more: null };
  const rest = lines.length - max + 1;
  return { lines: lines.slice(0, max - 1), more: `+${rest} more ${noun}${rest === 1 ? "" : "s"}` };
}

/** An exercise's top set, or a Timed or Cardio exercise's total time and distance. */
function topSet({ top, load }: CompletedWorkout["exercises"][number], units: UnitSystem): string {
  if (top)
    return top.weightKg > 0
      ? `${measureText("weight", top.weightKg, units)} × ${top.reps}`
      : `${top.reps} ${top.reps === 1 ? "rep" : "reps"}`;
  if (load.kind !== "time" && load.kind !== "cardio") return "";
  const time = formatElapsed(load.seconds);
  return load.kind === "cardio" && load.meters > 0
    ? `${measureText("distance", load.meters, units)} · ${time}`
    : time;
}

/**
 * The share image's figures for a day's Completed workouts. An unknown duration is left out, and
 * a day without volume shows its distance in its place.
 */
function workoutShare(
  name: string,
  completed: CompletedWorkout,
  date: string,
  units: UnitSystem,
): WorkoutShare {
  const records = shareList(
    completed.exercises.flatMap(({ name, record }) => {
      const line = recordLine(record, units);
      return line ? [{ name, figure: line.parts.slice(1).join(" · ") }] : [];
    }),
    2,
    "record",
  );
  return {
    name,
    date: parseDay(date).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    stats: [
      ...(completed.durationKnown
        ? [{ label: "Duration", value: `${Math.round(completed.durationSeconds / 60)} min` }]
        : []),
      { label: "Sets", value: String(completed.sets) },
      completed.volume === 0 && completed.meters > 0
        ? { label: "Distance", value: measureText("distance", completed.meters, units) }
        : { label: "Volume", value: measureText("weight", completed.volume, units, 0) },
    ],
    // The fixed-size image fits eight exercise lines, or five beside the records.
    exercises: shareList(
      completed.exercises.map((exercise) => ({
        name: exercise.name,
        figure: topSet(exercise, units),
      })),
      records.lines.length ? 5 : 8,
      "exercise",
    ),
    records,
  };
}

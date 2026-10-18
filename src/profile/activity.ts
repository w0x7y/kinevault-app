import { addDays, parseDay } from "../calendar/dates.ts";
import { setMeasurements, type SetSide, type WorkoutSession } from "../exercise/model.ts";
import type { FoodLogDocument } from "../food/log-model.ts";
import type { WaterLogDocument } from "../water/model.ts";

export type WorkoutMetric = "volume" | "duration" | "weight";
export type WorkoutRange = 4 | 12 | 52;
export type WorkoutExerciseOption = { key: string; name: string; tracking: "single" | "sides" };
/** One week of the graph, dated by its last day; a week without measurements stays null. */
export type WorkoutWeek = {
  date: string;
  total: number | null;
  left: number | null;
  right: number | null;
  workouts: number;
  partialDuration: boolean;
};
export type WorkoutGraph = {
  weeks: WorkoutWeek[];
  latest: WorkoutWeek;
  unit: "kg x reps" | "min" | "kg";
  tracking: "single" | "sides";
  options: WorkoutExerciseOption[];
  /** The chosen exercise, or the first option once the chosen one has no completed sets. */
  exerciseKey: string | undefined;
  /** Shown instead of the drawing until two weeks have measurements. */
  pending: string | null;
};

function completedSessions(sessions: readonly WorkoutSession[], today: string): WorkoutSession[] {
  return sessions.filter(
    (session) =>
      session.status === "completed" &&
      session.date <= today &&
      session.exercises.some((row) => row.sets.length > 0),
  );
}

export function profileStreak(input: {
  today: string;
  food: FoodLogDocument;
  water: WaterLogDocument;
  sessions: readonly WorkoutSession[];
}): {
  current: number;
  longest: number;
  days: string[];
  week: { date: string; logged: boolean }[];
} {
  const logged = new Set<string>();
  for (const [date, entries] of Object.entries(input.food.days)) {
    if (date <= input.today && entries.length > 0) logged.add(date);
  }
  for (const [date, ml] of Object.entries(input.water.days)) {
    if (date <= input.today && ml > 0) logged.add(date);
  }
  for (const session of completedSessions(input.sessions, input.today)) logged.add(session.date);

  const days = [...logged].sort();
  let longest = 0,
    run = 0;
  let previous: string | undefined;
  for (const day of days) {
    run = previous !== undefined && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  let current = 0;
  let end = logged.has(input.today) ? input.today : addDays(input.today, -1);
  while (logged.has(end)) {
    current += 1;
    end = addDays(end, -1);
  }
  const weekStart = addDays(input.today, -parseDay(input.today).getDay());
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return { date, logged: logged.has(date) };
  });
  return { current, longest, days, week };
}

function exerciseKey(exercise: WorkoutSession["exercises"][number]["exercise"]): string {
  return JSON.stringify([exercise.id, exercise.tracking]);
}

function workoutExerciseOptions(
  sessions: readonly WorkoutSession[],
  today: string,
): WorkoutExerciseOption[] {
  const options = new Map<string, WorkoutExerciseOption>();
  const historical = completedSessions(sessions, today).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  for (const session of historical) {
    for (const row of session.exercises) {
      if (row.sets.length === 0) continue;
      const key = exerciseKey(row.exercise);
      options.set(key, { key, name: row.exercise.name, tracking: row.exercise.tracking });
    }
  }
  return [...options.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key),
  );
}

function positiveMaximum(current: number | null, weight: number): number | null {
  return weight > 0 ? Math.max(current ?? 0, weight) : current;
}

function sideWeight(side: SetSide): number {
  if (Number(side.reps) <= 0) return 0;
  return setMeasurements({ id: "side", kind: "single", ...side }).weights[0] ?? 0;
}

export function workoutGraph(input: {
  today: string;
  weeks: WorkoutRange;
  metric: WorkoutMetric;
  sessions: readonly WorkoutSession[];
  exerciseKey?: string;
}): WorkoutGraph {
  // Weeks end on today, so the latest week is always the current one.
  const weeks: WorkoutWeek[] = Array.from({ length: input.weeks }, (_, index) => ({
    date: addDays(input.today, (index - input.weeks + 1) * 7),
    total: null,
    left: null,
    right: null,
    workouts: 0,
    partialDuration: false,
  }));
  const byDate = new Map(
    Array.from({ length: input.weeks * 7 }, (_, index) => [
      addDays(input.today, index - input.weeks * 7 + 1),
      weeks[Math.floor(index / 7)],
    ]),
  );
  const options = workoutExerciseOptions(input.sessions, input.today);
  const selected = options.some((option) => option.key === input.exerciseKey)
    ? input.exerciseKey
    : options[0]?.key;
  const option = options.find((option) => option.key === selected);

  for (const session of completedSessions(input.sessions, input.today)) {
    const week = byDate.get(session.date);
    if (!week) continue;
    const rows = session.exercises.filter(
      (row) =>
        row.sets.length > 0 &&
        (input.metric !== "weight" || exerciseKey(row.exercise) === selected),
    );
    if (rows.length === 0) continue;
    week.workouts += 1;
    if (input.metric === "duration") {
      if (session.durationSeconds === null) week.partialDuration = true;
      else week.total = (week.total ?? 0) + session.durationSeconds;
      continue;
    }
    for (const row of rows) {
      for (const set of row.sets) {
        const measured = setMeasurements(set);
        if (input.metric === "volume") week.total = (week.total ?? 0) + measured.volume;
        else {
          for (const weight of measured.weights) week.total = positiveMaximum(week.total, weight);
          if (set.kind === "sides") {
            week.left = positiveMaximum(week.left, sideWeight(set.left));
            week.right = positiveMaximum(week.right, sideWeight(set.right));
          }
        }
      }
    }
  }
  if (input.metric === "duration") {
    for (const week of weeks) {
      if (week.total !== null) week.total /= 60;
    }
  }
  const measured = weeks.filter(
    (week) => week.total !== null || week.left !== null || week.right !== null,
  ).length;
  return {
    weeks,
    latest: weeks.at(-1)!,
    unit: input.metric === "volume" ? "kg x reps" : input.metric === "duration" ? "min" : "kg",
    tracking: input.metric === "weight" ? (option?.tracking ?? "single") : "single",
    options,
    exerciseKey: selected,
    // One week of data would draw a lone dot.
    pending:
      measured >= 2
        ? null
        : measured === 0
          ? `No ${input.metric === "weight" ? "exercise weight" : input.metric} logged in the last ${input.weeks} weeks.`
          : "Your trend appears after workouts in two different weeks.",
  };
}

/** The caption for a week the user selects on the graph. */
export function workoutWeekLabel(graph: WorkoutGraph, week: WorkoutWeek): string {
  const amount = (value: number) =>
    `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${graph.unit}`;
  const side = (name: string, value: number | null) =>
    `${name} ${value === null ? "not logged" : amount(value)}`;
  const values =
    graph.tracking === "sides"
      ? `${side("Left", week.left)}, ${side("Right", week.right)}`
      : week.total === null
        ? "No measurement recorded"
        : amount(week.total);
  return `Week ending ${week.date}: ${values}${week.partialDuration ? " · Some workout durations were not recorded" : ""}`;
}

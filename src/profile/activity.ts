import { addDays, parseDay } from "../calendar/dates.ts";
import { setMeasurements, type SetSide, type WorkoutSession } from "../exercise/model.ts";
import type { FoodLogDocument } from "../food/log-model.ts";
import type { WaterLogDocument } from "../water/model.ts";

export type WorkoutMetric = "volume" | "duration" | "weight";
export type WorkoutRange = 4 | 12 | 52;
export type WorkoutExerciseOption = { key: string; name: string; tracking: "single" | "sides" };
export type WorkoutGraphPoint = {
  date: string;
  total: number | null;
  left: number | null;
  right: number | null;
  workouts: number;
  partialDuration: boolean;
};
export type WorkoutGraph = {
  points: WorkoutGraphPoint[];
  unit: "kg x reps" | "min" | "kg";
  tracking: "single" | "sides";
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

export function workoutExerciseOptions(
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
  const points: WorkoutGraphPoint[] = Array.from({ length: input.weeks * 7 }, (_, index) => ({
    date: addDays(input.today, index - input.weeks * 7 + 1),
    total: null,
    left: null,
    right: null,
    workouts: 0,
    partialDuration: false,
  }));
  const byDate = new Map(points.map((point) => [point.date, point]));
  const option =
    input.metric === "weight"
      ? workoutExerciseOptions(input.sessions, input.today).find(
          (option) => option.key === input.exerciseKey,
        )
      : undefined;
  const graph: WorkoutGraph = {
    points,
    tracking: option?.tracking ?? "single",
    unit: input.metric === "volume" ? "kg x reps" : input.metric === "duration" ? "min" : "kg",
  };
  if (input.metric === "weight" && option === undefined) return graph;

  for (const session of completedSessions(input.sessions, input.today)) {
    const point = byDate.get(session.date);
    if (!point) continue;
    const rows = session.exercises.filter(
      (row) =>
        row.sets.length > 0 &&
        (input.metric !== "weight" || exerciseKey(row.exercise) === input.exerciseKey),
    );
    if (rows.length === 0) continue;
    point.workouts += 1;
    if (input.metric === "duration") {
      if (session.durationSeconds === null) point.partialDuration = true;
      else point.total = (point.total ?? 0) + session.durationSeconds;
      continue;
    }
    for (const row of rows) {
      for (const set of row.sets) {
        const measured = setMeasurements(set);
        if (input.metric === "volume") point.total = (point.total ?? 0) + measured.volume;
        else {
          for (const weight of measured.weights) point.total = positiveMaximum(point.total, weight);
          if (set.kind === "sides") {
            point.left = positiveMaximum(point.left, sideWeight(set.left));
            point.right = positiveMaximum(point.right, sideWeight(set.right));
          }
        }
      }
    }
  }
  if (input.metric === "duration") {
    for (const point of points) {
      if (point.total !== null) point.total /= 60;
    }
  }
  return graph;
}

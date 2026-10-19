import type { WorkoutSession } from "./model.ts";
import { setMeasurements } from "./tracking.ts";

/** An exercise row's load: its weights, or the total time of a timed exercise. */
export type CompletedLoad =
  | { readonly kind: "bodyweight" }
  | { readonly kind: "weight"; readonly weightKg: number }
  | { readonly kind: "range"; readonly minKg: number; readonly maxKg: number }
  | { readonly kind: "time"; readonly seconds: number };

type CompletedExercise = {
  readonly id: string;
  readonly name: string;
  readonly volume: number;
  readonly sets: number;
  readonly reps: number;
  readonly load: CompletedLoad;
};

export type CompletedWorkout = {
  readonly name: string | null;
  readonly durationSeconds: number;
  readonly durationKnown: boolean;
  readonly volume: number;
  readonly sets: number;
  readonly reps: number;
  readonly averageRepsPerSet: number;
  readonly exercises: readonly CompletedExercise[];
};

export function summarizeSessions(sessions: readonly WorkoutSession[]): CompletedWorkout {
  const completed = sessions.filter((session) => session.status === "completed");
  const exercises: CompletedWorkout["exercises"][number][] = [];
  let volume = 0,
    sets = 0,
    repSets = 0,
    reps = 0;
  for (const session of completed) {
    for (const row of session.exercises) {
      if (!row.sets.length) continue;
      let rowReps = 0,
        rowVolume = 0,
        rowSeconds = 0,
        minKg = Infinity,
        maxKg = -Infinity;
      for (const set of row.sets) {
        const measured = setMeasurements(set);
        rowReps += measured.reps;
        rowVolume += measured.volume;
        rowSeconds += measured.seconds;
        for (const weight of measured.weights) {
          minKg = Math.min(minKg, weight);
          maxKg = Math.max(maxKg, weight);
        }
      }
      exercises.push({
        id: JSON.stringify([session.id, row.id]),
        name: row.exercise.name,
        volume: rowVolume,
        sets: row.sets.length,
        reps: rowReps,
        load:
          row.exercise.tracking === "time"
            ? { kind: "time", seconds: rowSeconds }
            : minKg === 0 && maxKg === 0
              ? { kind: "bodyweight" }
              : minKg === maxKg
                ? { kind: "weight", weightKg: minKg }
                : { kind: "range", minKg, maxKg },
      });
      volume += rowVolume;
      sets += row.sets.length;
      if (row.exercise.tracking !== "time") repSets += row.sets.length;
      reps += rowReps;
    }
  }
  return {
    name: completed.length > 1 ? "Workouts of the day" : (completed[0]?.name ?? null),
    durationSeconds: completed.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0),
    durationKnown:
      completed.length === 0 || completed.some((session) => session.durationSeconds !== null),
    volume,
    sets,
    reps,
    averageRepsPerSet: repSets === 0 ? 0 : Math.round(reps / repSets),
    exercises,
  };
}

import type { SessionExercise, WorkoutSession } from "./model.ts";
import type { PersonalRecord } from "./records.ts";
import { isWarmUp, setMeasurements, trackingMode, type Lift } from "./tracking.ts";

/**
 * An exercise row's load: its weights, the total time of a timed exercise, or a cardio
 * exercise's total time and distance.
 */
export type CompletedLoad =
  | { readonly kind: "bodyweight" }
  | { readonly kind: "weight"; readonly weightKg: number }
  | { readonly kind: "range"; readonly minKg: number; readonly maxKg: number }
  | { readonly kind: "time"; readonly seconds: number }
  | { readonly kind: "cardio"; readonly seconds: number; readonly meters: number };

type CompletedExercise = {
  readonly id: string;
  readonly name: string;
  readonly volume: number;
  readonly sets: number;
  readonly reps: number;
  readonly load: CompletedLoad;
  /** The top set: the heaviest lift, more reps breaking a tie. Null for a Timed or Cardio row. */
  readonly top: Lift | null;
  /** The Personal record this exercise row set, from the records given to the summary. */
  readonly record: PersonalRecord | null;
};

export type CompletedWorkout = {
  readonly name: string | null;
  readonly durationSeconds: number;
  readonly durationKnown: boolean;
  readonly volume: number;
  readonly sets: number;
  readonly reps: number;
  /** Cardio distance in meters. */
  readonly meters: number;
  readonly averageRepsPerSet: number;
  readonly exercises: readonly CompletedExercise[];
};

/**
 * The Completed workouts among `sessions` (usually one day's), with each exercise row's Personal
 * record from `records` (see `personalRecords`). Warm-up sets count toward nothing, so a row of
 * only warm-ups is left out.
 */
export function summarizeSessions(
  sessions: readonly WorkoutSession[],
  records: ReadonlyMap<SessionExercise, PersonalRecord> = new Map(),
): CompletedWorkout {
  const completed = sessions.filter((session) => session.status === "completed");
  const exercises: CompletedWorkout["exercises"][number][] = [];
  let volume = 0,
    sets = 0,
    repSets = 0,
    reps = 0,
    meters = 0;
  for (const session of completed) {
    for (const row of session.exercises) {
      const counted = row.sets.filter((set) => !isWarmUp(set));
      if (!counted.length) continue;
      let rowReps = 0,
        rowVolume = 0,
        rowSeconds = 0,
        rowMeters = 0,
        minKg = Infinity,
        maxKg = -Infinity,
        top: Lift | null = null;
      for (const set of counted) {
        const measured = setMeasurements(set);
        rowReps += measured.reps;
        rowVolume += measured.volume;
        rowSeconds += measured.seconds;
        rowMeters += measured.meters;
        for (const lift of measured.lifts) {
          minKg = Math.min(minKg, lift.weightKg);
          maxKg = Math.max(maxKg, lift.weightKg);
          if (
            !top ||
            lift.weightKg > top.weightKg ||
            (lift.weightKg === top.weightKg && lift.reps > top.reps)
          )
            top = lift;
        }
      }
      exercises.push({
        id: JSON.stringify([session.id, row.id]),
        name: row.exercise.name,
        volume: rowVolume,
        sets: counted.length,
        reps: rowReps,
        load:
          row.exercise.tracking === "time"
            ? { kind: "time", seconds: rowSeconds }
            : row.exercise.tracking === "cardio"
              ? { kind: "cardio", seconds: rowSeconds, meters: rowMeters }
              : minKg === 0 && maxKg === 0
                ? { kind: "bodyweight" }
                : minKg === maxKg
                  ? { kind: "weight", weightKg: minKg }
                  : { kind: "range", minKg, maxKg },
        top,
        record: records.get(row) ?? null,
      });
      volume += rowVolume;
      sets += counted.length;
      if (trackingMode(row.exercise.tracking).weighted) repSets += counted.length;
      reps += rowReps;
      meters += rowMeters;
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
    meters,
    averageRepsPerSet: repSets === 0 ? 0 : Math.round(reps / repSets),
    exercises,
  };
}

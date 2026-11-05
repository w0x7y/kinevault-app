import { exerciseHistoryKey, type SessionExercise, type WorkoutSession } from "./model.ts";
import { isWarmUp, setMeasurements, type Lift } from "./tracking.ts";

/** A Personal record: the lift and its estimated one-rep max. */
export type PersonalRecord = Lift & { oneRepMaxKg: number };

/** Epley's estimated one-rep max for a lift; a single rep is its own weight. */
export function estimatedOneRepMax({ reps, weightKg }: Lift): number {
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/**
 * The Personal records set on `date`, by the exercise row that set each. A Completed workout's
 * row sets one when its best weighted lift by estimated one-rep max beats every earlier Completed
 * workout with the same exercise history (`exerciseHistoryKey`): on an earlier date, or earlier
 * in the document on the same date. An exercise's first workout has nothing to beat, so it sets
 * none. Warm-up sets never count. A day without a Completed workout reads no history.
 */
export function personalRecords(
  sessions: readonly WorkoutSession[],
  date: string,
): ReadonlyMap<SessionExercise, PersonalRecord> {
  const records = new Map<SessionExercise, PersonalRecord>();
  if (!sessions.some((session) => session.status === "completed" && session.date === date))
    return records;
  const best = new Map<string, number>();
  // A stable sort keeps the document order within a date.
  const history = sessions
    .filter((session) => session.status === "completed" && session.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const session of history) {
    for (const row of session.exercises) {
      let top: PersonalRecord | null = null;
      for (const set of row.sets.filter((value) => !isWarmUp(value)))
        for (const lift of setMeasurements(set).lifts) {
          const oneRepMaxKg = estimatedOneRepMax(lift);
          if (lift.weightKg > 0 && (!top || oneRepMaxKg > top.oneRepMaxKg))
            top = { ...lift, oneRepMaxKg };
        }
      if (!top) continue;
      const key = exerciseHistoryKey(row.exercise);
      const previous = best.get(key);
      if (previous !== undefined && top.oneRepMaxKg <= previous) continue;
      best.set(key, top.oneRepMaxKg);
      if (previous !== undefined && session.date === date) records.set(row, top);
    }
  }
  return records;
}

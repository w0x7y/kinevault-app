import type { CompletedWorkout } from "../daily/workout.ts";
import { setMeasurements, type WorkoutSession } from "./model.ts";

export function summarizeSessions(sessions: readonly WorkoutSession[]): CompletedWorkout {
  const completed = sessions.filter(session => session.status === "completed");
  const exercises: CompletedWorkout["exercises"][number][] = [];
  let volume = 0, sets = 0, reps = 0;
  for (const session of completed) {
    for (const row of session.exercises) {
      if (!row.sets.length) continue;
      let rowReps = 0, rowVolume = 0, minKg = Infinity, maxKg = -Infinity;
      for (const set of row.sets) {
        const measured = setMeasurements(set);
        rowReps += measured.reps; rowVolume += measured.volume;
        for (const weight of measured.weights) { minKg = Math.min(minKg, weight); maxKg = Math.max(maxKg, weight); }
      }
      exercises.push({ id: JSON.stringify([session.id, row.id]), name: row.exercise.name, volume: rowVolume, sets: row.sets.length, reps: rowReps,
        load: minKg === 0 && maxKg === 0 ? { kind: "bodyweight" } : minKg === maxKg ? { kind: "weight", weightKg: minKg } : { kind: "range", minKg, maxKg } });
      volume += rowVolume; sets += row.sets.length; reps += rowReps;
    }
  }
  return { name: completed.length > 1 ? "Workouts of the day" : completed[0]?.name ?? null,
    durationSeconds: completed.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0),
    durationKnown: completed.length === 0 || completed.some(session => session.durationSeconds !== null), volume, sets, reps,
    averageRepsPerSet: sets === 0 ? 0 : Math.round(reps / sets), exercises };
}
export { elapsedSeconds } from "./model.ts";

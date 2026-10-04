import type { Workout } from "./model.ts";

type CompletedLoad =
  | { readonly kind: "bodyweight" }
  | { readonly kind: "weight"; readonly weightKg: number }
  | { readonly kind: "range"; readonly minKg: number; readonly maxKg: number };

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
  readonly durationKnown?: boolean;
  readonly volume: number;
  readonly sets: number;
  readonly reps: number;
  readonly averageRepsPerSet: number;
  readonly exercises: readonly CompletedExercise[];
};

export function interpretWorkout(workout: Workout | null): CompletedWorkout {
  const exercises: CompletedExercise[] = [];
  let volume = 0;
  let sets = 0;
  let reps = 0;

  for (const exercise of workout?.exercises ?? []) {
    let exerciseVolume = 0;
    let exerciseSets = 0;
    let exerciseReps = 0;
    let minKg = Infinity;
    let maxKg = -Infinity;

    for (const set of exercise.sets) {
      if (!set.completed) continue;
      exerciseVolume += set.weightKg * set.reps;
      exerciseSets += 1;
      exerciseReps += set.reps;
      minKg = Math.min(minKg, set.weightKg);
      maxKg = Math.max(maxKg, set.weightKg);
    }
    if (exerciseSets === 0) continue;

    const load: CompletedLoad = minKg === 0 && maxKg === 0
      ? { kind: "bodyweight" }
      : minKg === maxKg
        ? { kind: "weight", weightKg: minKg }
        : { kind: "range", minKg, maxKg };
    exercises.push({
      id: exercise.id,
      name: exercise.name,
      volume: exerciseVolume,
      sets: exerciseSets,
      reps: exerciseReps,
      load,
    });
    volume += exerciseVolume;
    sets += exerciseSets;
    reps += exerciseReps;
  }

  return {
    name: workout?.name ?? null,
    durationSeconds: workout?.durationSeconds ?? 0,
    volume,
    sets,
    reps,
    averageRepsPerSet: sets === 0 ? 0 : Math.round(reps / sets),
    exercises,
  };
}

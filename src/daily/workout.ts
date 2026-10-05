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
  readonly durationKnown: boolean;
  readonly volume: number;
  readonly sets: number;
  readonly reps: number;
  readonly averageRepsPerSet: number;
  readonly exercises: readonly CompletedExercise[];
};

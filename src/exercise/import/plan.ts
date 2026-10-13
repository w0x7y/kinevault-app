/** A shared workout plan read from another app, before it maps into the exercise library. */
export type ImportedExercise = {
  /** The source's ID for this exercise in the shared workout, when the page exposes one. */
  sourceId: string | null;
  /** Position label such as 1A; letters after A mark a superset within a group. */
  label: string;
  name: string;
  sets: number | null;
  reps: string | null;
  rir: string | null;
  rest: string | null;
  /** Prescription chips without a dedicated field, kept as displayed text. */
  otherChips: string[];
};
export type ImportedWorkoutPlan = {
  source: "tracked";
  sourceId: string;
  name: string;
  category: string | null;
  exercises: ImportedExercise[];
};

export type WorkoutImportErrorKind =
  | "invalid-link"
  | "not-found"
  | "unrecognized"
  | "too-large"
  | "network"
  | "timeout"
  | "cancelled"
  | "signed-out"
  | "unsupported";

/** Failures carry user-facing copy; `kind` lets callers branch without parsing text. */
export class WorkoutImportError extends Error {
  readonly kind: WorkoutImportErrorKind;
  constructor(kind: WorkoutImportErrorKind, message: string) {
    super(message);
    this.name = "WorkoutImportError";
    this.kind = kind;
  }
}

export const unrecognizedPage = () =>
  new WorkoutImportError(
    "unrecognized",
    "Couldn't read this workout. Tracked may have changed its page.",
  );
export const unavailableWorkout = () =>
  new WorkoutImportError(
    "not-found",
    "This workout isn't available. It may have been deleted, or the link may be incomplete. Ask for a new link.",
  );
export const oversizedPage = () =>
  new WorkoutImportError("too-large", "This workout page is too large to import.");

/** Displayed prescription, e.g. `Sets 4 · Reps 1-3 · Rest 30 sec`. */
export function prescriptionText(exercise: ImportedExercise, includeSets = true): string {
  return [
    includeSets && exercise.sets !== null ? `Sets ${exercise.sets}` : null,
    exercise.reps === null ? null : `Reps ${exercise.reps}`,
    exercise.rir === null ? null : `RIR ${exercise.rir}`,
    exercise.rest === null ? null : `Rest ${exercise.rest}`,
    ...exercise.otherChips,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

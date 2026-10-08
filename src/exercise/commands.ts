import {
  createEmptySet,
  durationFromMinutes,
  elapsedSeconds,
  isBlankSet,
  parseExerciseDefinition,
  parseSessionExercise,
  parseSetCounts,
  parseWorkoutSession,
  type ExerciseDefinition,
  type ExerciseDocument,
  type SessionExercise,
  type WorkoutSession,
} from "./model.ts";

export type SaveExerciseInput = Omit<ExerciseDefinition, "id"> & { id?: string };
export type SaveWorkoutInput = {
  id?: string;
  name: string;
  exerciseIds: string[];
  setCounts?: Record<string, number>;
};
export type PlanWorkoutInput = { date: string; workoutId: string };
export type UpdateSessionInput = {
  id: string;
  name: string;
  exercises: SessionExercise[];
  durationSeconds?: number | null;
};
export type CompleteSessionInput = {
  id: string;
  name: string;
  exercises: SessionExercise[];
  durationMinutes?: string;
};
export type ExerciseChange<Value> = { document: ExerciseDocument; value: Value };

const developmentExamples: ExerciseDefinition[] = [
  {
    id: "development-example-squat",
    name: "Squat",
    tracking: "single",
    equipment: "barbell",
    muscleGroup: "legs",
    notes: "",
  },
  {
    id: "development-example-push-up",
    name: "Push-up",
    tracking: "single",
    equipment: "bodyweight",
    muscleGroup: "chest",
    notes: "",
  },
  {
    id: "development-example-dumbbell-curl",
    name: "Dumbbell curl",
    tracking: "sides",
    equipment: "dumbbells",
    muscleGroup: "arms",
    notes: "",
  },
];
export function seedDevelopmentExamples(document: ExerciseDocument): ExerciseChange<true> {
  if (document.developmentExamplesSeeded) return { document, value: true };
  const existing = new Set(document.exercises.map((exercise) => exercise.id));
  return {
    document: {
      ...document,
      developmentExamplesSeeded: true,
      exercises: [
        ...document.exercises,
        ...developmentExamples
          .filter((exercise) => !existing.has(exercise.id))
          .map((exercise) => ({ ...exercise })),
      ],
    },
    value: true,
  };
}

function requireSession(document: ExerciseDocument, id: string): WorkoutSession {
  const session = document.sessions.find((session) => session.id === id);
  if (!session) throw new Error("This workout is no longer available.");
  return session;
}
function replaceSession(document: ExerciseDocument, value: WorkoutSession): ExerciseChange<true> {
  const session = parseWorkoutSession(value);
  return {
    document: {
      ...document,
      sessions: document.sessions.map((item) => (item.id === session.id ? session : item)),
    },
    value: true,
  };
}
function remove<T extends { id: string }>(items: T[], id: string): T[] {
  if (!items.some((item) => item.id === id)) throw new Error("This item is no longer available.");
  return items.filter((item) => item.id !== id);
}
function name(input: string): string {
  if (typeof input !== "string" || !input.trim() || input.length > 400)
    throw new Error("Enter a name.");
  return input.trim();
}
function loggedExercises(exercises: SessionExercise[]): SessionExercise[] {
  return exercises.map((input) => {
    const row = parseSessionExercise(input);
    return { ...row, sets: row.sets.filter((set) => !isBlankSet(set)) };
  });
}

// All transformations are pure. The persistence boundary validates the complete
// next document before writing it, including IDs and the single-active invariant.
export function createExerciseCommands({
  createId,
  now,
}: {
  createId: () => string;
  now: () => number;
}) {
  return {
    saveExercise(document: ExerciseDocument, input: SaveExerciseInput): ExerciseChange<string> {
      if (
        input.id !== undefined &&
        !document.exercises.some((exercise) => exercise.id === input.id)
      )
        throw new Error("This exercise is no longer available.");
      const exercise = parseExerciseDefinition({
        ...input,
        id: input.id ?? createId(),
        name: name(input.name),
      });
      const exercises =
        input.id === undefined
          ? [...document.exercises, exercise]
          : document.exercises.map((item) => (item.id === exercise.id ? exercise : item));
      return { document: { ...document, exercises }, value: exercise.id };
    },
    removeExercise(document: ExerciseDocument, id: string): ExerciseChange<true> {
      return { document: { ...document, exercises: remove(document.exercises, id) }, value: true };
    },
    saveWorkout(document: ExerciseDocument, input: SaveWorkoutInput): ExerciseChange<string> {
      const previous =
        input.id === undefined ? null : document.workouts.find((item) => item.id === input.id);
      if (input.id !== undefined && !previous)
        throw new Error("This workout is no longer available.");
      if (!Array.isArray(input.exerciseIds) || input.exerciseIds.length === 0)
        throw new Error("Select at least one exercise.");
      const exercises = input.exerciseIds.map((id) => {
        const exercise =
          document.exercises.find((item) => item.id === id) ??
          previous?.exercises.find((item) => item.id === id);
        if (!exercise) throw new Error("An exercise is no longer available.");
        return { ...exercise };
      });
      const sourceCounts = input.setCounts === undefined ? previous?.setCounts : input.setCounts;
      const setCounts =
        sourceCounts === undefined
          ? undefined
          : Object.fromEntries(
              Object.entries(
                parseSetCounts(sourceCounts, [
                  ...input.exerciseIds,
                  ...(previous?.exercises.map((exercise) => exercise.id) ?? []),
                ]),
              ).filter(([id]) => input.exerciseIds.includes(id)),
            );
      const workout = {
        id: input.id ?? createId(),
        name: name(input.name),
        exercises,
        ...(setCounts === undefined ? {} : { setCounts }),
      };
      return {
        document: {
          ...document,
          workouts:
            input.id === undefined
              ? [...document.workouts, workout]
              : document.workouts.map((item) => (item.id === workout.id ? workout : item)),
        },
        value: workout.id,
      };
    },
    removeWorkout(document: ExerciseDocument, id: string): ExerciseChange<true> {
      return { document: { ...document, workouts: remove(document.workouts, id) }, value: true };
    },
    planWorkout(document: ExerciseDocument, input: PlanWorkoutInput): ExerciseChange<string> {
      const workout = document.workouts.find((item) => item.id === input.workoutId);
      if (!workout) throw new Error("This workout is no longer available.");
      const exercises = workout.exercises.map((retained) => {
        const exercise = {
          ...(document.exercises.find((item) => item.id === retained.id) ?? retained),
        };
        const count =
          workout.setCounts && Object.hasOwn(workout.setCounts, retained.id)
            ? workout.setCounts[retained.id]!
            : 0;
        return {
          id: createId(),
          exercise,
          sets: Array.from({ length: count }, () => createEmptySet(exercise.tracking, createId())),
        };
      });
      const session = parseWorkoutSession({
        id: createId(),
        date: input.date,
        name: workout.name.trim(),
        status: "planned",
        startedAt: null,
        durationSeconds: null,
        exercises,
      });
      return {
        document: { ...document, sessions: [...document.sessions, session] },
        value: session.id,
      };
    },
    updateSession(document: ExerciseDocument, input: UpdateSessionInput): ExerciseChange<true> {
      const session = requireSession(document, input.id);
      return replaceSession(document, {
        ...session,
        name: input.name,
        exercises:
          session.status === "completed" ? loggedExercises(input.exercises) : input.exercises,
        durationSeconds:
          session.status === "active" || input.durationSeconds === undefined
            ? session.durationSeconds
            : input.durationSeconds,
      });
    },
    startSession(document: ExerciseDocument, id: string): ExerciseChange<true> {
      const session = requireSession(document, id);
      if (
        session.status !== "planned" ||
        document.sessions.some((item) => item.status === "active")
      )
        throw new Error("A workout is already active or this workout has finished.");
      return replaceSession(document, {
        ...session,
        name: name(session.name),
        status: "active",
        startedAt: now(),
        durationSeconds: null,
      });
    },
    completeSession(document: ExerciseDocument, input: CompleteSessionInput): ExerciseChange<true> {
      const session = requireSession(document, input.id);
      const durationSeconds =
        session.status === "active"
          ? elapsedSeconds(session, now())
          : durationFromMinutes(input.durationMinutes);
      return replaceSession(document, {
        ...session,
        status: "completed",
        name: name(input.name),
        exercises: loggedExercises(input.exercises),
        durationSeconds,
      });
    },
    removeSession(document: ExerciseDocument, id: string): ExerciseChange<true> {
      return { document: { ...document, sessions: remove(document.sessions, id) }, value: true };
    },
  };
}

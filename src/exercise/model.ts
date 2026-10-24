import { parseDay } from "../calendar/dates.ts";
import {
  createEmptySet,
  decimal,
  setHint,
  setMeasurements,
  type SetLine,
  type TrackingMode,
} from "./tracking.ts";

export type CatalogLink = { id: string; slug: string };
export type ExerciseDefinition = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  notes: string;
  /** The Tracking mode; see `tracking.ts`. */
  tracking: "single" | "sides" | "alternating" | "time";
  /** The KineVault exercise whose demonstration this exercise shows. */
  catalog?: CatalogLink;
};
/** `rir`, reps in reserve, is optional; sets saved before it have none. */
export type SetSide = { reps: string; weightKg: string; rir?: string };
/** A set's `kind` is its exercise's Tracking mode. */
export type ExerciseSet =
  | ({ id: string; kind: "single" | "alternating" } & SetSide)
  | { id: string; kind: "sides"; left: SetSide; right: SetSide }
  | { id: string; kind: "time"; seconds: string };
export type SessionExercise = { id: string; exercise: ExerciseDefinition; sets: ExerciseSet[] };
export type WorkoutTemplate = {
  id: string;
  name: string;
  exercises: ExerciseDefinition[];
  setCounts?: Record<string, number>;
};
export type WorkoutSession = {
  id: string;
  date: string;
  name: string;
  status: "planned" | "active" | "completed";
  startedAt: number | null;
  durationSeconds: number | null;
  exercises: SessionExercise[];
};
export type ExerciseDocument = {
  version: 1;
  exercises: ExerciseDefinition[];
  workouts: WorkoutTemplate[];
  sessions: WorkoutSession[];
  developmentExamplesSeeded?: true;
};

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid exercise record");
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, required = false): string {
  if (typeof value !== "string" || value.length > limit || (required && !value.trim()))
    throw new Error("Invalid exercise text");
  return value;
}
function id(value: unknown): string {
  return text(value, 100, true);
}
function list<T>(value: unknown, parse: (item: unknown) => T, limit: number): T[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error("Invalid exercise list");
  return value.map(parse);
}
function unique<T extends { id: string }>(items: T[]): T[] {
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error("Duplicate exercise record ID");
  return items;
}
function seconds(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 31622400)
    throw new Error("Invalid workout duration");
  return value;
}

/** KineVault catalog IDs and slugs, shared by catalog links and catalog rows. */
export const catalogIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const catalogSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
function parseCatalogLink(value: unknown): CatalogLink {
  const item = record(value);
  if (typeof item.id !== "string" || !catalogIdPattern.test(item.id))
    throw new Error("Invalid catalog link");
  if (
    typeof item.slug !== "string" ||
    item.slug.length > 200 ||
    !catalogSlugPattern.test(item.slug)
  )
    throw new Error("Invalid catalog link");
  return { id: item.id, slug: item.slug };
}

export function parseExerciseDefinition(value: unknown): ExerciseDefinition {
  const item = record(value);
  if (
    item.tracking !== "single" &&
    item.tracking !== "sides" &&
    item.tracking !== "alternating" &&
    item.tracking !== "time"
  )
    throw new Error("Invalid exercise tracking");
  const definition: ExerciseDefinition = {
    id: id(item.id),
    name: text(item.name, 400, true),
    muscleGroup: text(item.muscleGroup, 400),
    equipment: text(item.equipment, 400),
    notes: text(item.notes, 4000),
    tracking: item.tracking,
  };
  // A malformed link is dropped rather than failing the whole exercise document.
  if (item.catalog !== undefined) {
    try {
      definition.catalog = parseCatalogLink(item.catalog);
    } catch {
      // The exercise stays usable without its demo.
    }
  }
  return definition;
}
function side(value: unknown): SetSide {
  const item = record(value);
  return {
    reps: text(item.reps, 32),
    weightKg: text(item.weightKg, 32),
    ...(item.rir === undefined ? {} : { rir: text(item.rir, 32) }),
  };
}
function parseSet(value: unknown): ExerciseSet {
  const item = record(value);
  if (item.kind === "single" || item.kind === "alternating")
    return { id: id(item.id), kind: item.kind, ...side(item) };
  if (item.kind === "sides")
    return { id: id(item.id), kind: "sides", left: side(item.left), right: side(item.right) };
  if (item.kind === "time")
    return { id: id(item.id), kind: "time", seconds: text(item.seconds, 32) };
  throw new Error("Invalid exercise set kind");
}
export function parseSessionExercise(value: unknown): SessionExercise {
  const item = record(value);
  const exercise = parseExerciseDefinition(item.exercise);
  const sets = unique(list(item.sets, parseSet, 1000));
  if (sets.some((set) => set.kind !== exercise.tracking))
    throw new Error("Set does not match exercise tracking");
  return { id: id(item.id), exercise, sets };
}

export function durationFromMinutes(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  text(value, 32);
  const minutes = decimal(value, null);
  return seconds(Math.round(minutes * 60));
}
/** Minutes text for a duration. Two decimals keep every whole second through `durationFromMinutes`. */
export function minutesText(durationSeconds: number | null): string {
  return durationSeconds === null ? "" : String(Number((durationSeconds / 60).toFixed(2)));
}
export function parseWorkoutSession(value: unknown): WorkoutSession {
  const item = record(value);
  const status = item.status;
  if (status !== "planned" && status !== "active" && status !== "completed")
    throw new Error("Invalid workout status");
  const date = text(item.date, 10, true);
  parseDay(date);
  const startedAt = item.startedAt;
  if (
    startedAt !== null &&
    (typeof startedAt !== "number" ||
      !Number.isSafeInteger(startedAt) ||
      startedAt < 0 ||
      startedAt > 8640000000000000)
  )
    throw new Error("Invalid workout start time");
  const durationSeconds = seconds(item.durationSeconds);
  if (
    (status === "planned" && startedAt !== null) ||
    (status === "active" && (startedAt === null || durationSeconds !== null))
  )
    throw new Error("Inconsistent workout timer");
  const name = text(item.name, 400, status === "completed");
  const exercises = unique(list(item.exercises, parseSessionExercise, 1000));
  if (status === "completed") {
    if (!exercises.some((row) => row.sets.length > 0)) throw new Error("Enter at least one set.");
    for (const row of exercises) for (const set of row.sets) setMeasurements(set);
    if (startedAt !== null && durationSeconds === null)
      throw new Error("Completed timer needs duration");
  }
  return { id: id(item.id), date, name, status, startedAt, durationSeconds, exercises };
}
export const maxPlannedSets = 100;
/** New workout templates plan three sets per exercise. */
export const defaultPlannedSets = 3;
/** A template's planned sets for an exercise; a legacy template without a count plans none. */
export function plannedSetCount(workout: Pick<WorkoutTemplate, "setCounts">, exerciseId: string) {
  return workout.setCounts && Object.hasOwn(workout.setCounts, exerciseId)
    ? workout.setCounts[exerciseId]!
    : 0;
}
/** A typed planned set count: a whole number from 0 to `maxPlannedSets`, or null. */
export function parsePlannedSetCount(raw: string): number | null {
  const text = raw.trim();
  return /^\d+$/.test(text) && Number(text) <= maxPlannedSets ? Number(text) : null;
}
/** A row's sets resized to `count`: extra sets cut off the end, missing ones added empty. */
export function resizeSets(
  sets: readonly ExerciseSet[],
  tracking: TrackingMode,
  count: number,
  newId: () => string,
): ExerciseSet[] {
  return [
    ...sets.slice(0, count),
    ...Array.from({ length: Math.max(0, count - sets.length) }, () =>
      createEmptySet(tracking, newId()),
    ),
  ];
}
export function plannedSetCountMessage(exerciseName: string) {
  return `Enter a whole number of sets from 0 to ${maxPlannedSets} for ${exerciseName}.`;
}
export function parseSetCounts(
  value: unknown,
  exerciseIds: readonly string[],
): Record<string, number> {
  const counts = record(value);
  const allowed = new Set(exerciseIds);
  return Object.fromEntries(
    Object.entries(counts).map(([exerciseId, count]) => {
      if (
        !allowed.has(exerciseId) ||
        typeof count !== "number" ||
        !Number.isSafeInteger(count) ||
        count < 0 ||
        count > maxPlannedSets
      )
        throw new Error(
          `Set counts must be whole numbers from 0 to ${maxPlannedSets} for selected exercises.`,
        );
      return [exerciseId, count];
    }),
  );
}
function template(value: unknown): WorkoutTemplate {
  const item = record(value);
  const exercises = unique(list(item.exercises, parseExerciseDefinition, 1000));
  if (!exercises.length) throw new Error("Select at least one exercise");
  return {
    id: id(item.id),
    name: text(item.name, 400, true),
    exercises,
    ...(item.setCounts === undefined
      ? {}
      : {
          setCounts: parseSetCounts(
            item.setCounts,
            exercises.map((exercise) => exercise.id),
          ),
        }),
  };
}
export function parseExerciseDocument(raw: string | null): ExerciseDocument {
  if (raw === null) return { version: 1, exercises: [], workouts: [], sessions: [] };
  const value = record(JSON.parse(raw));
  if (value.version !== 1) throw new Error("Unsupported exercise document");
  if (value.developmentExamplesSeeded !== undefined && value.developmentExamplesSeeded !== true)
    throw new Error("Invalid development example marker");
  const exercises = unique(list(value.exercises, parseExerciseDefinition, 10000));
  const workouts = unique(list(value.workouts, template, 10000));
  const sessions = unique(list(value.sessions, parseWorkoutSession, 50000));
  if (sessions.filter((session) => session.status === "active").length > 1)
    throw new Error("Only one workout may be active");
  return {
    version: 1,
    exercises,
    workouts,
    sessions,
    ...(value.developmentExamplesSeeded === true
      ? { developmentExamplesSeeded: true as const }
      : {}),
  };
}
/** The Active workout: the one log with a running timer, whatever its date. */
export function activeWorkout(sessions: readonly WorkoutSession[]): WorkoutSession | null {
  return sessions.find((session) => session.status === "active") ?? null;
}
/** Whole seconds as the timer shows them, minutes:seconds. */
export function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function elapsedSeconds(session: WorkoutSession, now: number): number {
  if (session.status !== "active" || session.startedAt === null)
    return session.status === "completed" ? (session.durationSeconds ?? 0) : 0;
  if (!Number.isFinite(now)) throw new Error("Invalid current time");
  return Math.max(0, Math.floor((now - session.startedAt) / 1000));
}

/**
 * Library exercises whose name, muscle group, equipment or notes contain the typed `query`, in
 * any case. A blank query matches nothing.
 */
export function matchingExercises(
  exercises: readonly ExerciseDefinition[],
  query: string,
): ExerciseDefinition[] {
  const search = query.trim().toLocaleLowerCase();
  if (!search) return [];
  return exercises.filter((exercise) =>
    [exercise.name, exercise.muscleGroup, exercise.equipment, exercise.notes].some((text) =>
      text.toLocaleLowerCase().includes(search),
    ),
  );
}

/** Sets from the latest other completed workout with this exercise, on or before `session`'s day. */
function previousSets(
  sessions: readonly WorkoutSession[],
  session: Pick<WorkoutSession, "id" | "date">,
  exerciseId: string,
): ExerciseSet[] {
  let latest: { date: string; sets: ExerciseSet[] } | null = null;
  for (const other of sessions) {
    if (other.id === session.id || other.status !== "completed" || other.date > session.date)
      continue;
    const row = other.exercises.find((item) => item.exercise.id === exerciseId);
    if (row?.sets.length && (!latest || other.date > latest.date))
      latest = { date: other.date, sets: row.sets };
  }
  return latest?.sets ?? [];
}
/** A set's placeholder values line by line; undefined where there is nothing to show. */
export type SetHint = SetLine[];
/**
 * The Previous sets hint for each set of `row`: the matching set from the latest other Completed
 * workout with this exercise on or before `session`'s day; none past that workout's sets.
 */
export function setHints(
  sessions: readonly WorkoutSession[],
  session: Pick<WorkoutSession, "id" | "date">,
  row: SessionExercise,
): SetHint[] {
  const previous = previousSets(sessions, session, row.exercise.id);
  return row.sets.map((set, index) => setHint(set, previous[index]));
}

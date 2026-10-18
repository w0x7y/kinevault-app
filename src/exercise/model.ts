import { parseDay } from "../calendar/dates.ts";

export type CatalogLink = { id: string; slug: string };
export type ExerciseDefinition = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  notes: string;
  tracking: "single" | "sides";
  /** The KineVault exercise whose demonstration this exercise shows. */
  catalog?: CatalogLink;
};
export type SetSide = { reps: string; weightKg: string };
export type ExerciseSet =
  | { id: string; kind: "single"; reps: string; weightKg: string }
  | { id: string; kind: "sides"; left: SetSide; right: SetSide };
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

const catalogIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const catalogSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function parseCatalogLink(value: unknown): CatalogLink {
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
  if (item.tracking !== "single" && item.tracking !== "sides")
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
  return { reps: text(item.reps, 32), weightKg: text(item.weightKg, 32) };
}
function parseSet(value: unknown): ExerciseSet {
  const item = record(value);
  if (item.kind === "single") return { id: id(item.id), kind: "single", ...side(item) };
  if (item.kind === "sides")
    return { id: id(item.id), kind: "sides", left: side(item.left), right: side(item.right) };
  throw new Error("Invalid exercise set kind");
}
export function createEmptySet(
  tracking: ExerciseDefinition["tracking"],
  setId: string,
): ExerciseSet {
  return parseSet(
    tracking === "single"
      ? { id: setId, kind: tracking, reps: "", weightKg: "" }
      : {
          id: setId,
          kind: tracking,
          left: { reps: "", weightKg: "" },
          right: { reps: "", weightKg: "" },
        },
  );
}
export function isBlankSet(set: ExerciseSet): boolean {
  const blankSide = (side: SetSide) => !side.reps.trim() && !side.weightKg.trim();
  return set.kind === "single" ? blankSide(set) : blankSide(set.left) && blankSide(set.right);
}
export function parseSessionExercise(value: unknown): SessionExercise {
  const item = record(value);
  const exercise = parseExerciseDefinition(item.exercise);
  const sets = unique(list(item.sets, parseSet, 1000));
  if (sets.some((set) => set.kind !== exercise.tracking))
    throw new Error("Set does not match exercise tracking");
  return { id: id(item.id), exercise, sets };
}

function decimal(value: string, blank: number | null): number {
  const input = value.trim();
  if (input === "" && blank !== null) return blank;
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(input))
    throw new Error("Enter weights and minutes as numbers of 0 or more.");
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000)
    throw new Error("Enter weights and minutes of 100,000 or less.");
  return amount;
}
function measurement(value: SetSide, zeroAllowed: boolean) {
  if (zeroAllowed && !value.reps.trim() && !value.weightKg.trim()) return { reps: 0, weightKg: 0 };
  if (!/^\d+$/.test(value.reps.trim())) throw new Error("Enter whole repetitions for each set.");
  const reps = Number(value.reps.trim());
  if (!Number.isSafeInteger(reps) || reps < (zeroAllowed ? 0 : 1) || reps > 100000)
    throw new Error("Enter from 1 to 100,000 repetitions for each set.");
  return { reps, weightKg: decimal(value.weightKg, 0) };
}
export function setMeasurements(set: ExerciseSet): {
  reps: number;
  volume: number;
  weights: number[];
} {
  const values =
    set.kind === "single"
      ? [measurement(set, false)]
      : [measurement(set.left, true), measurement(set.right, true)];
  const reps = values.reduce((sum, value) => sum + value.reps, 0);
  if (reps === 0) throw new Error("Enter repetitions on at least one side of each set.");
  return {
    reps,
    volume: values.reduce((sum, value) => sum + value.reps * value.weightKg, 0),
    weights: values.filter((value) => value.reps > 0).map((value) => value.weightKg),
  };
}
export function durationFromMinutes(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  text(value, 32);
  const minutes = decimal(value, null);
  return seconds(Math.round(minutes * 60));
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
/** A typed planned set count: a whole number from 0 to `maxPlannedSets`, or null. */
export function parsePlannedSetCount(raw: string): number | null {
  const text = raw.trim();
  return /^\d+$/.test(text) && Number(text) <= maxPlannedSets ? Number(text) : null;
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
export function elapsedSeconds(session: WorkoutSession, now: number): number {
  if (session.status !== "active" || session.startedAt === null)
    return session.status === "completed" ? (session.durationSeconds ?? 0) : 0;
  if (!Number.isFinite(now)) throw new Error("Invalid current time");
  return Math.max(0, Math.floor((now - session.startedAt) / 1000));
}

/**
 * Library exercises whose name, muscle group, equipment or notes contain `search`, which is
 * already trimmed and lowercased.
 */
export function matchingExercises(
  exercises: readonly ExerciseDefinition[],
  search: string,
): ExerciseDefinition[] {
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
type SideHint = { reps: string | undefined; weightKg: string | undefined };
/** A set's placeholder values; undefined where there is nothing to show. */
export type SetHint =
  ({ kind: "single" } & SideHint) | { kind: "sides"; left: SideHint; right: SideHint };
/**
 * The Previous sets hint for each set of `row`: the matching set from the latest other Completed
 * workout with this exercise on or before `session`'s day, or failing that the set above it.
 */
export function setHints(
  sessions: readonly WorkoutSession[],
  session: Pick<WorkoutSession, "id" | "date">,
  row: SessionExercise,
): SetHint[] {
  const previous = previousSets(sessions, session, row.exercise.id);
  return row.sets.map((set, index) => {
    const source = previous[index] ?? row.sets[index - 1];
    // A single-load set reads a two-sided source's left side; sides read a single load on both.
    const side = (name: "left" | "right"): SideHint => {
      const values = !source ? null : source.kind === "single" ? source : source[name];
      return { reps: values?.reps || undefined, weightKg: values?.weightKg || undefined };
    };
    return set.kind === "single"
      ? { kind: "single", ...side("left") }
      : { kind: "sides", left: side("left"), right: side("right") };
  });
}

import {
  parseExerciseDefinition,
  type ExerciseDefinition,
  type ExerciseDocument,
  type WorkoutTemplate,
} from "../model.ts";
import { prescriptionText, type ImportedWorkoutPlan } from "./plan.ts";

// These mirror the list limits that parseExerciseDocument enforces.
export const exerciseLibraryLimit = 10000;
export const workoutLibraryLimit = 10000;
// New workout templates plan three sets when the source gives no count.
const defaultSetCount = 3;
const maxSetCount = 100;

export type WorkoutImportRow = {
  key: string;
  label: string;
  name: string;
  prescription: string;
  status: "library" | "new";
  tracking: ExerciseDefinition["tracking"];
  /** A new exercise tracks left and right because its name says Unilateral. */
  sidesFromName: boolean;
};
export type WorkoutImportPreview = {
  templateId: string;
  name: string;
  category: string | null;
  rows: WorkoutImportRow[];
  /** Exercises in the saved workout after repeated names are combined. */
  exerciseCount: number;
  newExercises: number;
  repeated: { name: string; count: number; sets: number }[];
  /** The workout saved by an earlier import of the same link, which importing replaces. */
  replacing: WorkoutTemplate | null;
  problem: string | null;
};
export type WorkoutImportResult = {
  templateId: string;
  name: string;
  exercises: number;
  created: number;
  replaced: boolean;
};

type Entry = {
  name: string;
  existing: ExerciseDefinition | null;
  draft: Omit<ExerciseDefinition, "id">;
  count: number;
  knownSets: number | null;
};

/** Library matching ignores case, Unicode width variants and repeated spaces. */
function exerciseNameKey(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}
/** Imported workouts have stable IDs, so importing the same link again finds its workout. */
function importedTemplateId(plan: Pick<ImportedWorkoutPlan, "source" | "sourceId">): string {
  if (!/^[0-9a-f-]{1,64}$/.test(plan.sourceId)) throw new Error("Invalid imported workout.");
  return `${plan.source}-${plan.sourceId}`;
}

const equipmentKeywords: [RegExp, string][] = [
  [/\bsmith\b/i, "smith machine"],
  [/\bkettlebells?\b/i, "kettlebell"],
  [/\bdumbbells?\b/i, "dumbbell"],
  [/\bbarbells?\b/i, "barbell"],
  [/\bcables?\b/i, "cable"],
  [/\bbands?\b/i, "band"],
  [/\bmachines?\b/i, "machine"],
];
function inferEquipment(name: string): string {
  return equipmentKeywords.find(([pattern]) => pattern.test(name))?.[1] ?? "";
}
function sidesFromName(name: string): boolean {
  return /\bunilateral\b/i.test(name);
}

function prepare(document: ExerciseDocument, plan: ImportedWorkoutPlan) {
  const templateId = importedTemplateId(plan);
  const name = plan.name.trim();
  const library = new Map<string, ExerciseDefinition>();
  for (const exercise of document.exercises) {
    const key = exerciseNameKey(exercise.name);
    if (!library.has(key)) library.set(key, exercise);
  }
  const entries = new Map<string, Entry>();
  const rows: WorkoutImportRow[] = [];
  for (const [position, exercise] of plan.exercises.entries()) {
    const key = exerciseNameKey(exercise.name);
    let entry = entries.get(key);
    if (entry) {
      entry.count++;
      if (exercise.sets !== null) entry.knownSets = (entry.knownSets ?? 0) + exercise.sets;
    } else {
      const existing = library.get(key) ?? null;
      const sides = sidesFromName(exercise.name);
      entry = {
        name: existing?.name ?? exercise.name,
        existing,
        // Notes are written only for new exercises; library exercises keep their own.
        draft: {
          name: exercise.name,
          muscleGroup: "",
          equipment: inferEquipment(exercise.name),
          notes: prescriptionText(exercise, false).slice(0, 4000),
          tracking: sides ? "sides" : "single",
        },
        count: 1,
        knownSets: exercise.sets,
      };
      entries.set(key, entry);
    }
    rows.push({
      key: exercise.sourceId ?? `${exercise.label}-${position}`,
      label: exercise.label,
      name: exercise.name,
      prescription: prescriptionText(exercise),
      status: entry.existing ? "library" : "new",
      tracking: entry.existing?.tracking ?? entry.draft.tracking,
      sidesFromName: !entry.existing && entry.draft.tracking === "sides",
    });
  }
  const list = [...entries.values()];
  const sets = (entry: Entry) => Math.min(maxSetCount, entry.knownSets ?? defaultSetCount);
  const replacing = document.workouts.find((workout) => workout.id === templateId) ?? null;
  const newExercises = list.filter((entry) => !entry.existing).length;
  const problem = !name
    ? "This workout has no name."
    : list.length === 0
      ? "This workout has no exercises."
      : document.exercises.length + newExercises > exerciseLibraryLimit
        ? "Your exercise library is full. Delete exercises you no longer use, then import again."
        : !replacing && document.workouts.length >= workoutLibraryLimit
          ? "You have the most saved workouts allowed. Delete one, then import again."
          : null;
  const preview: WorkoutImportPreview = {
    templateId,
    name,
    category: plan.category,
    rows,
    exerciseCount: list.length,
    newExercises,
    repeated: list
      .filter((entry) => entry.count > 1)
      .map((entry) => ({ name: entry.name, count: entry.count, sets: sets(entry) })),
    replacing,
    problem,
  };
  return { preview, entries: list, sets };
}

export function previewWorkoutImport(
  document: ExerciseDocument,
  plan: ImportedWorkoutPlan,
): WorkoutImportPreview {
  return prepare(document, plan).preview;
}

/**
 * Adds the plan as one workout template, reusing library exercises by name and
 * creating the rest. The whole change is one document, so it commits as one write.
 */
export function applyWorkoutImport(
  document: ExerciseDocument,
  plan: ImportedWorkoutPlan,
  createId: () => string,
): { document: ExerciseDocument; value: WorkoutImportResult } {
  const { preview, entries, sets } = prepare(document, plan);
  if (preview.problem) throw new Error(preview.problem);
  const created: ExerciseDefinition[] = [];
  const definitions = entries.map((entry) => {
    if (entry.existing) return { ...entry.existing };
    const definition = parseExerciseDefinition({ ...entry.draft, id: createId() });
    created.push(definition);
    return { ...definition };
  });
  const template: WorkoutTemplate = {
    id: preview.templateId,
    name: preview.name,
    exercises: definitions,
    setCounts: Object.fromEntries(
      definitions.map((definition, index) => [definition.id, sets(entries[index]!)]),
    ),
  };
  return {
    document: {
      ...document,
      exercises: [...document.exercises, ...created],
      workouts: preview.replacing
        ? document.workouts.map((workout) => (workout.id === template.id ? template : workout))
        : [...document.workouts, template],
    },
    value: {
      templateId: template.id,
      name: template.name,
      exercises: definitions.length,
      created: created.length,
      replaced: preview.replacing !== null,
    },
  };
}

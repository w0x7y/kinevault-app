import type { SaveWorkoutInput } from "./commands.ts";
import {
  parsePlannedSetCount,
  plannedSetCountMessage,
  type ExerciseDefinition,
  type WorkoutTemplate,
} from "./model.ts";

type TemplateDraftRow = {
  /** The exercise's ID; a template holds each exercise once. */
  readonly id: string;
  readonly exercise: Readonly<ExerciseDefinition>;
  readonly rawCount: string;
};
export type TemplateDraftPreparation =
  { kind: "ready"; input: SaveWorkoutInput } | { kind: "invalid"; message: string };

export type WorkoutTemplateDraft = {
  readonly name: string;
  readonly rows: readonly TemplateDraftRow[];
  rename(name: string): WorkoutTemplateDraft;
  add(exercise: ExerciseDefinition): WorkoutTemplateDraft;
  remove(exerciseId: string): WorkoutTemplateDraft;
  move(index: number, direction: -1 | 1): WorkoutTemplateDraft;
  setCount(exerciseId: string, rawCount: string): WorkoutTemplateDraft;
  prepare(): TemplateDraftPreparation;
};

function draftValue(
  id: string | undefined,
  name: string,
  selected: readonly Readonly<ExerciseDefinition>[],
  rawCounts: ReadonlyMap<string, string>,
): WorkoutTemplateDraft {
  const draft: WorkoutTemplateDraft = {
    name,
    rows: selected.map((exercise) => ({
      id: exercise.id,
      exercise,
      rawCount: rawCounts.get(exercise.id)!,
    })),
    rename: (nextName) => draftValue(id, nextName, selected, rawCounts),
    add(exercise) {
      if (selected.some((row) => row.id === exercise.id)) return draft;
      const nextCounts = new Map(rawCounts);
      if (!nextCounts.has(exercise.id)) nextCounts.set(exercise.id, "3");
      return draftValue(id, name, [...selected, { ...exercise }], nextCounts);
    },
    remove: (exerciseId) =>
      draftValue(
        id,
        name,
        selected.filter((exercise) => exercise.id !== exerciseId),
        rawCounts,
      ),
    move(index, direction) {
      const destination = index + direction;
      if (
        index < 0 ||
        index >= selected.length ||
        destination < 0 ||
        destination >= selected.length
      )
        return draft;
      const next = [...selected];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return draftValue(id, name, next, rawCounts);
    },
    setCount(exerciseId, rawCount) {
      if (!selected.some((exercise) => exercise.id === exerciseId)) return draft;
      const nextCounts = new Map(rawCounts);
      nextCounts.set(exerciseId, rawCount);
      return draftValue(id, name, selected, nextCounts);
    },
    prepare() {
      const counts: [string, number][] = [];
      for (const row of draft.rows) {
        const count = parsePlannedSetCount(row.rawCount);
        if (count === null)
          return { kind: "invalid", message: plannedSetCountMessage(row.exercise.name) };
        counts.push([row.exercise.id, count]);
      }
      return {
        kind: "ready",
        input: {
          ...(id === undefined ? {} : { id }),
          name,
          exerciseIds: selected.map((exercise) => exercise.id),
          setCounts: Object.fromEntries(counts),
        },
      };
    },
  };
  return draft;
}

export function createWorkoutTemplateDraft(workout?: WorkoutTemplate): WorkoutTemplateDraft {
  const selected = (workout?.exercises ?? []).map((exercise) => ({ ...exercise }));
  const rawCounts = new Map(
    selected.map((exercise) => [exercise.id, String(workout?.setCounts?.[exercise.id] ?? 0)]),
  );
  return draftValue(workout?.id, workout?.name ?? "", selected, rawCounts);
}

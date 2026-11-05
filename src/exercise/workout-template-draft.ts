import type { SaveWorkoutInput } from "./commands.ts";
import {
  defaultPlannedSets,
  parsePlannedSetCount,
  plannedSetCount,
  plannedSetCountMessage,
  templateSuperset,
  type ExerciseDefinition,
  type WorkoutTemplate,
} from "./model.ts";
import { linkToNext, moveRow, validGroups } from "./supersets.ts";

type TemplateDraftRow = {
  /** The exercise's ID; a template holds each exercise once. */
  readonly id: string;
  readonly exercise: Readonly<ExerciseDefinition>;
  readonly rawCount: string;
  readonly superset?: string;
};
type TemplateDraftPreparation =
  { kind: "ready"; input: SaveWorkoutInput } | { kind: "invalid"; message: string };
/** A chosen exercise and its superset key, if it's in a Superset. */
type Item = { readonly exercise: Readonly<ExerciseDefinition>; readonly superset?: string };

export type WorkoutTemplateDraft = {
  readonly name: string;
  readonly rows: readonly TemplateDraftRow[];
  rename(name: string): WorkoutTemplateDraft;
  add(exercise: ExerciseDefinition): WorkoutTemplateDraft;
  remove(exerciseId: string): WorkoutTemplateDraft;
  move(index: number, direction: -1 | 1): WorkoutTemplateDraft;
  /** Joins an exercise and the one after it into a Superset, or splits them. */
  link(exerciseId: string, linked: boolean): WorkoutTemplateDraft;
  setCount(exerciseId: string, rawCount: string): WorkoutTemplateDraft;
  prepare(): TemplateDraftPreparation;
};

function draftValue(
  id: string | undefined,
  name: string,
  selected: readonly Item[],
  rawCounts: ReadonlyMap<string, string>,
): WorkoutTemplateDraft {
  const has = (exerciseId: string) => selected.some((item) => item.exercise.id === exerciseId);
  const draft: WorkoutTemplateDraft = {
    name,
    rows: selected.map(({ exercise, superset }) => ({
      id: exercise.id,
      exercise,
      rawCount: rawCounts.get(exercise.id)!,
      ...(superset === undefined ? {} : { superset }),
    })),
    rename: (nextName) => draftValue(id, nextName, selected, rawCounts),
    add(exercise) {
      if (has(exercise.id)) return draft;
      const nextCounts = new Map(rawCounts);
      if (!nextCounts.has(exercise.id)) nextCounts.set(exercise.id, String(defaultPlannedSets));
      return draftValue(id, name, [...selected, { exercise: { ...exercise } }], nextCounts);
    },
    remove: (exerciseId) =>
      draftValue(
        id,
        name,
        validGroups(selected.filter((item) => item.exercise.id !== exerciseId)),
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
      return draftValue(id, name, moveRow(selected, index, destination), rawCounts);
    },
    link(exerciseId, linked) {
      const index = selected.findIndex((item) => item.exercise.id === exerciseId);
      const linkedItems = linkToNext(selected, index, linked);
      return linkedItems === selected ? draft : draftValue(id, name, linkedItems, rawCounts);
    },
    setCount(exerciseId, rawCount) {
      if (!has(exerciseId)) return draft;
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
      const supersets = draft.rows.flatMap((row) =>
        row.superset === undefined ? [] : [[row.id, row.superset] as const],
      );
      return {
        kind: "ready",
        input: {
          ...(id === undefined ? {} : { id }),
          name,
          exerciseIds: draft.rows.map((row) => row.id),
          setCounts: Object.fromEntries(counts),
          ...(supersets.length ? { supersets: Object.fromEntries(supersets) } : {}),
        },
      };
    },
  };
  return draft;
}

export function createWorkoutTemplateDraft(workout?: WorkoutTemplate): WorkoutTemplateDraft {
  const selected = (workout?.exercises ?? []).map((exercise) => {
    const superset = workout && templateSuperset(workout, exercise.id);
    return { exercise: { ...exercise }, ...(superset === undefined ? {} : { superset }) };
  });
  const rawCounts = new Map(
    selected.map(({ exercise }) => [
      exercise.id,
      String(workout ? plannedSetCount(workout, exercise.id) : 0),
    ]),
  );
  return draftValue(workout?.id, workout?.name ?? "", selected, rawCounts);
}

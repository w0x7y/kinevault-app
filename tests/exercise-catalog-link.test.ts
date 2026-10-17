import assert from "node:assert/strict";
import test from "node:test";
import {
  parseExerciseDefinition,
  parseExerciseDocument,
  type ExerciseDefinition,
  type ExerciseDocument,
} from "../src/exercise/model.ts";
import { createExerciseCommands } from "../src/exercise/commands.ts";

const link = { id: "3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192", slug: "dumbbell-shoulder-press" };
const press: ExerciseDefinition = {
  id: "press",
  name: "Shoulder press",
  muscleGroup: "Shoulders",
  equipment: "Dumbbells",
  notes: "",
  tracking: "single",
  catalog: link,
};
const empty = (): ExerciseDocument => ({ version: 1, exercises: [], workouts: [], sessions: [] });
function commands() {
  let sequence = 0;
  return createExerciseCommands({ createId: () => `id-${++sequence}`, now: () => 0 });
}

test("an exercise without a link has no catalog field", () => {
  const { catalog: _catalog, ...plain } = press;
  assert.equal("catalog" in parseExerciseDefinition(plain), false);
  assert.equal("catalog" in parseExerciseDefinition({ ...plain, catalog: undefined }), false);
});

test("malformed KineVault links are dropped without failing the exercise", () => {
  for (const catalog of [
    null,
    "dumbbell-shoulder-press",
    { id: "not-a-uuid", slug: link.slug },
    { id: link.id.toUpperCase(), slug: link.slug },
    { id: link.id, slug: "Bad Slug" },
    { id: link.id, slug: "a".repeat(201) },
  ]) {
    const parsed = parseExerciseDefinition({ ...press, catalog });
    assert.equal("catalog" in parsed, false);
    const { catalog: _catalog, ...rest } = press;
    assert.deepEqual(parsed, rest);
  }
});

test("one malformed link does not make the stored document unreadable", () => {
  const stored = parseExerciseDocument(
    JSON.stringify({
      ...empty(),
      exercises: [
        { ...press, catalog: { id: "not-a-uuid", slug: link.slug } },
        { ...press, id: "other" },
      ],
    }),
  );
  assert.equal("catalog" in stored.exercises[0]!, false);
  assert.deepEqual(stored.exercises[1]!.catalog, link);
});

test("saved exercises, templates, planned workouts and stored documents carry the link", () => {
  const exerciseCommands = commands();
  const saved = exerciseCommands.saveExercise(empty(), { ...press, id: undefined });
  assert.deepEqual(saved.document.exercises[0]!.catalog, link);
  const workout = exerciseCommands.saveWorkout(saved.document, {
    name: "Upper",
    exerciseIds: [saved.value],
  });
  assert.deepEqual(workout.document.workouts[0]!.exercises[0]!.catalog, link);
  const planned = exerciseCommands.planWorkout(workout.document, {
    date: "2026-10-13",
    workoutId: workout.value,
  });
  assert.deepEqual(planned.document.sessions[0]!.exercises[0]!.exercise.catalog, link);
  const stored = parseExerciseDocument(JSON.stringify(planned.document));
  assert.deepEqual(stored.exercises[0]!.catalog, link);
});

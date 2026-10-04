import assert from "node:assert/strict";
import test from "node:test";
import { createCompletedSessionDrafts } from "../src/exercise/session-drafts.ts";
import type { ExerciseDefinition, WorkoutSession } from "../src/exercise/model.ts";

const squat: ExerciseDefinition = { id: "squat", name: "Squat", muscleGroup: "", equipment: "", notes: "", tracking: "single" };
const curl: ExerciseDefinition = { ...squat, id: "curl", name: "Curl", tracking: "sides" };
const session: WorkoutSession = { id: "completed", date: "2026-10-04", name: "Morning", status: "completed", startedAt: null,
  durationSeconds: 600, exercises: [{ id: "squat-row", exercise: squat, sets: [{ id: "set", kind: "single", reps: "5", weightKg: "40" }] }] };

test("completed local fields and repeated picker additions survive reopening without changing saved history", () => {
  const drafts = createCompletedSessionDrafts();
  let sequence = 0;
  const createId = () => `row-${++sequence}`;
  const initial = drafts.open(session, createId);
  drafts.write(session.id, { ...initial, name: "Edited locally", minutes: "12.5", exercises: initial.exercises.map(row => ({ ...row,
    sets: [{ id: "set", kind: "single", reps: "8", weightKg: "42" }] })) });
  const firstAddition = drafts.open(session, createId, curl);
  drafts.write(session.id, firstAddition);
  const secondAddition = drafts.open(session, createId, squat);
  drafts.write(session.id, secondAddition);
  assert.equal(secondAddition.name, "Edited locally");
  assert.equal(secondAddition.minutes, "12.5");
  assert.deepEqual(secondAddition.exercises[0]!.sets, [{ id: "set", kind: "single", reps: "8", weightKg: "42" }]);
  assert.deepEqual(secondAddition.exercises.map(row => row.exercise.id), ["squat", "curl", "squat"]);
  assert.equal(firstAddition.exercises.length, 2);
  assert.equal(new Set(secondAddition.exercises.map(row => row.id)).size, 3);
  assert.equal(session.name, "Morning");
  assert.equal(session.durationSeconds, 600);
  assert.equal(session.exercises.length, 1);
  assert.deepEqual(session.exercises[0]!.sets, [{ id: "set", kind: "single", reps: "5", weightKg: "40" }]);
  assert.equal(drafts.open(session, createId), secondAddition);
});

test("explicit cancellation and removed-session pruning release local drafts", () => {
  const drafts = createCompletedSessionDrafts();
  const createId = () => "added-row";
  drafts.write(session.id, { name: "Unsaved", exercises: [], minutes: "9" });
  drafts.discard(session.id);
  assert.equal(drafts.open(session, createId).name, "Morning");
  drafts.write(session.id, { name: "Again unsaved", exercises: [], minutes: "5" });
  drafts.prune([]);
  assert.equal(drafts.open(session, createId).name, "Morning");
  drafts.write(session.id, { name: "Keep this draft", exercises: [], minutes: "7" });
  drafts.prune([session.id]);
  assert.equal(drafts.open(session, createId).name, "Keep this draft");
});

test("repeated initialization reads do not accumulate an uncommitted picker addition", () => {
  const drafts = createCompletedSessionDrafts();
  let sequence = 0;
  const createId = () => `strict-${++sequence}`;
  const first = drafts.open(session, createId, curl);
  const repeated = drafts.open(session, createId, curl);
  assert.equal(first.exercises.length, 2);
  assert.equal(repeated.exercises.length, 2);
  assert.equal(drafts.open(session, createId).exercises.length, 1);
});

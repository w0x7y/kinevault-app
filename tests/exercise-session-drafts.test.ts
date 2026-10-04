import assert from "node:assert/strict";
import test from "node:test";
import { createCompletedSessionDrafts } from "../src/exercise/session-drafts.ts";
import type { ExerciseDefinition, WorkoutSession } from "../src/exercise/model.ts";

const squat: ExerciseDefinition = { id: "squat", name: "Squat", muscleGroup: "", equipment: "", notes: "", tracking: "single" };
const session: WorkoutSession = { id: "completed", date: "2026-10-04", name: "Morning", status: "completed", startedAt: null,
  durationSeconds: 600, exercises: [{ id: "squat-row", exercise: squat, sets: [{ id: "set", kind: "single", reps: "5", weightKg: "40" }] }] };

test("completed local fields survive panel changes without changing saved history", () => {
  const drafts = createCompletedSessionDrafts();
  const initial = drafts.open(session);
  const edited = { ...initial, name: "Edited locally", minutes: "12.5", exercises: initial.exercises.map(row => ({ ...row,
    sets: [{ id: "set", kind: "single" as const, reps: "8", weightKg: "42" }] })) };
  drafts.write(session.id, edited);
  const reopened = drafts.open(session);
  assert.equal(reopened.name, "Edited locally");
  assert.equal(reopened.minutes, "12.5");
  assert.deepEqual(reopened.exercises[0]!.sets, [{ id: "set", kind: "single", reps: "8", weightKg: "42" }]);
  assert.equal(session.name, "Morning");
  assert.equal(session.durationSeconds, 600);
  assert.equal(session.exercises.length, 1);
  assert.deepEqual(session.exercises[0]!.sets, [{ id: "set", kind: "single", reps: "5", weightKg: "40" }]);
  assert.equal(reopened, edited);
});

test("explicit cancellation and removed-session pruning release local drafts", () => {
  const drafts = createCompletedSessionDrafts();
  drafts.write(session.id, { name: "Unsaved", exercises: [], minutes: "9" });
  drafts.discard(session.id);
  assert.equal(drafts.open(session).name, "Morning");
  drafts.write(session.id, { name: "Again unsaved", exercises: [], minutes: "5" });
  drafts.prune([]);
  assert.equal(drafts.open(session).name, "Morning");
  drafts.write(session.id, { name: "Keep this draft", exercises: [], minutes: "7" });
  drafts.prune([session.id]);
  assert.equal(drafts.open(session).name, "Keep this draft");
});

test("drafts for different workouts on the same date stay separate", () => {
  const drafts = createCompletedSessionDrafts();
  const second = { ...session, id: "evening", name: "Evening", durationSeconds: null };
  drafts.write(session.id, { name: "Morning edit", exercises: [], minutes: "7" });
  assert.deepEqual(drafts.open(second), { name: "Evening", exercises: session.exercises, minutes: "" });
  drafts.write(second.id, { name: "Evening edit", exercises: [], minutes: "9" });
  assert.equal(drafts.open(session).minutes, "7");
  assert.equal(drafts.open(second).minutes, "9");
  drafts.prune([second.id]);
  assert.equal(drafts.open(session).name, "Morning");
  assert.equal(drafts.open(second).name, "Evening edit");
});

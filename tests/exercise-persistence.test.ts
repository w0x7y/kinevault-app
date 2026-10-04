import assert from "node:assert/strict";
import test from "node:test";
import { createExercisePersistence, exerciseStorageKey } from "../src/exercise/persistence.ts";
import { parseExerciseDocument, type SessionExercise } from "../src/exercise/model.ts";
import type { DurableStorage } from "../src/persistence/durable-write.ts";

const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(initial: string | null = null, development = false) {
  let raw = initial, clock = 1000000, ids = 0, writes = 0;
  const storage: DurableStorage = { async getItem(key) { assert.equal(key, exerciseStorageKey); return raw; },
    async setItem(key, value) { assert.equal(key, exerciseStorageKey); ++writes; raw = value; } };
  const store = createExercisePersistence({ storage, development, createId: () => `id-${++ids}`, now: () => clock });
  return { store, storage, raw: () => raw, writes: () => writes, setRaw: (value: string) => { raw = value; }, setNow: (value: number) => { clock = value; } };
}
async function ready(initial: string | null = null, development = false) { const f = fixture(initial, development); f.store.start(); await flush(); assert.equal(f.store.getSnapshot().state.kind, "ready"); return f; }
function doc(store: ReturnType<typeof fixture>["store"]) { const state = store.getSnapshot().state; if (state.kind !== "ready") throw new Error("Not ready"); return state.document; }
async function planned(f: ReturnType<typeof fixture>, name = "Strength") {
  const exerciseId = await f.store.saveExercise({ name: "Squat", muscleGroup: "Legs", equipment: "Barbell", notes: "", tracking: "single" }); assert.ok(exerciseId);
  const workoutId = await f.store.saveWorkout({ name, exerciseIds: [exerciseId] }); assert.ok(workoutId);
  const sessionId = await f.store.planWorkout({ date: "2026-10-04", workoutId }); assert.ok(sessionId);
  return { sessionId, exerciseId, workoutId };
}
function entered(f: ReturnType<typeof fixture>, sessionId: string, reps = "8"): SessionExercise[] {
  return doc(f.store).sessions.find(session => session.id === sessionId)!.exercises.map(row => ({ ...row, sets: [{ id: "set-1", kind: "single", reps, weightKg: "10" }] }));
}

test("library and templates preserve history and resolve live definitions before retained snapshots", async () => {
  const f = await ready(); const { exerciseId, sessionId } = await planned(f);
  const workoutId = await f.store.saveWorkout({ name: "Leg day", exerciseIds: [exerciseId] }); assert.ok(workoutId);
  assert.equal(await f.store.saveExercise({ id: exerciseId, name: "Front squat", muscleGroup: "Legs", equipment: "Barbell", notes: "new", tracking: "single" }), exerciseId);
  const first = await f.store.planWorkout({ date: "2026-10-03", workoutId }); assert.ok(first);
  assert.equal(doc(f.store).sessions.find(session => session.id === first)!.exercises[0]!.exercise.name, "Front squat");
  assert.equal(doc(f.store).sessions.find(session => session.id === sessionId)!.exercises[0]!.exercise.name, "Squat");
  assert.equal(await f.store.removeExercise(exerciseId), true);
  const second = await f.store.planWorkout({ date: "2026-10-02", workoutId }); assert.ok(second);
  assert.equal(doc(f.store).sessions.find(session => session.id === second)!.exercises[0]!.exercise.name, "Squat");
  assert.equal(await f.store.saveWorkout({ id: workoutId, name: "Renamed", exerciseIds: [exerciseId] }), workoutId);
  assert.equal(await f.store.removeWorkout(workoutId), true); assert.equal(doc(f.store).sessions.length, 3);
});
test("ordered templates and sessions support repeated library exercise occurrences", async () => {
  const f = await ready(); const { exerciseId, sessionId } = await planned(f);
  const next = await f.store.saveExercise({ name: "Press", muscleGroup: "", equipment: "", notes: "", tracking: "sides" }); assert.ok(next);
  const workoutId = await f.store.saveWorkout({ name: "Upper", exerciseIds: [next, exerciseId] }); assert.ok(workoutId);
  const id = await f.store.planWorkout({ date: "2026-10-01", workoutId }); assert.ok(id);
  assert.deepEqual(doc(f.store).sessions.find(session => session.id === id)!.exercises.map(row => row.exercise.id), [next, exerciseId]);
  const originalRows = doc(f.store).sessions.find(session => session.id === sessionId)!.exercises;
  assert.equal(await f.store.updateSession({ id: sessionId, name: "Strength", exercises: [...originalRows, { ...originalRows[0]!, id: "repeated-occurrence" }] }), true);
  const rows = doc(f.store).sessions.find(session => session.id === sessionId)!.exercises;
  assert.equal(rows.length, 2); assert.notEqual(rows[0]!.id, rows[1]!.id);
});
test("rapid drafts serialize without losing the last input and detach caller-owned arrays", async () => {
  const f = await ready(); const { sessionId } = await planned(f); const gate = deferred<void>(); const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const first = f.store.updateSession({ id: sessionId, name: "First", exercises: entered(f, sessionId, "1") }); await flush();
  const rows = entered(f, sessionId, "1e"); const second = f.store.updateSession({ id: sessionId, name: "Second", exercises: rows });
  rows[0]!.sets = [];
  const third = f.store.updateSession({ id: sessionId, name: "Third", exercises: entered(f, sessionId, "-") });
  assert.equal(doc(f.store).sessions[0]!.name, "Strength"); gate.resolve();
  assert.deepEqual(await Promise.all([first, second, third]), [true, true, true]);
  assert.equal(doc(f.store).sessions[0]!.name, "Third");
  assert.equal((doc(f.store).sessions[0]!.exercises[0]!.sets[0] as { reps: string }).reps, "-");
  assert.equal(parseExerciseDocument(f.raw()).sessions[0]!.name, "Third");
});
test("active restart keeps start time, drafts and captured date across midnight", async () => {
  const f = await ready(); const { sessionId } = await planned(f);
  assert.equal(await f.store.startSession(sessionId), true);
  assert.equal(await f.store.updateSession({ id: sessionId, name: "Strength", exercises: entered(f, sessionId) }), true);
  const restored = await ready(f.raw()); restored.setNow(1120000);
  assert.equal(doc(restored.store).sessions[0]!.startedAt, 1000000);
  assert.equal(await restored.store.completeSession({ id: sessionId, name: "Strength", exercises: doc(restored.store).sessions[0]!.exercises }), true);
  assert.equal(doc(restored.store).sessions[0]!.durationSeconds, 120); assert.equal(doc(restored.store).sessions[0]!.date, "2026-10-04");
});
test("double starts and competing active workouts are rejected atomically", async () => {
  const f = await ready(); const { sessionId, workoutId } = await planned(f); const other = await f.store.planWorkout({ date: "2026-10-05", workoutId }); assert.ok(other);
  assert.deepEqual(await Promise.all([f.store.startSession(sessionId), f.store.startSession(sessionId), f.store.startSession(other)]), [true, false, false]);
  assert.equal(doc(f.store).sessions.filter(session => session.status === "active").length, 1);
});
test("failed active completion retains running timestamp and retry measures the full elapsed time", async () => {
  const f = await ready(); const { sessionId } = await planned(f); await f.store.startSession(sessionId);
  const rows = entered(f, sessionId); await f.store.updateSession({ id: sessionId, name: "Strength", exercises: rows });
  const raw = f.raw(), write = f.storage.setItem; f.storage.setItem = async () => { throw new Error("Disk full"); }; f.setNow(1060000);
  assert.equal(await f.store.completeSession({ id: sessionId, name: "Edited", exercises: rows }), false);
  assert.equal(f.raw(), raw); assert.equal(doc(f.store).sessions[0]!.status, "active"); assert.equal(doc(f.store).sessions[0]!.startedAt, 1000000);
  assert.ok(f.store.getSnapshot().error); f.storage.setItem = write; f.setNow(1120000);
  assert.equal(await f.store.completeSession({ id: sessionId, name: "Edited", exercises: rows }), true);
  assert.equal(doc(f.store).sessions[0]!.durationSeconds, 120); assert.equal(f.store.getSnapshot().error, null);
});
test("manual completion distinguishes unknown duration and supports validated completed edits", async () => {
  const f = await ready(); const { sessionId } = await planned(f);
  assert.equal(await f.store.completeSession({ id: sessionId, name: "Manual", exercises: entered(f, sessionId), durationMinutes: "" }), true);
  assert.equal(doc(f.store).sessions[0]!.durationSeconds, null);
  assert.equal(await f.store.updateSession({ id: sessionId, name: "Updated", exercises: entered(f, sessionId, "10"), durationSeconds: 150 }), true);
  assert.equal(doc(f.store).sessions[0]!.durationSeconds, 150);
  assert.equal(await f.store.updateSession({ id: sessionId, name: "Bad", exercises: entered(f, sessionId, "abc") }), false);
  assert.equal(doc(f.store).sessions[0]!.name, "Updated");
  assert.equal(await f.store.completeSession({ id: sessionId, name: "Updated", exercises: entered(f, sessionId), durationMinutes: "2.5" }), true);
  assert.equal(doc(f.store).sessions[0]!.durationSeconds, 150);
  assert.equal(await f.store.removeSession(sessionId), true); assert.deepEqual(doc(f.store).sessions, []);
});
test("invalid completion never changes the durable draft", async () => {
  const f = await ready(); const { sessionId } = await planned(f); const raw = f.raw();
  for (const input of [
    { name: "", exercises: entered(f, sessionId) }, { name: "Name", exercises: [] },
    { name: "Name", exercises: entered(f, sessionId, "0") }, { name: "Name", exercises: entered(f, sessionId), durationMinutes: "1e2" },
  ]) assert.equal(await f.store.completeSession({ id: sessionId, ...input }), false);
  assert.equal(f.raw(), raw);
});
test("queued stale draft cannot overwrite completion or recreate a deleted session", async () => {
  const f = await ready(); const { sessionId } = await planned(f); const gate = deferred<void>(); const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const completing = f.store.completeSession({ id: sessionId, name: "Finished", exercises: entered(f, sessionId) });
  const stale = f.store.updateSession({ id: sessionId, name: "Old draft", exercises: entered(f, sessionId, "-") }); gate.resolve();
  assert.equal(await completing, true); assert.equal(await stale, false); assert.equal(doc(f.store).sessions[0]!.name, "Finished");
  const deleting = f.store.removeSession(sessionId); const deletedUpdate = f.store.updateSession({ id: sessionId, name: "Revive", exercises: entered(f, sessionId) });
  assert.equal(await deleting, true); assert.equal(await deletedUpdate, false); assert.deepEqual(doc(f.store).sessions, []);
});
test("stop/start invalidates queued work while an in-flight write reloads its durable outcome", async () => {
  const f = await ready(); const { sessionId } = await planned(f); const gate = deferred<void>(); const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const first = f.store.updateSession({ id: sessionId, name: "Written", exercises: entered(f, sessionId) }); await flush();
  const queued = f.store.updateSession({ id: sessionId, name: "Canceled", exercises: entered(f, sessionId) });
  f.store.stop(); f.store.start(); assert.equal(f.store.getSnapshot().state.kind, "loading");
  gate.resolve(); assert.deepEqual(await Promise.all([first, queued]), [false, false]); await flush();
  assert.equal(doc(f.store).sessions[0]!.name, "Written");
  assert.equal(await f.store.updateSession({ id: sessionId, name: "Restarted", exercises: entered(f, sessionId) }), true);
});
test("corrupt and unavailable storage block edits until recovery without writing fake emptiness", async () => {
  for (const brokenRead of [false, true]) {
    const f = fixture("broken"); if (brokenRead) f.storage.getItem = async () => { throw new Error("Offline"); };
    f.store.start(); await flush(); assert.equal(f.store.getSnapshot().state.kind, "error");
    assert.equal(await f.store.planWorkout({ date: "2026-10-04", workoutId: "missing" }), null); assert.equal(f.writes(), 0);
    f.storage.getItem = async () => null; f.store.retryLoad(); await flush();
    const { sessionId } = await planned(f); assert.ok(sessionId);
  }
});
test("updates cannot alter captured identity, date, status or start time through extra properties", async () => {
  const f = await ready(); const { sessionId } = await planned(f); await f.store.startSession(sessionId);
  assert.equal(await f.store.updateSession({ id: sessionId, name: "Name", exercises: entered(f, sessionId), date: "2027-01-01", status: "completed", startedAt: 0 } as never), true);
  const saved = doc(f.store).sessions[0]!; assert.equal(saved.date, "2026-10-04"); assert.equal(saved.status, "active"); assert.equal(saved.startedAt, 1000000);
});
test("input capture works without a browser-only clone API and never converts invalid numbers to null", async () => {
  const original = globalThis.structuredClone;
  try {
    globalThis.structuredClone = undefined as never;
    const f = await ready(); const { sessionId } = await planned(f);
    assert.equal(await f.store.updateSession({ id: sessionId, name: "Native draft", exercises: entered(f, sessionId) }), true);
    assert.equal(await f.store.completeSession({ id: sessionId, name: "Native saved", exercises: entered(f, sessionId) }), true);
    const raw = f.raw();
    for (const durationSeconds of [NaN, Infinity, -1]) {
      assert.equal(await f.store.updateSession({ id: sessionId, name: "Invalid", exercises: entered(f, sessionId), durationSeconds }), false);
    }
    assert.equal(f.raw(), raw);
  } finally { globalThis.structuredClone = original; }
});
test("failed write across restart invalidates queued drafts and reloads the original document", async () => {
  const f = await ready(); const { sessionId } = await planned(f); const gate = deferred<void>(); const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const first = f.store.updateSession({ id: sessionId, name: "Failed", exercises: entered(f, sessionId) }); await flush();
  const queued = f.store.updateSession({ id: sessionId, name: "Canceled", exercises: entered(f, sessionId) });
  f.store.stop(); f.store.start(); gate.reject(new Error("Disk full"));
  assert.deepEqual(await Promise.all([first, queued]), [false, false]); await flush();
  assert.equal(doc(f.store).sessions[0]!.name, "Strength"); assert.equal(f.store.getSnapshot().error, null);
  f.storage.setItem = write;
  assert.equal(await f.store.updateSession({ id: sessionId, name: "Recovered", exercises: entered(f, sessionId) }), true);
});

const demoExercises = [
  { id: "development-example-squat", name: "Squat", tracking: "single", equipment: "barbell", muscleGroup: "legs", notes: "" },
  { id: "development-example-push-up", name: "Push-up", tracking: "single", equipment: "bodyweight", muscleGroup: "chest", notes: "" },
  { id: "development-example-dumbbell-curl", name: "Dumbbell curl", tracking: "sides", equipment: "dumbbells", muscleGroup: "arms", notes: "" },
];
test("development seeds three examples durably in new and existing empty stores", async () => {
  for (const initial of [null, JSON.stringify({ version: 1, exercises: [], workouts: [], sessions: [] })]) {
    const f = await ready(initial, true);
    assert.equal(await f.store.seedDevelopmentExamples(), true);
    assert.deepEqual(doc(f.store).exercises, demoExercises);
    assert.deepEqual(parseExerciseDocument(f.raw()), { version: 1, exercises: demoExercises, workouts: [], sessions: [], developmentExamplesSeeded: true });
  }
});
test("development seed preserves custom definitions, snapshots and occupied reserved IDs", async () => {
  const f = await ready(null, true); const { exerciseId, sessionId } = await planned(f);
  await f.store.completeSession({ id: sessionId, name: "Recorded", exercises: entered(f, sessionId) });
  const initial = { ...doc(f.store), exercises: [...doc(f.store).exercises,
    { ...demoExercises[0], name: "My reserved squat", notes: "Keep this" }],
  };
  const restored = await ready(JSON.stringify(initial), true);
  assert.equal(await restored.store.seedDevelopmentExamples(), true);
  assert.deepEqual(doc(restored.store).exercises, [...initial.exercises, demoExercises[1], demoExercises[2]]);
  assert.deepEqual(doc(restored.store).sessions, initial.sessions);
  assert.deepEqual(doc(restored.store).workouts, initial.workouts);
  assert.equal(doc(restored.store).exercises[0]!.id, exerciseId);
});
test("concurrent seed requests write once and deleted examples stay deleted across restart", async () => {
  const f = await ready(null, true);
  assert.deepEqual(await Promise.all([f.store.seedDevelopmentExamples(), f.store.seedDevelopmentExamples()]), [true, true]);
  assert.equal(f.writes(), 1);
  assert.equal(await f.store.removeExercise("development-example-push-up"), true);
  const restored = await ready(f.raw(), true);
  assert.equal(await restored.store.seedDevelopmentExamples(), true);
  assert.deepEqual(doc(restored.store).exercises, [demoExercises[0], demoExercises[2]]);
  assert.equal(restored.writes(), 0);
});
test("failed development seed publishes no examples or marker and can retry", async () => {
  const f = await ready(null, true); const { sessionId } = await planned(f);
  const before = doc(f.store), raw = f.raw(), write = f.storage.setItem;
  f.storage.setItem = async () => { throw new Error("Disk full"); };
  assert.equal(await f.store.seedDevelopmentExamples(), false);
  assert.deepEqual(doc(f.store), before); assert.equal(f.raw(), raw);
  assert.ok(f.store.getSnapshot().error);
  f.storage.setItem = write;
  assert.equal(await f.store.seedDevelopmentExamples(), true);
  assert.equal(doc(f.store).sessions[0]!.id, sessionId);
  assert.deepEqual(doc(f.store).exercises.slice(1), demoExercises);
  assert.equal(doc(f.store).developmentExamplesSeeded, true);
});
test("development seed waits for durable success before publication and respects restart", async () => {
  const f = await ready(null, true); const gate = deferred<void>(); const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const seeding = f.store.seedDevelopmentExamples(); await flush();
  assert.deepEqual(doc(f.store).exercises, []); assert.equal(doc(f.store).developmentExamplesSeeded, undefined);
  assert.equal(f.raw(), null);
  f.store.stop(); f.store.start(); gate.resolve();
  assert.equal(await seeding, false); await flush();
  assert.deepEqual(doc(f.store).exercises, demoExercises);
  assert.equal(doc(f.store).developmentExamplesSeeded, true);
  assert.equal(await f.store.seedDevelopmentExamples(), true); assert.equal(f.writes(), 1);
});
test("production never injects development examples even on an explicit seed request", async () => {
  const f = await ready();
  assert.equal(await f.store.seedDevelopmentExamples(), false);
  assert.deepEqual(doc(f.store), { version: 1, exercises: [], workouts: [], sessions: [] });
  assert.equal(f.raw(), null); assert.equal(f.writes(), 0);
});

test("only a saved workout can create a new log and deleting its template preserves the log", async () => {
  const f = await ready();
  const exerciseId = await f.store.saveExercise({ name: "Press", muscleGroup: "chest", equipment: "barbell", notes: "", tracking: "single" }); assert.ok(exerciseId);
  const before = f.raw();
  assert.equal(await f.store.planWorkout({ date: "2026-10-04", workoutId: "missing" }), null);
  assert.deepEqual(doc(f.store).sessions, []); assert.equal(f.raw(), before);
  const workoutId = await f.store.saveWorkout({ name: "Chest", exerciseIds: [exerciseId] }); assert.ok(workoutId);
  const sessionId = await f.store.planWorkout({ date: "2026-10-04", workoutId }); assert.ok(sessionId);
  assert.equal(await f.store.removeWorkout(workoutId), true);
  assert.equal(await f.store.startSession(sessionId), true);
  assert.equal(doc(f.store).sessions[0]!.exercises[0]!.exercise.name, "Press");
});
test("legacy ad hoc logs remain editable and retain their date after loading", async () => {
  const initial = { version: 1, exercises: [], workouts: [], sessions: [{ id: "old-ad-hoc", name: "Legacy", date: "2026-10-03", status: "planned", startedAt: null, durationSeconds: null, exercises: [] }] };
  const f = await ready(JSON.stringify(initial));
  assert.equal(await f.store.updateSession({ id: "old-ad-hoc", name: "Edited", exercises: [] }), true);
  assert.equal(await f.store.startSession("old-ad-hoc"), true);
  assert.equal(doc(f.store).sessions[0]!.date, "2026-10-03");
});

test("planning preserves the trimmed name of a legacy saved workout", async () => {
  const f = await ready(); const { workoutId } = await planned(f);
  const initial = { ...doc(f.store), sessions: [], workouts: doc(f.store).workouts.map(workout => ({ ...workout, name: "  Legacy strength  " })) };
  const restored = await ready(JSON.stringify(initial));
  const sessionId = await restored.store.planWorkout({ date: "2026-10-03", workoutId }); assert.ok(sessionId);
  assert.equal(doc(restored.store).sessions[0]!.name, "Legacy strength");
});
test("failed development seed across restart preserves custom workouts and retries", async () => {
  const f = await ready(null, true); await planned(f);
  const before = doc(f.store), raw = f.raw(), gate = deferred<void>();
  f.storage.setItem = async () => { await gate.promise; };
  const seeding = f.store.seedDevelopmentExamples(); await flush();
  const queued = f.store.seedDevelopmentExamples();
  f.store.stop(); f.store.start(); gate.reject(new Error("Disk full"));
  assert.deepEqual(await Promise.all([seeding, queued]), [false, false]); await flush();
  assert.deepEqual(doc(f.store), before); assert.equal(f.raw(), raw);
  const restored = await ready(f.raw(), true);
  assert.equal(await restored.store.seedDevelopmentExamples(), true);
  assert.deepEqual(doc(restored.store).workouts, before.workouts);
  assert.deepEqual(doc(restored.store).sessions, before.sessions);
  assert.deepEqual(doc(restored.store).exercises, [...before.exercises, ...demoExercises]);
});
test("development seeding cannot overwrite corrupt or unreadable storage during recovery", async () => {
  for (const unreadable of [false, true]) {
    const f = fixture("broken", true);
    if (unreadable) f.storage.getItem = async () => { throw new Error("Offline"); };
    assert.equal(await f.store.seedDevelopmentExamples(), false);
    f.store.start(); await flush();
    assert.equal(f.store.getSnapshot().state.kind, "error");
    assert.equal(await f.store.seedDevelopmentExamples(), false);
    assert.equal(f.raw(), "broken"); assert.equal(f.writes(), 0);
    f.storage.getItem = async () => null; f.store.retryLoad(); await flush();
    assert.equal(await f.store.seedDevelopmentExamples(), true);
    assert.deepEqual(doc(f.store).exercises, demoExercises);
  }
});

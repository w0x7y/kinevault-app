import assert from "node:assert/strict";
import test from "node:test";
import { createWorkoutEditing } from "../src/exercise/workout-editing.ts";
import { createExercisePersistence, exerciseStorageKey } from "../src/exercise/persistence.ts";
import { parseExerciseDocument, type ExerciseDocument, type WorkoutSession } from "../src/exercise/model.ts";
import { summarizeSessions } from "../src/exercise/summary.ts";

const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function gate() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }
const exercise = { id: "squat", name: "Squat", muscleGroup: "", equipment: "", notes: "", tracking: "single" as const };
function session(status: WorkoutSession["status"]): WorkoutSession {
  return { id: "log", name: "Strength", date: "2026-10-04", status, startedAt: status === "active" ? 1000000 : null,
    durationSeconds: status === "completed" ? 120 : null,
    exercises: [{ id: "row", exercise, sets: [{ id: "set", kind: "single", reps: "8", weightKg: "10" },
      ...(status === "completed" ? [] : [{ id: "blank", kind: "single" as const, reps: "", weightKg: "" }])] }] };
}
async function fixture(status: WorkoutSession["status"] = "completed") {
  const document: ExerciseDocument = { version: 1, exercises: [exercise], workouts: [], sessions: [session(status)] };
  let raw = JSON.stringify(document);
  const storage = { async getItem(key: string) { assert.equal(key, exerciseStorageKey); return raw; },
    async setItem(key: string, value: string) { assert.equal(key, exerciseStorageKey); raw = value; } };
  const write = storage.setItem;
  const store = createExercisePersistence({ storage, createId: () => "unused", now: () => 1120000 });
  store.start(); await tick();
  const editing = createWorkoutEditing(store);
  assert.ok(editing, "workout editing must own retained fields and panel lifetime");
  const sync = () => { const state = store.getSnapshot().state; if (state.kind === "ready") editing.refreshDocument(); };
  sync(); store.subscribe(sync);
  const saved = () => parseExerciseDocument(raw).sessions[0]!;
  return { editing, store, storage, write, saved, raw: () => raw };
}

test("completed edits remain local across panels; Cancel releases all retained fields", async () => {
  const f = await fixture(); await f.editing.requestView({ kind: "session", id: "log" });
  const edit = f.editing.edit("log");
  edit.change({ kind: "name", value: "Unfinished" }); edit.change({ kind: "minutes", value: "bad" });
  edit.change({ kind: "set", rowId: "row", setId: "set", build: set => ({ ...set, reps: "-" }) });
  await f.editing.requestView({ kind: "library", date: "2026-10-05" });
  await f.editing.requestView({ kind: "session", id: "log" });
  const resumed = f.editing.edit("log");
  assert.equal(resumed.getSnapshot().fields.name, "Unfinished"); assert.equal(resumed.getSnapshot().fields.minutes, "bad");
  assert.equal(f.saved().name, "Strength"); assert.equal(f.saved().exercises[0]!.sets[0]!.kind, "single");
  assert.equal(await resumed.run("cancel"), true); assert.equal(f.editing.getSnapshot().panel, null);
  assert.equal(f.editing.edit("log").getSnapshot().fields.name, "Strength");
  assert.equal(f.editing.edit("log").getSnapshot().fields.minutes, "2");
});

test("failed active fields survive editor replacement and query/day changes until retry allows departure", async () => {
  const f = await fixture("active"); const edit = f.editing.edit("log");
  f.storage.setItem = async () => { throw new Error("Disk full"); };
  edit.change({ kind: "set", rowId: "row", setId: "set", build: set => ({ ...set, reps: "1e" }) }); await tick();
  assert.ok(edit.getSnapshot().error);
  assert.equal(await f.editing.requestView({ kind: "library", date: "2026-10-05" }), false);
  f.editing.refreshDocument();
  const remounted = f.editing.edit("log"); const set = remounted.getSnapshot().fields.exercises[0]!.sets[0]!;
  assert.equal(set.kind === "single" && set.reps, "1e");
  f.storage.setItem = f.write;
  assert.equal(await remounted.run("retry"), true);
  assert.equal(await f.editing.requestView({ kind: "library", date: "2026-10-05" }), true);
  assert.equal(f.saved().status, "active"); assert.equal(f.saved().date, "2026-10-04"); assert.equal(f.saved().startedAt, 1000000);
});

test("invalid manual duration retains text, saves sets, and blocks departure until corrected", async () => {
  const f = await fixture("planned"); await f.editing.requestView({ kind: "session", id: "log", manual: true });
  const edit = f.editing.edit("log"); edit.change({ kind: "minutes", value: "1e" });
  edit.change({ kind: "set", rowId: "row", setId: "set", build: set => ({ ...set, reps: "12" }) }); await tick();
  assert.equal(edit.getSnapshot().fields.minutes, "1e"); assert.equal(f.saved().durationSeconds, null);
  const set = f.saved().exercises[0]!.sets[0]!; assert.equal(set.kind === "single" && set.reps, "12");
  assert.equal(await f.editing.requestView({ kind: "exercise" }), false);
  assert.equal(await edit.run("complete"), false); assert.equal(f.saved().status, "planned");
  edit.change({ kind: "minutes", value: "2.5" });
  assert.equal(await f.editing.requestView({ kind: "exercise" }), true); assert.equal(f.saved().durationSeconds, 150);
});

test("planned counts retain invalid text, reject shrink over entered sets, and resize blank rows", async () => {
  const f = await fixture("planned"); await f.editing.requestView({ kind: "session", id: "log", settings: true });
  const edit = f.editing.edit("log");
  for (const value of ["-", "101", "1.5", "0"]) {
    edit.change({ kind: "count", rowId: "row", value });
    assert.equal(edit.getSnapshot().counts.row, value); assert.equal(edit.getSnapshot().fields.exercises[0]!.sets.length, 2);
    assert.equal(await edit.run("start"), false); assert.equal(await f.editing.requestView({ kind: "library", date: "2026-10-04" }), false);
  }
  assert.equal(await edit.run("settings"), false);
  edit.change({ kind: "count", rowId: "row", value: "3" }); await tick();
  const rows = edit.getSnapshot().fields.exercises; assert.equal(rows[0]!.sets.length, 3);
  assert.equal(new Set(rows[0]!.sets.map(set => set.id)).size, 3);
  const added = rows[0]!.sets[2]!; assert.deepEqual({ ...added, id: "added" }, { id: "added", kind: "single", reps: "", weightKg: "" });
  edit.change({ kind: "count", rowId: "row", value: "1" });
  assert.equal(await edit.run("start"), true); assert.equal(f.saved().status, "active"); assert.equal(f.saved().exercises[0]!.sets.length, 1);
});

test("a cleared manual workout name stays editable until corrected before Start", async () => {
  const f = await fixture("planned");
  await f.editing.requestView({ kind: "session", id: "log", manual: true });
  const edit = f.editing.edit("log");
  for (const value of ["", "   "]) {
    edit.change({ kind: "name", value });
    assert.equal(await edit.run("start"), false);
    assert.equal(f.saved().status, "planned");
    assert.equal(edit.getSnapshot().fields.name, value);
    assert.match(edit.getSnapshot().error!, /name/i);
  }
  edit.change({ kind: "name", value: "Corrected workout" });
  assert.equal(await edit.run("start"), true);
  assert.equal(f.saved().status, "active");
  assert.equal(await edit.run("complete"), true);
  assert.equal(f.saved().status, "completed");
  assert.equal(f.saved().name, "Corrected workout");
});

test("competing view requests wait for the same save and only the latest request replaces the panel", async () => {
  const f = await fixture("active"); const edit = f.editing.edit("log"); const pending = gate();
  f.storage.setItem = async (key, value) => { await pending.promise; await f.write(key, value); };
  edit.change({ kind: "name", value: "First" }); edit.change({ kind: "name", value: "Latest" });
  const first = f.editing.requestView({ kind: "exercise" }); const second = f.editing.requestView({ kind: "library", date: "2026-10-05" });
  await tick(); assert.equal(f.editing.getSnapshot().panel, null); assert.equal(edit.getSnapshot().busy, true);
  pending.resolve(); assert.deepEqual(await Promise.all([first, second]), [false, true]);
  assert.deepEqual(f.editing.getSnapshot().panel?.content, { kind: "library", date: "2026-10-05" });
  assert.equal(f.saved().name, "Latest"); assert.equal(edit.getSnapshot().error, null);
});

test("completed Save fails without retiring fields and succeeds before releasing the edit", async () => {
  const f = await fixture(); await f.editing.requestView({ kind: "session", id: "log" }); const edit = f.editing.edit("log");
  edit.change({ kind: "name", value: "Saved edit" }); edit.change({ kind: "add-set", rowId: "row" });
  f.storage.setItem = async () => { throw new Error("Disk full"); };
  assert.equal(await edit.run("save"), false); assert.equal(edit.getSnapshot().fields.name, "Saved edit"); assert.ok(edit.getSnapshot().error);
  const pending = gate(); f.storage.setItem = async (key, value) => { await pending.promise; await f.write(key, value); };
  const saving = edit.run("save"); await tick(); assert.equal(f.editing.edit("log").getSnapshot().fields.exercises[0]!.sets.length, 2);
  assert.equal(f.saved().name, "Strength"); pending.resolve(); assert.equal(await saving, true);
  assert.equal(f.editing.getSnapshot().panel, null); assert.equal(f.editing.edit("log").getSnapshot().fields.exercises[0]!.sets.length, 1);
  edit.change({ kind: "name", value: "Stale" }); assert.equal(f.editing.edit("log").getSnapshot().fields.name, "Saved edit");
  assert.equal(summarizeSessions([f.saved()]).sets, 1);
});

test("completion and discard retire only after durable success", async () => {
  for (const action of ["complete", "discard"] as const) {
    const f = await fixture("active"); const edit = f.editing.edit("log"); f.storage.setItem = async () => { throw new Error("Disk full"); };
    assert.equal(await edit.run(action), false); assert.equal(f.saved().status, "active"); assert.ok(edit.getSnapshot().error);
    f.storage.setItem = f.write; assert.equal(await edit.run(action), true);
    const saved = parseExerciseDocument(f.raw()).sessions;
    assert.equal(saved.length, action === "discard" ? 0 : 1);
    if (action === "complete") { assert.equal(saved[0]!.durationSeconds, 120); assert.equal(saved[0]!.exercises[0]!.sets.length, 1); }
  }
});

test("stale panel callbacks and completed save feedback cannot replace a newer view", async () => {
  const f = await fixture(); await f.editing.requestView({ kind: "library", date: "2026-10-04" });
  const oldToken = f.editing.getSnapshot().panel!.token;
  await f.editing.requestView({ kind: "session", id: "log" }); const edit = f.editing.edit("log"); edit.change({ kind: "name", value: "Captured" });
  const pending = gate(); f.storage.setItem = async (key, value) => { await pending.promise; await f.write(key, value); };
  const saving = edit.run("save"); await tick();
  await f.editing.requestView({ kind: "exercise" }); const current = f.editing.getSnapshot().panel;
  f.editing.closeView(oldToken); f.editing.createdSession(oldToken, "log"); assert.equal(f.editing.getSnapshot().panel, current);
  pending.resolve(); assert.equal(await saving, true); assert.equal(f.editing.getSnapshot().panel, current);
  assert.equal(f.saved().name, "Captured");
});

test("suspend/resume rejects pending old navigation and permits fresh edits and departures", async () => {
  const f = await fixture("active"); const edit = f.editing.edit("log"), pending = gate();
  f.storage.setItem = async (key, value) => { await pending.promise; await f.write(key, value); };
  edit.change({ kind: "name", value: "Retained through replay" });
  const leaving = f.editing.requestView({ kind: "exercise" }); await tick();
  f.editing.suspend(); f.editing.resume(); pending.resolve();
  assert.equal(await leaving, false); assert.equal(f.editing.getSnapshot().panel, null);
  assert.equal(edit.getSnapshot().busy, false); assert.equal(edit.getSnapshot().error, null);
  assert.equal(f.editing.edit("log").getSnapshot().fields.name, "Retained through replay");
  assert.equal(await f.editing.requestView({ kind: "library", date: "2026-10-05" }), true);
});

test("a handle rendered before effect replay can still Save and close its current panel", async () => {
  const f = await fixture(); await f.editing.requestView({ kind: "session", id: "log" });
  const edit = f.editing.edit("log"); f.editing.suspend(); f.editing.resume();
  edit.change({ kind: "name", value: "After replay" });
  assert.equal(await edit.run("save"), true); assert.equal(f.editing.getSnapshot().panel, null);
});

test("successful discard closes its original panel despite the document removing the workout", async () => {
  const f = await fixture("planned"); await f.editing.requestView({ kind: "session", id: "log" });
  assert.equal(await f.editing.edit("log").run("discard"), true);
  assert.equal(f.editing.getSnapshot().panel, null);
});

test("reentrant observable feedback cannot start a second destructive action", async () => {
  const f = await fixture("active"); const edit = f.editing.edit("log"), pending = gate();
  f.storage.setItem = async (key, value) => { await pending.promise; await f.write(key, value); };
  let reentered: Promise<boolean> | undefined;
  const unsubscribe = edit.subscribe(() => {
    if (edit.getSnapshot().busy && !reentered) { unsubscribe(); reentered = edit.run("discard"); }
  });
  const completing = edit.run("complete"); await tick(); pending.resolve();
  assert.equal(await completing, true); assert.equal(await reentered, false);
  assert.equal(parseExerciseDocument(f.raw()).sessions[0]!.status, "completed");
});


test("manual metadata Settings do not validate retained compact planned counts", async () => {
  const f = await fixture("planned"); await f.editing.requestView({ kind: "session", id: "log", manual: true });
  const edit = f.editing.edit("log"); edit.change({ kind: "count", rowId: "row", value: "-" });
  edit.change({ kind: "name", value: "Manual metadata" });
  assert.equal(await edit.run("settings"), true); assert.equal(f.saved().name, "Manual metadata");
  assert.equal(edit.getSnapshot().counts.row, "-");
  assert.equal(await f.editing.requestView({ kind: "exercise" }), true);
});

test("manual logging from an empty legacy row saves new sets and permits cancellation/departure", async () => {
  for (const action of ["complete", "cancel", "navigate"] as const) {
    const f = await fixture("planned");
    await f.store.updateSession({ id: "log", name: "Strength", exercises: [{ ...f.saved().exercises[0]!, sets: [] }] });
    await f.editing.requestView({ kind: "session", id: "log", manual: true }); const edit = f.editing.edit("log");
    edit.change({ kind: "add-set", rowId: "row" }); const setId = edit.getSnapshot().fields.exercises[0]!.sets[0]!.id;
    edit.change({ kind: "set", rowId: "row", setId, build: set => ({ ...set, reps: "10" }) });
    const success = action === "navigate" ? await f.editing.requestView({ kind: "library", date: "2026-10-05" }) : await edit.run(action);
    assert.equal(success, true); assert.equal(f.saved().exercises[0]!.sets.length, 1);
    assert.equal(f.saved().status, action === "complete" ? "completed" : "planned");
    assert.equal(edit.getSnapshot().counts.row, "1");
  }
});

test("a newer departure waiting on completion wins over the original panel's success close", async () => {
  const f = await fixture("active"); await f.editing.requestView({ kind: "session", id: "log" });
  const edit = f.editing.edit("log"), pending = gate();
  f.storage.setItem = async (key, value) => { await pending.promise; await f.write(key, value); };
  const completing = edit.run("complete"); await tick();
  const leaving = f.editing.requestView({ kind: "library", date: "2026-10-05" });
  pending.resolve(); assert.equal(await completing, true); assert.equal(await leaving, true);
  assert.deepEqual(f.editing.getSnapshot().panel?.content, { kind: "library", date: "2026-10-05" });
});

test("retirement follows the durable document when the React snapshot publication arrives after save", async () => {
  const f = await fixture(); let visible = f.store.getSnapshot();
  const editing = createWorkoutEditing({ ...f.store, getSnapshot: () => visible }); editing.refreshDocument();
  await editing.requestView({ kind: "session", id: "log" }); const edit = editing.edit("log");
  edit.change({ kind: "name", value: "Durable saved name" }); assert.equal(await edit.run("save"), true);
  editing.edit("log"); // A render may read the previous provider snapshot before publication.
  visible = f.store.getSnapshot(); editing.refreshDocument();
  assert.equal(editing.edit("log").getSnapshot().fields.name, "Durable saved name");
});

test("completed edits stay separate and deletion releases only the removed workout's local fields", async () => {
  const f = await fixture();
  // Seed a second real log using the existing persistence commands.
  const workoutId = await f.store.saveWorkout({ name: "Evening", exerciseIds: ["squat"] }); assert.ok(workoutId);
  const otherId = await f.store.planWorkout({ date: "2026-10-04", workoutId }); assert.ok(otherId);
  await f.store.completeSession({ id: otherId, name: "Evening", exercises: f.saved().exercises });
  await f.editing.requestView({ kind: "session", id: "log" }); const first = f.editing.edit("log");
  first.change({ kind: "name", value: "Morning unfinished" }); first.change({ kind: "minutes", value: "7" });
  await f.editing.requestView({ kind: "session", id: otherId }); const second = f.editing.edit(otherId);
  second.change({ kind: "name", value: "Evening unfinished" }); second.change({ kind: "minutes", value: "9" });
  assert.equal(f.editing.edit("log").getSnapshot().fields.minutes, "7");
  assert.equal(await f.store.removeSession("log"), true);
  assert.throws(() => f.editing.edit("log"), /no longer available/);
  first.change({ kind: "name", value: "Stale removed fields" });
  assert.equal(f.editing.edit(otherId).getSnapshot().fields.name, "Evening unfinished");
  assert.equal(f.editing.edit(otherId).getSnapshot().fields.minutes, "9");
});

test("untouched compact planned cards do not require a draft write merely to open another panel", async () => {
  const f = await fixture("planned"); f.editing.edit("log");
  f.storage.setItem = async () => { throw new Error("Disk full"); };
  assert.equal(await f.editing.requestView({ kind: "library", date: "2026-10-04" }), true);
  assert.equal(f.saved().name, "Strength");
});

test("editing a valid count keeps another row's count problem visible while saving its own resize", async () => {
  const f = await fixture("planned"), row = f.saved().exercises[0]!;
  await f.store.updateSession({ id: "log", name: "Strength", exercises: [row, { ...row, id: "other-row", sets: [] }] });
  await f.editing.requestView({ kind: "session", id: "log", settings: true }); const edit = f.editing.edit("log");
  edit.change({ kind: "count", rowId: "row", value: "-" });
  edit.change({ kind: "count", rowId: "other-row", value: "3" }); await tick();
  assert.ok(edit.getSnapshot().countError); assert.equal(edit.getSnapshot().counts.row, "-");
  assert.equal(f.saved().exercises[1]!.sets.length, 3); assert.equal(await edit.run("start"), false);
});

test("reentrant field observers preserve Latest as the final durable autosave", async () => {
  const f = await fixture("active"), edit = f.editing.edit("log");
  const unsubscribe = edit.subscribe(() => {
    if (edit.getSnapshot().fields.name === "First") { unsubscribe(); edit.change({ kind: "name", value: "Latest" }); }
  });
  edit.change({ kind: "name", value: "First" }); await tick();
  assert.equal(edit.getSnapshot().fields.name, "Latest");
  assert.equal(f.saved().name, "Latest"); assert.equal(edit.getSnapshot().error, null);
});

test("planned count validation observers cannot replace Complete with a competing Discard", async () => {
  const f = await fixture("planned"), edit = f.editing.edit("log");
  let discarding: Promise<boolean> | undefined;
  const unsubscribe = edit.subscribe(() => { unsubscribe(); discarding = edit.run("discard"); });
  const completing = edit.run("complete");
  assert.equal(await completing, true); assert.equal(await discarding, false);
  assert.equal(parseExerciseDocument(f.raw()).sessions[0]!.status, "completed");
});

test("planned departure validation observers cannot replace the owned save with a competing Discard", async () => {
  const f = await fixture("planned"); await f.editing.requestView({ kind: "session", id: "log", settings: true });
  const edit = f.editing.edit("log");
  let discarding: Promise<boolean> | undefined;
  const unsubscribe = edit.subscribe(() => { unsubscribe(); discarding = edit.run("discard"); });
  const leaving = f.editing.requestView({ kind: "library", date: "2026-10-05" });
  assert.equal(await leaving, true); assert.equal(await discarding, false);
  assert.equal(parseExerciseDocument(f.raw()).sessions[0]!.status, "planned");
  assert.deepEqual(f.editing.getSnapshot().panel?.content, { kind: "library", date: "2026-10-05" });
});

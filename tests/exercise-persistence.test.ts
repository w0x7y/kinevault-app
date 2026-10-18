import assert from "node:assert/strict";
import test from "node:test";
import {
  createExercisePersistence,
  exerciseStorageKey,
  type ExerciseWrite,
} from "../src/exercise/persistence.ts";
import {
  parseExerciseDocument,
  type ExerciseSet,
  type SessionExercise,
} from "../src/exercise/model.ts";
import { summarizeSessions } from "../src/exercise/summary.ts";
import type { DurableStorage } from "../src/persistence/durable-write.ts";

const flush = async () => {
  for (let n = 0; n < 12; n++) await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
/** The value a write saved; fails the test when it didn't save. */
async function value<Value>(write: Promise<ExerciseWrite<Value>>): Promise<Value> {
  const result = await write;
  if (result.kind !== "saved") assert.fail(`Expected a saved write: ${JSON.stringify(result)}`);
  return result.value;
}
const ok = <Value>(value: Value) => ({ kind: "saved", value }) as const;
const rejected = (reason: string) => ({ kind: "rejected", reason }) as const;
const unavailable = { kind: "unavailable" } as const;
function fixture(initial: string | null = null, development = false) {
  let raw = initial,
    clock = 1000000,
    ids = 0,
    writes = 0;
  const storage: DurableStorage = {
    async getItem(key) {
      assert.equal(key, exerciseStorageKey);
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, exerciseStorageKey);
      ++writes;
      raw = value;
    },
  };
  const store = createExercisePersistence({
    storage,
    development,
    createId: () => `id-${++ids}`,
    now: () => clock,
  });
  return {
    store,
    storage,
    raw: () => raw,
    writes: () => writes,
    setRaw: (value: string) => {
      raw = value;
    },
    setNow: (value: number) => {
      clock = value;
    },
  };
}
async function ready(initial: string | null = null, development = false) {
  const f = fixture(initial, development);
  f.store.start();
  await flush();
  assert.equal(f.store.getSnapshot().state.kind, "ready");
  return f;
}
function doc(store: ReturnType<typeof fixture>["store"]) {
  const state = store.getSnapshot().state;
  if (state.kind !== "ready") throw new Error("Not ready");
  return state.document;
}
async function planned(f: ReturnType<typeof fixture>, name = "Strength") {
  const exerciseId = await value(
    f.store.saveExercise({
      name: "Squat",
      muscleGroup: "Legs",
      equipment: "Barbell",
      notes: "",
      tracking: "single",
    }),
  );
  assert.ok(exerciseId);
  const workoutId = await value(f.store.saveWorkout({ name, exerciseIds: [exerciseId] }));
  assert.ok(workoutId);
  const sessionId = await value(f.store.planWorkout({ date: "2026-10-04", workoutId }));
  assert.ok(sessionId);
  return { sessionId, exerciseId, workoutId };
}
function entered(f: ReturnType<typeof fixture>, sessionId: string, reps = "8"): SessionExercise[] {
  return doc(f.store)
    .sessions.find((session) => session.id === sessionId)!
    .exercises.map((row) => ({
      ...row,
      sets: [{ id: "set-1", kind: "single", reps, weightKg: "10" }],
    }));
}

test("library and templates preserve history and resolve live definitions before retained snapshots", async () => {
  const f = await ready();
  const { exerciseId, sessionId } = await planned(f);
  const workoutId = await value(
    f.store.saveWorkout({ name: "Leg day", exerciseIds: [exerciseId] }),
  );
  assert.ok(workoutId);
  assert.deepEqual(
    await f.store.saveExercise({
      id: exerciseId,
      name: "Front squat",
      muscleGroup: "Legs",
      equipment: "Barbell",
      notes: "new",
      tracking: "single",
    }),
    ok(exerciseId),
  );
  const first = await value(f.store.planWorkout({ date: "2026-10-03", workoutId }));
  assert.ok(first);
  assert.equal(
    doc(f.store).sessions.find((session) => session.id === first)!.exercises[0]!.exercise.name,
    "Front squat",
  );
  assert.equal(
    doc(f.store).sessions.find((session) => session.id === sessionId)!.exercises[0]!.exercise.name,
    "Squat",
  );
  assert.deepEqual(await f.store.removeExercise(exerciseId), ok(true));
  const second = await value(f.store.planWorkout({ date: "2026-10-02", workoutId }));
  assert.ok(second);
  assert.equal(
    doc(f.store).sessions.find((session) => session.id === second)!.exercises[0]!.exercise.name,
    "Squat",
  );
  assert.deepEqual(
    await f.store.saveWorkout({ id: workoutId, name: "Renamed", exerciseIds: [exerciseId] }),
    ok(workoutId),
  );
  assert.deepEqual(await f.store.removeWorkout(workoutId), ok(true));
  assert.equal(doc(f.store).sessions.length, 3);
});
test("ordered templates and sessions support repeated library exercise occurrences", async () => {
  const f = await ready();
  const { exerciseId, sessionId } = await planned(f);
  const next = await value(
    f.store.saveExercise({
      name: "Press",
      muscleGroup: "",
      equipment: "",
      notes: "",
      tracking: "sides",
    }),
  );
  assert.ok(next);
  const workoutId = await value(
    f.store.saveWorkout({ name: "Upper", exerciseIds: [next, exerciseId] }),
  );
  assert.ok(workoutId);
  const id = await value(f.store.planWorkout({ date: "2026-10-01", workoutId }));
  assert.ok(id);
  assert.deepEqual(
    doc(f.store)
      .sessions.find((session) => session.id === id)!
      .exercises.map((row) => row.exercise.id),
    [next, exerciseId],
  );
  const originalRows = doc(f.store).sessions.find((session) => session.id === sessionId)!.exercises;
  assert.deepEqual(
    await f.store.updateSession({
      id: sessionId,
      name: "Strength",
      exercises: [...originalRows, { ...originalRows[0]!, id: "repeated-occurrence" }],
    }),
    ok(true),
  );
  const rows = doc(f.store).sessions.find((session) => session.id === sessionId)!.exercises;
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0]!.id, rows[1]!.id);
});
test("rapid drafts serialize without losing the last input and detach caller-owned arrays", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  const gate = deferred<void>();
  const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => {
    await gate.promise;
    await write(key, value);
  };
  const first = f.store.updateSession({
    id: sessionId,
    name: "First",
    exercises: entered(f, sessionId, "1"),
  });
  await flush();
  const rows = entered(f, sessionId, "1e");
  const second = f.store.updateSession({ id: sessionId, name: "Second", exercises: rows });
  rows[0]!.sets = [];
  const third = f.store.updateSession({
    id: sessionId,
    name: "Third",
    exercises: entered(f, sessionId, "-"),
  });
  assert.equal(doc(f.store).sessions[0]!.name, "Strength");
  gate.resolve();
  assert.deepEqual(await Promise.all([first, second, third]), [ok(true), ok(true), ok(true)]);
  assert.equal(doc(f.store).sessions[0]!.name, "Third");
  assert.equal((doc(f.store).sessions[0]!.exercises[0]!.sets[0] as { reps: string }).reps, "-");
  assert.equal(parseExerciseDocument(f.raw()).sessions[0]!.name, "Third");
});
test("active restart keeps start time, drafts and captured date across midnight", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  assert.deepEqual(await f.store.startSession(sessionId), ok(true));
  assert.deepEqual(
    await f.store.updateSession({
      id: sessionId,
      name: "Strength",
      exercises: entered(f, sessionId),
    }),
    ok(true),
  );
  const restored = await ready(f.raw());
  restored.setNow(1120000);
  assert.equal(doc(restored.store).sessions[0]!.startedAt, 1000000);
  assert.deepEqual(
    await restored.store.completeSession({
      id: sessionId,
      name: "Strength",
      exercises: doc(restored.store).sessions[0]!.exercises,
    }),
    ok(true),
  );
  assert.equal(doc(restored.store).sessions[0]!.durationSeconds, 120);
  assert.equal(doc(restored.store).sessions[0]!.date, "2026-10-04");
});
test("double starts and competing active workouts are rejected atomically", async () => {
  const f = await ready();
  const { sessionId, workoutId } = await planned(f);
  const other = await value(f.store.planWorkout({ date: "2026-10-05", workoutId }));
  assert.ok(other);
  assert.deepEqual(
    await Promise.all([
      f.store.startSession(sessionId),
      f.store.startSession(sessionId),
      f.store.startSession(other),
    ]),
    [
      ok(true),
      rejected("A workout is already active or this workout has finished."),
      rejected("A workout is already active or this workout has finished."),
    ],
  );
  assert.equal(doc(f.store).sessions.filter((session) => session.status === "active").length, 1);
});
test("Start rejects unnamed drafts without starting their timer and accepts a corrected name", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  for (const name of ["", "   "]) {
    assert.deepEqual(
      await f.store.updateSession({ id: sessionId, name, exercises: entered(f, sessionId) }),
      ok(true),
    );
    const raw = f.raw(),
      writes = f.writes();
    assert.deepEqual(await f.store.startSession(sessionId), rejected("Enter a workout name."));
    assert.equal(f.raw(), raw);
    assert.equal(f.writes(), writes);
    assert.equal(doc(f.store).sessions[0]!.status, "planned");
    assert.equal(doc(f.store).sessions[0]!.startedAt, null);
    assert.match(f.store.getSnapshot().error!, /name/i);
  }
  assert.deepEqual(
    await f.store.updateSession({
      id: sessionId,
      name: "Corrected",
      exercises: entered(f, sessionId),
    }),
    ok(true),
  );
  assert.deepEqual(await f.store.startSession(sessionId), ok(true));
  assert.deepEqual(
    await f.store.completeSession({
      id: sessionId,
      name: "Corrected",
      exercises: doc(f.store).sessions[0]!.exercises,
    }),
    ok(true),
  );
  assert.equal(doc(f.store).sessions[0]!.status, "completed");
});
test("failed active completion retains running timestamp and retry measures the full elapsed time", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  await f.store.startSession(sessionId);
  const rows = entered(f, sessionId);
  await f.store.updateSession({ id: sessionId, name: "Strength", exercises: rows });
  const raw = f.raw(),
    write = f.storage.setItem;
  f.storage.setItem = async () => {
    throw new Error("Disk full");
  };
  f.setNow(1060000);
  assert.deepEqual(
    await f.store.completeSession({ id: sessionId, name: "Edited", exercises: rows }),
    unavailable,
  );
  assert.equal(f.raw(), raw);
  assert.equal(doc(f.store).sessions[0]!.status, "active");
  assert.equal(doc(f.store).sessions[0]!.startedAt, 1000000);
  assert.ok(f.store.getSnapshot().error);
  f.storage.setItem = write;
  f.setNow(1120000);
  assert.deepEqual(
    await f.store.completeSession({ id: sessionId, name: "Edited", exercises: rows }),
    ok(true),
  );
  assert.equal(doc(f.store).sessions[0]!.durationSeconds, 120);
  assert.equal(f.store.getSnapshot().error, null);
});
test("manual completion distinguishes unknown duration and supports validated completed edits", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  assert.deepEqual(
    await f.store.completeSession({
      id: sessionId,
      name: "Manual",
      exercises: entered(f, sessionId),
      durationMinutes: "",
    }),
    ok(true),
  );
  assert.equal(doc(f.store).sessions[0]!.durationSeconds, null);
  assert.deepEqual(
    await f.store.updateSession({
      id: sessionId,
      name: "Updated",
      exercises: entered(f, sessionId, "10"),
      durationSeconds: 150,
    }),
    ok(true),
  );
  assert.equal(doc(f.store).sessions[0]!.durationSeconds, 150);
  assert.deepEqual(
    await f.store.updateSession({
      id: sessionId,
      name: "Bad",
      exercises: entered(f, sessionId, "abc"),
    }),
    rejected("Enter whole repetitions for each set."),
  );
  assert.equal(doc(f.store).sessions[0]!.name, "Updated");
  assert.deepEqual(
    await f.store.completeSession({
      id: sessionId,
      name: "Updated",
      exercises: entered(f, sessionId),
      durationMinutes: "2.5",
    }),
    ok(true),
  );
  assert.equal(doc(f.store).sessions[0]!.durationSeconds, 150);
  assert.deepEqual(await f.store.removeSession(sessionId), ok(true));
  assert.deepEqual(doc(f.store).sessions, []);
});
test("invalid completion never changes the durable draft", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  const raw = f.raw();
  for (const [input, reason] of [
    [{ name: "", exercises: entered(f, sessionId) }, "Enter a workout name."],
    [{ name: "Name", exercises: [] }, "Enter at least one set."],
    [
      { name: "Name", exercises: entered(f, sessionId, "0") },
      "Enter from 1 to 100,000 repetitions for each set.",
    ],
    [
      { name: "Name", exercises: entered(f, sessionId), durationMinutes: "1e2" },
      "Enter weights and minutes as numbers of 0 or more.",
    ],
  ] as const)
    assert.deepEqual(
      await f.store.completeSession({ id: sessionId, ...input, exercises: [...input.exercises] }),
      rejected(reason),
    );
  assert.equal(f.raw(), raw);
});
test("queued stale draft cannot overwrite completion or recreate a deleted session", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  const gate = deferred<void>();
  const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => {
    await gate.promise;
    await write(key, value);
  };
  const completing = f.store.completeSession({
    id: sessionId,
    name: "Finished",
    exercises: entered(f, sessionId),
  });
  const stale = f.store.updateSession({
    id: sessionId,
    name: "Old draft",
    exercises: entered(f, sessionId, "-"),
  });
  gate.resolve();
  assert.deepEqual(await completing, ok(true));
  assert.deepEqual(await stale, rejected("This workout changed. Reopen it to continue editing."));
  assert.equal(doc(f.store).sessions[0]!.name, "Finished");
  const deleting = f.store.removeSession(sessionId);
  const deletedUpdate = f.store.updateSession({
    id: sessionId,
    name: "Revive",
    exercises: entered(f, sessionId),
  });
  assert.deepEqual(await deleting, ok(true));
  assert.deepEqual(
    await deletedUpdate,
    rejected("This workout changed. Reopen it to continue editing."),
  );
  assert.deepEqual(doc(f.store).sessions, []);
});
test("stop/start invalidates queued work while an in-flight write reloads its durable outcome", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  const gate = deferred<void>();
  const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => {
    await gate.promise;
    await write(key, value);
  };
  const first = f.store.updateSession({
    id: sessionId,
    name: "Written",
    exercises: entered(f, sessionId),
  });
  await flush();
  const queued = f.store.updateSession({
    id: sessionId,
    name: "Canceled",
    exercises: entered(f, sessionId),
  });
  f.store.stop();
  f.store.start();
  assert.equal(f.store.getSnapshot().state.kind, "loading");
  gate.resolve();
  assert.deepEqual(await Promise.all([first, queued]), [unavailable, unavailable]);
  await flush();
  assert.equal(doc(f.store).sessions[0]!.name, "Written");
  assert.deepEqual(
    await f.store.updateSession({
      id: sessionId,
      name: "Restarted",
      exercises: entered(f, sessionId),
    }),
    ok(true),
  );
});
test("corrupt and unavailable storage block edits until recovery without writing fake emptiness", async () => {
  for (const brokenRead of [false, true]) {
    const f = fixture("broken");
    if (brokenRead)
      f.storage.getItem = async () => {
        throw new Error("Offline");
      };
    f.store.start();
    await flush();
    assert.equal(f.store.getSnapshot().state.kind, "error");
    assert.deepEqual(
      await f.store.planWorkout({ date: "2026-10-04", workoutId: "missing" }),
      unavailable,
    );
    assert.equal(f.writes(), 0);
    f.storage.getItem = async () => null;
    f.store.retryLoad();
    await flush();
    const { sessionId } = await planned(f);
    assert.ok(sessionId);
  }
});
test("updates cannot alter captured identity, date, status or start time through extra properties", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  await f.store.startSession(sessionId);
  assert.deepEqual(
    await f.store.updateSession({
      id: sessionId,
      name: "Name",
      exercises: entered(f, sessionId),
      date: "2027-01-01",
      status: "completed",
      startedAt: 0,
    } as never),
    ok(true),
  );
  const saved = doc(f.store).sessions[0]!;
  assert.equal(saved.date, "2026-10-04");
  assert.equal(saved.status, "active");
  assert.equal(saved.startedAt, 1000000);
});
test("input capture works without a browser-only clone API and never converts invalid numbers to null", async () => {
  const original = globalThis.structuredClone;
  try {
    globalThis.structuredClone = undefined as never;
    const f = await ready();
    const { sessionId } = await planned(f);
    assert.deepEqual(
      await f.store.updateSession({
        id: sessionId,
        name: "Native draft",
        exercises: entered(f, sessionId),
      }),
      ok(true),
    );
    assert.deepEqual(
      await f.store.completeSession({
        id: sessionId,
        name: "Native saved",
        exercises: entered(f, sessionId),
      }),
      ok(true),
    );
    const raw = f.raw();
    for (const durationSeconds of [NaN, Infinity, -1]) {
      assert.deepEqual(
        await f.store.updateSession({
          id: sessionId,
          name: "Invalid",
          exercises: entered(f, sessionId),
          durationSeconds,
        }),
        rejected("Invalid workout duration."),
      );
    }
    assert.equal(f.raw(), raw);
  } finally {
    globalThis.structuredClone = original;
  }
});
const demoExercises = [
  {
    id: "development-example-squat",
    name: "Squat",
    tracking: "single",
    equipment: "barbell",
    muscleGroup: "legs",
    notes: "",
  },
  {
    id: "development-example-push-up",
    name: "Push-up",
    tracking: "single",
    equipment: "bodyweight",
    muscleGroup: "chest",
    notes: "",
  },
  {
    id: "development-example-dumbbell-curl",
    name: "Dumbbell curl",
    tracking: "sides",
    equipment: "dumbbells",
    muscleGroup: "arms",
    notes: "",
  },
];
test("development seeds three examples durably in new and existing empty stores", async () => {
  for (const initial of [
    null,
    JSON.stringify({ version: 1, exercises: [], workouts: [], sessions: [] }),
  ]) {
    const f = await ready(initial, true);
    assert.equal(await f.store.seedDevelopmentExamples(), true);
    assert.deepEqual(doc(f.store).exercises, demoExercises);
    assert.deepEqual(parseExerciseDocument(f.raw()), {
      version: 1,
      exercises: demoExercises,
      workouts: [],
      sessions: [],
      developmentExamplesSeeded: true,
    });
  }
});
test("development seed preserves custom definitions, snapshots and occupied reserved IDs", async () => {
  const f = await ready(null, true);
  const { exerciseId, sessionId } = await planned(f);
  await f.store.completeSession({
    id: sessionId,
    name: "Recorded",
    exercises: entered(f, sessionId),
  });
  const initial = {
    ...doc(f.store),
    exercises: [
      ...doc(f.store).exercises,
      { ...demoExercises[0], name: "My reserved squat", notes: "Keep this" },
    ],
  };
  const restored = await ready(JSON.stringify(initial), true);
  assert.equal(await restored.store.seedDevelopmentExamples(), true);
  assert.deepEqual(doc(restored.store).exercises, [
    ...initial.exercises,
    demoExercises[1],
    demoExercises[2],
  ]);
  assert.deepEqual(doc(restored.store).sessions, initial.sessions);
  assert.deepEqual(doc(restored.store).workouts, initial.workouts);
  assert.equal(doc(restored.store).exercises[0]!.id, exerciseId);
});
test("concurrent seed requests write once and deleted examples stay deleted across restart", async () => {
  const f = await ready(null, true);
  assert.deepEqual(
    await Promise.all([f.store.seedDevelopmentExamples(), f.store.seedDevelopmentExamples()]),
    [true, true],
  );
  assert.equal(f.writes(), 1);
  assert.deepEqual(await f.store.removeExercise("development-example-push-up"), ok(true));
  const restored = await ready(f.raw(), true);
  assert.equal(await restored.store.seedDevelopmentExamples(), true);
  assert.deepEqual(doc(restored.store).exercises, [demoExercises[0], demoExercises[2]]);
  assert.equal(restored.writes(), 0);
});
test("failed development seed publishes no examples or marker and can retry", async () => {
  const f = await ready(null, true);
  const { sessionId } = await planned(f);
  const before = doc(f.store),
    raw = f.raw(),
    write = f.storage.setItem;
  f.storage.setItem = async () => {
    throw new Error("Disk full");
  };
  assert.equal(await f.store.seedDevelopmentExamples(), false);
  assert.deepEqual(doc(f.store), before);
  assert.equal(f.raw(), raw);
  assert.ok(f.store.getSnapshot().error);
  f.storage.setItem = write;
  assert.equal(await f.store.seedDevelopmentExamples(), true);
  assert.equal(doc(f.store).sessions[0]!.id, sessionId);
  assert.deepEqual(doc(f.store).exercises.slice(1), demoExercises);
  assert.equal(doc(f.store).developmentExamplesSeeded, true);
});
test("development seed waits for durable success before publication and respects restart", async () => {
  const f = await ready(null, true);
  const gate = deferred<void>();
  const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => {
    await gate.promise;
    await write(key, value);
  };
  const seeding = f.store.seedDevelopmentExamples();
  await flush();
  assert.deepEqual(doc(f.store).exercises, []);
  assert.equal(doc(f.store).developmentExamplesSeeded, undefined);
  assert.equal(f.raw(), null);
  f.store.stop();
  f.store.start();
  gate.resolve();
  assert.equal(await seeding, false);
  await flush();
  assert.deepEqual(doc(f.store).exercises, demoExercises);
  assert.equal(doc(f.store).developmentExamplesSeeded, true);
  assert.equal(await f.store.seedDevelopmentExamples(), true);
  assert.equal(f.writes(), 1);
});
test("production never injects development examples even on an explicit seed request", async () => {
  const f = await ready();
  assert.equal(await f.store.seedDevelopmentExamples(), false);
  assert.deepEqual(doc(f.store), { version: 1, exercises: [], workouts: [], sessions: [] });
  assert.equal(f.raw(), null);
  assert.equal(f.writes(), 0);
});

test("only a saved workout can create a new log and deleting its template preserves the log", async () => {
  const f = await ready();
  const exerciseId = await value(
    f.store.saveExercise({
      name: "Press",
      muscleGroup: "chest",
      equipment: "barbell",
      notes: "",
      tracking: "single",
    }),
  );
  assert.ok(exerciseId);
  const before = f.raw();
  assert.deepEqual(
    await f.store.planWorkout({ date: "2026-10-04", workoutId: "missing" }),
    rejected("This workout is no longer available."),
  );
  assert.deepEqual(doc(f.store).sessions, []);
  assert.equal(f.raw(), before);
  const workoutId = await value(f.store.saveWorkout({ name: "Chest", exerciseIds: [exerciseId] }));
  assert.ok(workoutId);
  const sessionId = await value(f.store.planWorkout({ date: "2026-10-04", workoutId }));
  assert.ok(sessionId);
  assert.deepEqual(await f.store.removeWorkout(workoutId), ok(true));
  assert.deepEqual(await f.store.startSession(sessionId), ok(true));
  assert.equal(doc(f.store).sessions[0]!.exercises[0]!.exercise.name, "Press");
});
test("legacy ad hoc logs remain editable and retain their date after loading", async () => {
  const initial = {
    version: 1,
    exercises: [],
    workouts: [],
    sessions: [
      {
        id: "old-ad-hoc",
        name: "Legacy",
        date: "2026-10-03",
        status: "planned",
        startedAt: null,
        durationSeconds: null,
        exercises: [],
      },
    ],
  };
  const f = await ready(JSON.stringify(initial));
  assert.deepEqual(
    await f.store.updateSession({ id: "old-ad-hoc", name: "Edited", exercises: [] }),
    ok(true),
  );
  assert.deepEqual(await f.store.startSession("old-ad-hoc"), ok(true));
  assert.equal(doc(f.store).sessions[0]!.date, "2026-10-03");
});

test("planning preserves the trimmed name of a legacy saved workout", async () => {
  const f = await ready();
  const { workoutId } = await planned(f);
  const initial = {
    ...doc(f.store),
    sessions: [],
    workouts: doc(f.store).workouts.map((workout) => ({ ...workout, name: "  Legacy strength  " })),
  };
  const restored = await ready(JSON.stringify(initial));
  const sessionId = await value(restored.store.planWorkout({ date: "2026-10-03", workoutId }));
  assert.ok(sessionId);
  assert.equal(doc(restored.store).sessions[0]!.name, "Legacy strength");
});
test("development seeding cannot overwrite corrupt or unreadable storage during recovery", async () => {
  for (const unreadable of [false, true]) {
    const f = fixture("broken", true);
    if (unreadable)
      f.storage.getItem = async () => {
        throw new Error("Offline");
      };
    assert.equal(await f.store.seedDevelopmentExamples(), false);
    f.store.start();
    await flush();
    assert.equal(f.store.getSnapshot().state.kind, "error");
    assert.equal(await f.store.seedDevelopmentExamples(), false);
    assert.equal(f.raw(), "broken");
    assert.equal(f.writes(), 0);
    f.storage.getItem = async () => null;
    f.store.retryLoad();
    await flush();
    assert.equal(await f.store.seedDevelopmentExamples(), true);
    assert.deepEqual(doc(f.store).exercises, demoExercises);
  }
});

test("configured template set counts persist through restart and seed matching blank sets without totals", async () => {
  const f = await ready();
  const { exerciseId, workoutId } = await planned(f);
  const sidesId = await value(
    f.store.saveExercise({
      name: "Curl",
      muscleGroup: "",
      equipment: "",
      notes: "",
      tracking: "sides",
    }),
  );
  assert.ok(sidesId);
  assert.deepEqual(
    await f.store.saveWorkout({
      id: workoutId,
      name: "Configured",
      exerciseIds: [exerciseId, sidesId],
      setCounts: { [exerciseId]: 3, [sidesId]: 2 },
    }),
    ok(workoutId),
  );
  const restored = await ready(f.raw());
  const sessionId = await value(restored.store.planWorkout({ date: "2026-10-05", workoutId }));
  assert.ok(sessionId);
  const rows = doc(restored.store).sessions.find((item) => item.id === sessionId)!.exercises;
  assert.deepEqual(
    rows.map((row) => row.sets.length),
    [3, 2],
  );
  assert.deepEqual(
    rows[0]!.sets.map((set) => ({ ...set, id: "unique" })),
    Array.from({ length: 3 }, () => ({ id: "unique", kind: "single", reps: "", weightKg: "" })),
  );
  assert.deepEqual(
    rows[1]!.sets.map((set) => ({ ...set, id: "unique" })),
    Array.from({ length: 2 }, () => ({
      id: "unique",
      kind: "sides",
      left: { reps: "", weightKg: "" },
      right: { reps: "", weightKg: "" },
    })),
  );
  assert.equal(new Set(rows.flatMap((row) => row.sets.map((set) => set.id))).size, 5);
  const totals = summarizeSessions(doc(restored.store).sessions);
  assert.equal(totals.sets, 0);
  assert.equal(totals.reps, 0);
  assert.equal(totals.volume, 0);
});
test("editing without set counts preserves configured counts across reordering and trims removed exercises", async () => {
  const f = await ready();
  const { exerciseId, workoutId } = await planned(f);
  const next = await value(
    f.store.saveExercise({
      name: "Press",
      muscleGroup: "",
      equipment: "",
      notes: "",
      tracking: "single",
    }),
  );
  assert.ok(next);
  await f.store.saveWorkout({
    id: workoutId,
    name: "Configured",
    exerciseIds: [exerciseId, next],
    setCounts: { [exerciseId]: 3, [next]: 0 },
  });
  await f.store.saveWorkout({ id: workoutId, name: "Reordered", exerciseIds: [next, exerciseId] });
  assert.deepEqual(doc(f.store).workouts[0]!.setCounts, { [exerciseId]: 3, [next]: 0 });
  await f.store.saveWorkout({ id: workoutId, name: "Removed", exerciseIds: [next] });
  assert.deepEqual(doc(f.store).workouts[0]!.setCounts, { [next]: 0 });
  assert.equal((await f.store.planWorkout({ date: "2026-10-06", workoutId })).kind, "saved");
  assert.equal(doc(f.store).sessions.at(-1)!.exercises[0]!.sets.length, 0);
});
test("legacy omitted counts plan zero rows and explicit invalid counts never change storage", async () => {
  const f = await ready();
  const { exerciseId, sessionId, workoutId } = await planned(f);
  assert.equal(doc(f.store).workouts[0]!.setCounts, undefined);
  assert.equal(doc(f.store).sessions[0]!.exercises[0]!.sets.length, 0);
  const before = f.raw();
  for (const setCounts of [{ missing: 3 }, { [exerciseId]: 101 }]) {
    assert.deepEqual(
      await f.store.saveWorkout({
        id: workoutId,
        name: "Invalid",
        exerciseIds: [exerciseId],
        setCounts,
      } as never),
      rejected("Set counts must be whole numbers from 0 to 100 for selected exercises."),
    );
  }
  assert.equal(f.raw(), before);
  assert.equal(doc(f.store).sessions[0]!.id, sessionId);
});
test("single-load completion drops untouched placeholders and retains unlogged exercises with zero sets", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  const rows = entered(f, sessionId);
  rows[0]!.sets.push({ id: "untouched", kind: "single", reps: " ", weightKg: "" });
  rows.push({
    ...rows[0]!,
    id: "unlogged",
    sets: [{ id: "unlogged-set", kind: "single", reps: "", weightKg: "" }],
  });
  assert.deepEqual(
    await f.store.completeSession({ id: sessionId, name: "One set", exercises: rows }),
    ok(true),
  );
  const saved = doc(f.store).sessions[0]!;
  assert.deepEqual(
    saved.exercises.map((row) => row.sets.length),
    [1, 0],
  );
  assert.equal(saved.exercises[0]!.sets[0]!.id, "set-1");
  const totals = summarizeSessions([saved]);
  assert.equal(totals.sets, 1);
  assert.equal(totals.reps, 8);
  assert.equal(totals.volume, 80);
  assert.equal(totals.exercises.length, 1);
  assert.equal(parseExerciseDocument(f.raw()).sessions[0]!.exercises[1]!.sets.length, 0);
});
test("completed edits omit added blank sets but all-blank and partially entered sets remain invalid", async () => {
  const f = await ready();
  const { sessionId } = await planned(f);
  await f.store.completeSession({ id: sessionId, name: "Saved", exercises: entered(f, sessionId) });
  const rows = entered(f, sessionId, "10");
  rows[0]!.sets.push({ id: "blank", kind: "single", reps: "", weightKg: "" });
  assert.deepEqual(
    await f.store.updateSession({ id: sessionId, name: "Edited", exercises: rows }),
    ok(true),
  );
  assert.equal(doc(f.store).sessions[0]!.exercises[0]!.sets.length, 1);
  const before = f.raw();
  for (const [invalid, reason] of [
    [[{ id: "blank", kind: "single", reps: "", weightKg: "" }], "Enter at least one set."],
    [
      [...rows[0]!.sets, { id: "partial", kind: "single", reps: "", weightKg: "10" }],
      "Enter whole repetitions for each set.",
    ],
  ] as const) {
    assert.deepEqual(
      await f.store.updateSession({
        id: sessionId,
        name: "Invalid",
        exercises: [{ ...rows[0]!, sets: invalid as unknown as ExerciseSet[] }],
      }),
      rejected(reason),
    );
    assert.deepEqual(
      await f.store.completeSession({
        id: sessionId,
        name: "Invalid",
        exercises: [{ ...rows[0]!, sets: invalid as unknown as ExerciseSet[] }],
      }),
      rejected(reason),
    );
  }
  assert.equal(f.raw(), before);
});
test("side completion skips only fully untouched pairs and retains valid unilateral logging", async () => {
  const f = await ready();
  const sideId = await value(
    f.store.saveExercise({
      name: "Curl",
      muscleGroup: "",
      equipment: "",
      notes: "",
      tracking: "sides",
    }),
  );
  assert.ok(sideId);
  const workoutId = await value(
    f.store.saveWorkout({
      name: "Arms",
      exerciseIds: [sideId],
      setCounts: { [sideId]: 3 },
    }),
  );
  assert.ok(workoutId);
  const sessionId = await value(f.store.planWorkout({ date: "2026-10-04", workoutId }));
  assert.ok(sessionId);
  const rows = doc(f.store).sessions[0]!.exercises;
  const blank: ExerciseSet = {
    id: "blank",
    kind: "sides",
    left: { reps: "", weightKg: " " },
    right: { reps: "", weightKg: "" },
  };
  const logged: ExerciseSet = {
    id: "logged",
    kind: "sides",
    left: { reps: "", weightKg: "" },
    right: { reps: "6", weightKg: "12" },
  };
  for (const [bad, reason] of [
    [
      { ...blank, id: "bad", left: { reps: "", weightKg: "10" } },
      "Enter whole repetitions for each set.",
    ],
    [
      { ...blank, id: "bad", left: { reps: "0", weightKg: "" } },
      "Enter repetitions on at least one side of each set.",
    ],
  ] as const)
    assert.deepEqual(
      await f.store.completeSession({
        id: sessionId,
        name: "Arms",
        exercises: [{ ...rows[0]!, sets: [blank, logged, bad] }],
      }),
      rejected(reason),
    );
  assert.deepEqual(
    await f.store.completeSession({
      id: sessionId,
      name: "Arms",
      exercises: [{ ...rows[0]!, sets: [blank, logged] }],
    }),
    ok(true),
  );
  const result = summarizeSessions(doc(f.store).sessions);
  assert.equal(result.sets, 1);
  assert.equal(result.reps, 6);
  assert.equal(result.volume, 72);
  assert.deepEqual(doc(f.store).sessions[0]!.exercises[0]!.sets, [logged]);
});
test("all untouched planned sets cannot create a completed workout with fake zero totals", async () => {
  const f = await ready();
  const { exerciseId, workoutId } = await planned(f);
  await f.store.saveWorkout({
    id: workoutId,
    name: "Planned",
    exerciseIds: [exerciseId],
    setCounts: { [exerciseId]: 3 },
  });
  const sessionId = await value(f.store.planWorkout({ date: "2026-10-05", workoutId }));
  assert.ok(sessionId);
  const rows = doc(f.store).sessions.at(-1)!.exercises,
    before = f.raw();
  assert.deepEqual(
    await f.store.updateSession({ id: sessionId, name: "Still planned", exercises: rows }),
    ok(true),
  );
  const draft = f.raw();
  assert.notEqual(draft, before);
  assert.deepEqual(
    await f.store.completeSession({ id: sessionId, name: "Empty", exercises: rows }),
    rejected("Enter at least one set."),
  );
  assert.equal(f.raw(), draft);
  assert.equal(doc(f.store).sessions.at(-1)!.status, "planned");
  assert.equal(summarizeSessions(doc(f.store).sessions).sets, 0);
});

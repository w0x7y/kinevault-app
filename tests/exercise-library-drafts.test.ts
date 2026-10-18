import assert from "node:assert/strict";
import test from "node:test";
import type { WorkoutImportFlowSource } from "../src/exercise/import/import-flow.ts";
import type { ImportedWorkoutPlan } from "../src/exercise/import/plan.ts";
import { parseExerciseDocument, type ExerciseDocument } from "../src/exercise/model.ts";
import { createExercisePersistence, exerciseStorageKey } from "../src/exercise/persistence.ts";
import { createExerciseTabView } from "../src/exercise/tab-view.ts";

const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const squat = {
  id: "squat",
  name: "Squat",
  muscleGroup: "Legs",
  equipment: "",
  notes: "",
  tracking: "single" as const,
};
const template = { id: "legs", name: "Leg day", exercises: [squat], setCounts: { squat: 2 } };
const plan: ImportedWorkoutPlan = {
  source: "tracked",
  sourceId: "shared",
  name: "Imported day",
  category: null,
  exercises: [
    {
      sourceId: null,
      label: "1A",
      name: "Squat",
      sets: 3,
      reps: "5",
      rir: null,
      rest: null,
      otherChips: [],
    },
  ],
};

async function fixture(sources: readonly WorkoutImportFlowSource[] = []) {
  const document: ExerciseDocument = {
    version: 1,
    exercises: [squat],
    workouts: [template],
    sessions: [],
  };
  let raw = JSON.stringify(document),
    sequence = 0;
  const storage = {
    async getItem(key: string) {
      assert.equal(key, exerciseStorageKey);
      return raw;
    },
    async setItem(key: string, value: string) {
      assert.equal(key, exerciseStorageKey);
      raw = value;
    },
  };
  const write = storage.setItem;
  const store = createExercisePersistence({
    storage,
    createId: () => `id-${++sequence}`,
    now: () => 1120000,
  });
  store.start();
  await tick();
  const tab = createExerciseTabView({ store, date: "2026-10-04", importSources: sources });
  tab.refreshDocument();
  store.subscribe(() => tab.refreshDocument());
  const token = () => tab.getSnapshot().panel!.token;
  return {
    tab,
    drafts: tab.drafts,
    token,
    storage,
    /** Holds the next writes until the returned gate opens. */
    hold() {
      const held = gate();
      storage.setItem = async (key, value) => {
        await held.promise;
        await write(key, value);
      };
      return held;
    },
    fail() {
      storage.setItem = async () => {
        throw new Error("Disk full");
      };
    },
    restore() {
      storage.setItem = write;
    },
    saved: () => parseExerciseDocument(raw),
  };
}

test("a save finishing while its form is away still closes the panel, without a duplicate", async () => {
  const f = await fixture();
  await f.tab.requestView({ kind: "exercise" });
  const draft = f.drafts.exercise(f.token());
  draft.change((values) => ({ ...values, name: "Lunge" }));
  const held = f.hold();
  const saving = draft.save();
  await tick();
  // A form rendered again while the save is pending (e.g. back on the tab) cannot save twice.
  const remounted = f.drafts.exercise(f.token());
  assert.equal(remounted.getSnapshot().busy, true);
  assert.equal(remounted.getSnapshot().values.name, "Lunge");
  assert.equal(await remounted.save(), false);
  held.resolve();
  assert.equal(await saving, true);
  assert.equal(f.tab.getSnapshot().panel, null);
  assert.deepEqual(
    f.saved().exercises.map((exercise) => exercise.name),
    ["Squat", "Lunge"],
  );
});

test("a failed save keeps the entered fields and its feedback until a retry succeeds", async () => {
  const f = await fixture();
  await f.tab.requestView({ kind: "exercise", exercise: squat });
  const draft = f.drafts.exercise(f.token(), squat);
  draft.change((values) => ({ ...values, name: "Front squat" }));
  f.fail();
  assert.equal(await draft.save(), false);
  const retained = f.drafts.exercise(f.token(), squat).getSnapshot();
  assert.equal(retained.values.name, "Front squat");
  assert.match(retained.error!, /Couldn't save/);
  assert.equal(f.tab.getSnapshot().panel?.content.kind, "exercise");
  f.restore();
  assert.equal(await f.drafts.exercise(f.token(), squat).save(), true);
  assert.equal(f.saved().exercises[0]!.name, "Front squat");
  assert.equal(f.tab.getSnapshot().panel, null);
});

test("an exercise opened from Link demo returns to its workout after Save or Cancel", async () => {
  const f = await fixture();
  await f.tab.requestView({ kind: "library", date: "2026-10-04" });
  assert.equal(await f.drafts.savedWorkouts(f.token(), "2026-10-04").plan("legs"), true);
  const log = f.tab.getSnapshot().panel!.content;
  assert.equal(log.kind, "session");
  for (const finish of ["save", "cancel"] as const) {
    await f.tab.requestView({
      kind: "exercise",
      exercise: squat,
      linkDemo: true,
      returnTo: log,
    });
    if (finish === "save") assert.equal(await f.drafts.exercise(f.token(), squat).save(), true);
    else f.tab.closeView(f.token());
    assert.deepEqual(f.tab.getSnapshot().panel?.content, log, finish);
  }
});

test("Add to day opens the new log only once it is saved on the menu's day", async () => {
  const f = await fixture();
  await f.tab.requestView({ kind: "library", date: "2026-10-03" });
  const menu = f.drafts.savedWorkouts(f.token(), "2026-10-03");
  f.fail();
  assert.equal(await menu.plan("legs"), false);
  assert.equal(menu.getSnapshot().error, "Couldn't add this workout. Try again.");
  assert.equal(f.tab.getSnapshot().panel?.content.kind, "library");
  f.restore();
  assert.equal(await menu.plan("legs"), true);
  const [added] = f.saved().sessions;
  assert.equal(added!.date, "2026-10-03");
  assert.deepEqual(f.tab.getSnapshot().panel?.content, { kind: "session", id: added!.id });
  // Deleting a log keeps the menu open.
  await f.tab.requestView({ kind: "library", date: "2026-10-03" });
  assert.equal(await f.drafts.savedWorkouts(f.token(), "2026-10-03").removeLog(added!.id), true);
  assert.equal(f.saved().sessions.length, 0);
  assert.equal(f.tab.getSnapshot().panel?.content.kind, "library");
});

test("a late success from a replaced panel cannot close or replace the newer one", async () => {
  const f = await fixture();
  await f.tab.requestView({ kind: "library", date: "2026-10-04" });
  const menu = f.drafts.savedWorkouts(f.token(), "2026-10-04");
  const held = f.hold();
  const adding = menu.plan("legs");
  await tick();
  await f.tab.requestView({ kind: "exercise" });
  const current = f.tab.getSnapshot().panel;
  held.resolve();
  assert.equal(await adding, true);
  assert.equal(f.tab.getSnapshot().panel, current);
  assert.equal(f.saved().sessions.length, 1);
});

test("a draft retires with its panel and the next one starts from the saved definition", async () => {
  const f = await fixture();
  await f.tab.requestView({ kind: "workout", workout: template });
  const draft = f.drafts.template(f.token(), template);
  draft.change((value) => value.rename("Renamed").setCount("squat", "4"));
  assert.equal(f.drafts.template(f.token(), template).getSnapshot().draft.name, "Renamed");
  f.tab.closeView(f.token());
  await f.tab.requestView({ kind: "workout", workout: template });
  const fresh = f.drafts.template(f.token(), template).getSnapshot().draft;
  assert.equal(fresh.name, "Leg day");
  assert.equal(fresh.rows[0]!.rawCount, "2");
});

test("an invalid template draft explains itself without a write; a valid one saves and closes", async () => {
  const f = await fixture();
  await f.tab.requestView({ kind: "workout" });
  const draft = f.drafts.template(f.token());
  draft.change((value) => value.add(squat).setCount("squat", "1.5"));
  assert.equal(await draft.save(), false);
  assert.match(draft.getSnapshot().error!, /whole number of sets/);
  assert.equal(f.saved().workouts.length, 1);
  draft.change((value) => value.rename("Upper day").setCount("squat", "4"));
  assert.equal(await draft.save(), true);
  assert.equal(f.tab.getSnapshot().panel, null);
  const saved = f.saved().workouts.find((workout) => workout.name === "Upper day");
  assert.deepEqual(saved?.setCounts, { squat: 4 });
});

test("the import keeps its step while its page is away and stops once its panel closes", async () => {
  const loading = gate();
  let signal: AbortSignal | undefined;
  const f = await fixture([
    {
      id: "tracked",
      async load(_text, abort) {
        signal = abort;
        await loading.promise;
        return plan;
      },
    },
  ]);
  await f.tab.requestView({ kind: "import", source: "tracked" });
  const flow = f.drafts.workoutImport(f.token(), "tracked");
  flow.setText("https://app.tracked.gg/v/workout/shared");
  assert.equal(f.drafts.workoutImport(f.token(), "tracked"), flow);
  void flow.load();
  await tick();
  f.tab.closeView(f.token());
  assert.equal(signal?.aborted, true);
  loading.resolve();
  await tick();
  assert.equal(flow.getSnapshot().step, "link");
  await f.tab.requestView({ kind: "import", source: "tracked" });
  assert.notEqual(f.drafts.workoutImport(f.token(), "tracked"), flow);
});

test("a template draft keeps its selected exercise, builder and search when its form remounts", async () => {
  const f = await fixture();
  await f.tab.requestView({ kind: "workout", workout: template });
  const draft = f.drafts.template(f.token(), template);
  assert.equal(draft.getSnapshot().selectedId, "squat");
  assert.equal(draft.getSnapshot().settingsOpen, false);
  draft.showSettings(true);
  draft.search("lun");
  draft.select("lunge");
  // Leaving the tab unmounts the sheet; the form that mounts on return reads the same draft.
  const remounted = f.drafts.template(f.token(), template).getSnapshot();
  assert.equal(remounted.settingsOpen, true);
  assert.equal(remounted.query, "lun");
  assert.equal(remounted.selectedId, "lunge");
  await f.tab.requestView({ kind: "workout" });
  const created = f.drafts.template(f.token()).getSnapshot();
  assert.deepEqual(
    [created.settingsOpen, created.query, created.selectedId],
    [true, "", undefined],
  );
});

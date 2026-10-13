import assert from "node:assert/strict";
import test from "node:test";
import { createWorkoutImportFlow } from "../src/exercise/import/import-flow.ts";
import type { WorkoutImportResult } from "../src/exercise/import/mapping.ts";
import { WorkoutImportError, type ImportedWorkoutPlan } from "../src/exercise/import/plan.ts";

const plan: ImportedWorkoutPlan = {
  source: "tracked",
  sourceId: "00000000-0000-4000-8000-000000000001",
  name: "Push",
  category: null,
  exercises: [
    {
      sourceId: null,
      label: "1A",
      name: "Bench Press",
      sets: 3,
      reps: "5",
      rir: null,
      rest: null,
      otherChips: [],
    },
  ],
};
const result: WorkoutImportResult = {
  templateId: "tracked-00000000-0000-4000-8000-000000000001",
  name: "Push",
  exercises: 1,
  created: 1,
  replaced: false,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setup() {
  const loads: {
    text: string;
    signal: AbortSignal;
    reply: ReturnType<typeof deferred<ImportedWorkoutPlan>>;
  }[] = [];
  const saves: ReturnType<typeof deferred<WorkoutImportResult | null>>[] = [];
  const flow = createWorkoutImportFlow({
    sources: [
      {
        id: "tracked",
        load(text, signal) {
          const reply = deferred<ImportedWorkoutPlan>();
          loads.push({ text, signal, reply });
          return reply.promise;
        },
      },
    ],
    importPlan() {
      const save = deferred<WorkoutImportResult | null>();
      saves.push(save);
      return save.promise;
    },
  });
  return { flow, loads, saves };
}

test("walks from source choice through preview to an imported workout", async () => {
  const { flow, loads, saves } = setup();
  assert.deepEqual(flow.getSnapshot(), { step: "sources" });
  flow.choose("unknown");
  assert.equal(flow.getSnapshot().step, "sources");
  flow.choose("tracked");
  flow.setText(" link ");
  const loading = flow.load();
  assert.deepEqual(flow.getSnapshot(), {
    step: "link",
    source: "tracked",
    text: " link ",
    loading: true,
    error: null,
  });
  assert.equal(loads[0]!.text, " link ");
  loads[0]!.reply.resolve(plan);
  await loading;
  const preview = flow.getSnapshot();
  assert.equal(preview.step, "preview");
  const saving = flow.confirm();
  void flow.confirm();
  assert.equal(saves.length, 1);
  saves[0]!.resolve(result);
  await saving;
  assert.deepEqual(flow.getSnapshot(), { step: "done", source: "tracked", result });
});

test("keeps the link and shows a load error, and cancel stops the download", async () => {
  const { flow, loads } = setup();
  flow.choose("tracked");
  flow.setText("bad");
  const failing = flow.load();
  loads[0]!.reply.reject(new WorkoutImportError("invalid-link", "Paste a Tracked workout link."));
  await failing;
  assert.deepEqual(flow.getSnapshot(), {
    step: "link",
    source: "tracked",
    text: "bad",
    loading: false,
    error: "Paste a Tracked workout link.",
  });
  flow.setText("better");
  const edited = flow.getSnapshot();
  assert.equal(edited.step === "link" && edited.error, null);
  const cancelled = flow.load();
  flow.cancel();
  assert.equal(loads[1]!.signal.aborted, true);
  loads[1]!.reply.resolve(plan);
  await cancelled;
  assert.deepEqual(flow.getSnapshot(), {
    step: "link",
    source: "tracked",
    text: "better",
    loading: false,
    error: null,
  });
  const unexpected = flow.load();
  loads[2]!.reply.reject(new Error("socket detail"));
  await unexpected;
  const state = flow.getSnapshot();
  assert.equal(state.step === "link" && state.error, "Couldn't get this workout. Try again.");
});

test("retains the preview after a failed save and ignores results after closing", async () => {
  const { flow, loads, saves } = setup();
  flow.choose("tracked");
  flow.setText("link");
  const loading = flow.load();
  loads[0]!.reply.resolve(plan);
  await loading;
  const failed = flow.confirm();
  saves[0]!.resolve(null);
  await failed;
  const state = flow.getSnapshot();
  assert.equal(state.step, "preview");
  assert.equal(
    state.step === "preview" && state.error,
    "Couldn't import this workout. Your library hasn't changed. Try again.",
  );
  flow.back();
  assert.deepEqual(flow.getSnapshot(), {
    step: "link",
    source: "tracked",
    text: "link",
    loading: false,
    error: null,
  });
  const reload = flow.load();
  flow.stop();
  assert.equal(loads[1]!.signal.aborted, true);
  loads[1]!.reply.resolve(plan);
  await reload;
  assert.equal(flow.getSnapshot().step, "link");
});

test("opens a requested source directly", () => {
  const flow = createWorkoutImportFlow({
    sources: [{ id: "tracked", load: async () => plan }],
    initialSource: "tracked",
    importPlan: async () => result,
  });
  assert.equal(flow.getSnapshot().step, "link");
  flow.back();
  assert.deepEqual(flow.getSnapshot(), { step: "sources" });
});

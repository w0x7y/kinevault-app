import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseExerciseDocument,
  type ExerciseDefinition,
  type ExerciseDocument,
} from "../src/exercise/model.ts";
import { createExercisePersistence } from "../src/exercise/persistence.ts";
import type { DurableStorage } from "../src/persistence/durable-write.ts";
import { readTrackedLink } from "../src/exercise/import/tracked-link.ts";
import {
  capitalizeWords,
  parseTrackedWorkoutPage,
  readFlightFromHtml,
} from "../src/exercise/import/tracked-page.ts";
import {
  applyWorkoutImport,
  exerciseLibraryLimit,
  previewWorkoutImport,
  workoutLibraryLimit,
} from "../src/exercise/import/mapping.ts";
import { WorkoutImportError } from "../src/exercise/import/plan.ts";
import { fetchTrackedWorkout } from "../src/exercise/import/tracked-fetch.ts";

// Captured from a public Tracked share link on 2026-10-12 with `RSC: 1`. The sharer's
// username and avatar URL are replaced and SVG path data is shortened; rows, element
// keys and nesting are unchanged. The missing page is Tracked's response for an unknown ID.
const page = readFileSync(new URL("./fixtures/tracked-workout.rsc.txt", import.meta.url), "utf8");
const missing = readFileSync(
  new URL("./fixtures/tracked-missing.rsc.txt", import.meta.url),
  "utf8",
);
const workoutId = "01a11c30-850b-765b-841b-cae702065684";
const link = { url: `https://app.tracked.gg/v/workout/${workoutId}`, workoutId };
const empty: ExerciseDocument = { version: 1, exercises: [], workouts: [], sessions: [] };

function ids() {
  let next = 0;
  return () => `id-${++next}`;
}
function kind(expected: WorkoutImportError["kind"]) {
  return (error: unknown) => error instanceof WorkoutImportError && error.kind === expected;
}
const element = (tag: string, key: string | null, children: unknown, props = {}) => [
  "$",
  tag,
  key,
  { ...props, children },
];
const uuid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
/** A page with Tracked's semantic structure, for variants the captured page lacks. */
function synthetic(
  exercises: { label: string; name: string; chips?: string[]; key?: string | null }[],
  title = "Push day",
) {
  const items = exercises.map((exercise, index) =>
    element(
      "div",
      exercise.key === undefined ? uuid(index) : exercise.key,
      element("div", null, [
        element("div", null, exercise.label),
        element("div", null, [
          element("p", null, exercise.name),
          element(
            "div",
            null,
            (exercise.chips ?? []).map((chip) => element("span", null, chip.split(/(?= )|(?<= )/))),
          ),
        ]),
      ]),
    ),
  );
  const main = element(
    "main",
    null,
    element("div", null, [
      element("div", null, [element("h1", null, title), element("span", null, "upper")]),
      element("div", null, items),
    ]),
  );
  return `0:${JSON.stringify(main)}\n`;
}

test("finds a Tracked workout link in pasted share text", () => {
  assert.deepEqual(
    readTrackedLink(
      `Check out my workout FB on Tracked!\nhttps://app.tracked.gg/v/workout/${workoutId}`,
    ),
    link,
  );
  assert.deepEqual(
    readTrackedLink(`(http://APP.tracked.gg/v/workout/${workoutId.toUpperCase()}?ref=share).`),
    link,
  );
  for (const text of [
    "",
    "https://app.tracked.gg/v/workout/",
    `https://app.tracked.gg/v/routine/${workoutId}`,
    `https://tracked.gg/v/workout/${workoutId}`,
    `https://app.tracked.gg.example.com/v/workout/${workoutId}`,
    `https://app.tracked.gg@example.com/v/workout/${workoutId}`,
    `https://example.com/app.tracked.gg/v/workout/${workoutId}`,
    `ftp://app.tracked.gg/v/workout/${workoutId}`,
    `https://app.tracked.gg/v/workout/${workoutId}0`,
    "https://app.tracked.gg/v/workout/01a11c30-850b-765b-841b-cae70206568",
    "https://app.tracked.gg/v/workout/01a11c30-850b-765b-841b-cae70206568g",
    `${"x".repeat(2000)} https://app.tracked.gg/v/workout/${workoutId}`,
  ])
    assert.equal(readTrackedLink(text), null, text);
});

test("parses every exercise, label and prescription chip from a shared Tracked workout", () => {
  const plan = parseTrackedWorkoutPage(page, workoutId);
  assert.equal(plan.source, "tracked");
  assert.equal(plan.sourceId, workoutId);
  assert.equal(plan.name, "FB");
  assert.equal(plan.category, "full body");
  assert.equal(plan.exercises.length, 20);
  assert.deepEqual(
    plan.exercises.map((exercise) => exercise.label),
    Array.from({ length: 20 }, (_, index) => `${index + 1}A`),
  );
  assert.deepEqual(plan.exercises[2], {
    sourceId: "01a11c30-852c-76b0-b978-6b6635abe36f",
    label: "3A",
    name: "Unilateral Anatomical Shoulder 60° Incline Dumbbell Recline Curl",
    sets: 4,
    reps: "1-3",
    rir: null,
    rest: "30 sec",
    otherChips: [],
  });
  assert.deepEqual(plan.exercises[6], {
    sourceId: "01a11c30-852c-76b0-b978-7b9859db0a6c",
    label: "7A",
    name: "Jilly Pushdown",
    sets: 2,
    reps: "5-8",
    rir: "0-1",
    rest: "3 min",
    otherChips: [],
  });
  const pullover = plan.exercises[4]!;
  assert.equal(pullover.name, "Dumbbell Pullover");
  assert.deepEqual(
    [pullover.sets, pullover.reps, pullover.rir, pullover.rest, pullover.otherChips],
    [null, null, null, null, []],
  );
  // Names follow the page's displayed capitalization and lose trailing spaces.
  assert.equal(plan.exercises[5]!.name, "Lying Dumbbell Abducted Shoulder Rotation I + Ex");
  assert.equal(plan.exercises[10]!.name, "Booty Forearm");
  assert.equal(plan.exercises[15]!.name, "Adductor Machine");
  assert.equal(plan.exercises[0]!.name, "Shoulder Press Machine (Wide Grip/Top Half)");
  assert.equal(new Set(plan.exercises.map((exercise) => exercise.sourceId)).size, 20);
  // The sharer is not part of the plan.
  assert.doesNotMatch(JSON.stringify(plan), /shared by|sharer|avatar/i);
});

test("reads the same workout from the HTML page's embedded payload", () => {
  const chunks = [page.slice(0, 5000), page.slice(5000, 30000), page.slice(30000)];
  const html = `<!DOCTYPE html><html><body>${chunks
    .map((chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`)
    .join("")}<script>self.__next_f.push([0])</script></body></html>`;
  assert.equal(readFlightFromHtml(html), page);
  assert.deepEqual(
    parseTrackedWorkoutPage(readFlightFromHtml(html), workoutId),
    parseTrackedWorkoutPage(page, workoutId),
  );
  assert.throws(() => readFlightFromHtml("<html><body>Hello</body></html>"), kind("unrecognized"));
});

test("reports a deleted or private workout as unavailable", () => {
  assert.throws(() => parseTrackedWorkoutPage(missing, workoutId), kind("not-found"));
});

test("capitalizes words the way the page displays them", () => {
  assert.equal(capitalizeWords("dead stop Behind back"), "Dead Stop Behind Back");
  assert.equal(capitalizeWords("(wide grip) i + ex 60°"), "(Wide Grip) I + Ex 60°");
  assert.equal(capitalizeWords("élan t-bar"), "Élan T-bar");
});

test("keeps unknown chips, supersets and label order from varied pages", () => {
  const plan = parseTrackedWorkoutPage(
    synthetic([
      { label: "2A", name: "row", chips: ["Sets 3-4", "RPE 8", "Tempo 3-1-1"] },
      { label: "1B", name: "fly", chips: ["Reps 12", "Reps 15"], key: null },
      { label: "1A", name: "  bench   press ", chips: ["Sets 5", "Weight 80 kg"] },
    ]),
    workoutId,
  );
  assert.equal(plan.name, "Push Day");
  assert.equal(plan.category, "upper");
  assert.deepEqual(
    plan.exercises.map((exercise) => [exercise.label, exercise.name, exercise.sourceId]),
    [
      ["1A", "Bench Press", uuid(2)],
      ["1B", "Fly", null],
      ["2A", "Row", uuid(0)],
    ],
  );
  assert.deepEqual(plan.exercises[0]!.otherChips, ["Weight 80 kg"]);
  assert.equal(plan.exercises[0]!.sets, 5);
  assert.deepEqual([plan.exercises[1]!.reps, plan.exercises[1]!.otherChips], ["12", ["Reps 15"]]);
  assert.deepEqual(
    [plan.exercises[2]!.sets, plan.exercises[2]!.otherChips],
    [null, ["Sets 3-4", "RPE 8", "Tempo 3-1-1"]],
  );
});

test("rejects pages that aren't a readable Tracked workout", () => {
  for (const payload of [
    "",
    "hello world",
    "<html><body>Not a workout</body></html>",
    `0:${JSON.stringify(element("h1", null, "Welcome"))}\n`,
    `0:${"[".repeat(600)}${"]".repeat(600)}\n`,
    // Cyclic references expand once and cannot loop.
    `0:${JSON.stringify(element("div", null, "$L1"))}\n1:${JSON.stringify(element("div", null, "$L0"))}\n`,
  ])
    assert.throws(() => parseTrackedWorkoutPage(payload, workoutId), kind("unrecognized"));
  assert.throws(() => parseTrackedWorkoutPage(page, "not-an-id"), kind("unrecognized"));
  assert.throws(
    () => parseTrackedWorkoutPage(page + " ".repeat(2_000_000), workoutId),
    kind("too-large"),
  );
  const many = Array.from({ length: 101 }, (_, index) => ({
    label: `${index + 1}A`,
    name: `Exercise ${index}`,
  }));
  assert.throws(() => parseTrackedWorkoutPage(synthetic(many), workoutId), kind("too-large"));
  assert.equal(
    parseTrackedWorkoutPage(synthetic(many.slice(0, 100)), workoutId).exercises.length,
    100,
  );
});

test("bounds hostile payloads without polluting prototypes", () => {
  // Each row references the next one many times; rows expand only once.
  const rows = Array.from(
    { length: 30 },
    (_, index) =>
      `${(index + 1).toString(16)}:${JSON.stringify(
        element("div", null, Array(50).fill(`$L${(index + 2).toString(16)}`)),
      )}`,
  );
  const fanOut = `0:${JSON.stringify(element("div", null, "$L1"))}\n${rows.join("\n")}\n`;
  assert.throws(() => parseTrackedWorkoutPage(fanOut, workoutId), kind("unrecognized"));
  const polluted = synthetic([{ label: "1A", name: "Squat" }]).replace(
    '{"children"',
    '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"children"',
  );
  assert.equal(parseTrackedWorkoutPage(polluted, workoutId).exercises[0]!.name, "Squat");
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  // Text rows are length-prefixed in UTF-8 bytes and may contain line breaks.
  const textRow = `1:Tb,Café\nPress${synthetic([{ label: "1A", name: "$1" }])}`;
  assert.equal(parseTrackedWorkoutPage(textRow, workoutId).exercises[0]!.name, "Café Press");
});

test("skips an exercise whose name reads blank, so the preview never offers an unsaveable row", () => {
  // The name sits past the whitespace budget a name read covers, so it reads as blank.
  const padded = synthetic([
    { label: "1A", name: `${" ".repeat(2000)}Hidden` },
    { label: "2A", name: "Row" },
  ]);
  const plan = parseTrackedWorkoutPage(padded, workoutId);
  assert.deepEqual(
    plan.exercises.map((exercise) => [exercise.label, exercise.name]),
    [["2A", "Row"]],
  );
  assert.equal(applyWorkoutImport(empty, plan, ids()).value.exercises, 1);
  // Ordinary surrounding whitespace is still trimmed, not skipped.
  const spaced = synthetic([{ label: "1A", name: `${" ".repeat(40)}squat ` }]);
  assert.equal(parseTrackedWorkoutPage(spaced, workoutId).exercises[0]!.name, "Squat");
  // A page whose only exercise reads blank has nothing to import.
  assert.throws(
    () =>
      parseTrackedWorkoutPage(
        synthetic([{ label: "1A", name: " ".repeat(2000) + "x" }]),
        workoutId,
      ),
    kind("unrecognized"),
  );
});

test("parses near-limit nested or unterminated payloads quickly", () => {
  const nested = (depth: number, text: unknown, tag = "p"): unknown =>
    depth === 0 ? text : element(tag, null, nested(depth - 1, text, tag));
  const spaced = "ab ".repeat(620_000);
  const spans = Array.from({ length: 125 }, () => element("span", null, "x ".repeat(7000)));
  const textRows = Array.from({ length: 19_000 }, (_, index) => `${index.toString(16)}:T5,abcde`);
  const cases: [string, (error: unknown) => boolean][] = [
    [`0:${JSON.stringify(nested(125, spaced))}\n`, kind("unrecognized")],
    [`0:${JSON.stringify(nested(125, spans))}\n`, kind("unrecognized")],
    // Lines without a row ID must not each rescan the rest of the payload.
    [`${`${"x".repeat(99)}\n`.repeat(19_000)}:`, kind("unrecognized")],
    [`${"f".repeat(1_900_000)}:null\n`, kind("unrecognized")],
    [`${textRows.join("")}${"x".repeat(1_500_000)}\n`, kind("unrecognized")],
  ];
  const timed = (run: () => void) => {
    const started = performance.now();
    run();
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 300, `took ${Math.round(elapsed)} ms`);
  };
  for (const [payload, expected] of cases) {
    assert.ok(payload.length > 1_500_000 && payload.length <= 2_000_000);
    timed(() => assert.throws(() => parseTrackedWorkoutPage(payload, workoutId), expected));
  }
  const shortSpans = Array.from({ length: 125 }, () => element("span", null, "x ".repeat(2500)));
  const exercise = `0:${JSON.stringify(
    element("main", null, [
      element("h1", null, nested(100, "ab ".repeat(100_000), "span")),
      element("div", uuid(1), [
        element("div", null, "1A"),
        nested(100, shortSpans),
        element("div", null, nested(100, shortSpans.slice(0, 40), "span")),
      ]),
    ]),
  )}\n`;
  assert.ok(exercise.length > 1_000_000 && exercise.length <= 2_000_000);
  timed(() => {
    const plan = parseTrackedWorkoutPage(exercise, workoutId);
    assert.equal(plan.name, "Ab ".repeat(133) + "A");
    assert.equal(plan.exercises[0]!.name, "X ".repeat(199) + "X");
    assert.equal(plan.exercises[0]!.otherChips.length, 20);
  });
});

test("maps a plan into one workout template with new library exercises", () => {
  const plan = parseTrackedWorkoutPage(page, workoutId);
  const preview = previewWorkoutImport(empty, plan);
  assert.equal(preview.templateId, `tracked-${workoutId}`);
  assert.equal(preview.rows.length, 20);
  assert.equal(preview.newExercises, 20);
  assert.equal(preview.replacing, null);
  assert.equal(preview.problem, null);
  assert.deepEqual(
    preview.rows.filter((row) => row.sidesFromName).map((row) => row.label),
    ["2A", "3A", "4A", "8A", "10A"],
  );
  assert.equal(preview.rows[2]!.prescription, "Sets 4 · Reps 1-3 · Rest 30 sec");

  const { document, value } = applyWorkoutImport(empty, plan, ids());
  assert.deepEqual(value, {
    templateId: `tracked-${workoutId}`,
    name: "FB",
    exercises: 20,
    created: 20,
    replaced: false,
  });
  assert.deepEqual(parseExerciseDocument(JSON.stringify(document)), document);
  const template = document.workouts[0]!;
  assert.equal(template.id, `tracked-${workoutId}`);
  assert.deepEqual(
    template.exercises.map((exercise) => exercise.name),
    plan.exercises.map((exercise) => exercise.name),
  );
  const byName = (name: string) => document.exercises.find((exercise) => exercise.name === name)!;
  assert.deepEqual(byName("Jilly Pushdown"), {
    id: byName("Jilly Pushdown").id,
    name: "Jilly Pushdown",
    muscleGroup: "",
    equipment: "",
    notes: "Reps 5-8 · RIR 0-1 · Rest 3 min",
    tracking: "single",
  });
  assert.equal(byName("Dumbbell Pullover").notes, "");
  assert.equal(byName(plan.exercises[2]!.name).tracking, "sides");
  assert.equal(byName(plan.exercises[2]!.name).equipment, "dumbbell");
  assert.equal(byName("Shoulder Press Machine (Wide Grip/Top Half)").equipment, "machine");
  assert.equal(byName("Incline Smith Press (15°)").equipment, "smith machine");
  assert.equal(byName("Cable Sldl").equipment, "cable");
  assert.equal(template.setCounts![byName(plan.exercises[2]!.name).id], 4);
  assert.equal(template.setCounts![byName("Jilly Pushdown").id], 2);
  assert.equal(template.setCounts![byName("Dumbbell Pullover").id], 3);
});

test("reuses library exercises by name and never rewrites their notes", () => {
  const plan = parseTrackedWorkoutPage(page, workoutId);
  const library: ExerciseDefinition = {
    id: "mine",
    name: "  jilly   PUSHDOWN ",
    muscleGroup: "Triceps",
    equipment: "Cable",
    notes: "My cue",
    tracking: "sides",
  };
  const start = { ...empty, exercises: [library] };
  const preview = previewWorkoutImport(start, plan);
  assert.equal(preview.newExercises, 19);
  assert.equal(preview.rows[6]!.status, "library");
  assert.equal(preview.rows[6]!.tracking, "sides");
  const { document, value } = applyWorkoutImport(start, plan, ids());
  assert.equal(value.created, 19);
  assert.deepEqual(document.exercises[0], library);
  const snapshot = document.workouts[0]!.exercises[6]!;
  assert.deepEqual(snapshot, library);
  assert.notEqual(snapshot, library);
  assert.equal(document.workouts[0]!.setCounts!.mine, 2);
});

test("importing the same link again replaces its workout without duplicating exercises", () => {
  const plan = parseTrackedWorkoutPage(page, workoutId);
  const createId = ids();
  const squat: ExerciseDefinition = {
    id: "squat",
    name: "Squat",
    muscleGroup: "",
    equipment: "",
    notes: "",
    tracking: "single",
  };
  const legs = { id: "other", name: "Legs", exercises: [squat], setCounts: { squat: 3 } };
  const first = applyWorkoutImport(
    { ...empty, exercises: [squat], workouts: [legs] },
    plan,
    createId,
  ).document;
  const renamed = {
    ...first,
    workouts: first.workouts.map((workout) =>
      workout.id === `tracked-${workoutId}` ? { ...workout, name: "My FB" } : workout,
    ),
  };
  const preview = previewWorkoutImport(renamed, plan);
  assert.equal(preview.replacing?.name, "My FB");
  assert.equal(preview.newExercises, 0);
  const second = applyWorkoutImport(renamed, plan, createId);
  assert.equal(second.value.replaced, true);
  assert.equal(second.value.created, 0);
  assert.equal(second.document.exercises.length, 21);
  assert.deepEqual(parseExerciseDocument(JSON.stringify(second.document)), second.document);
  assert.deepEqual(
    second.document.workouts.map((workout) => [workout.id, workout.name]),
    [
      ["other", "Legs"],
      [`tracked-${workoutId}`, "FB"],
    ],
  );
});

test("combines a repeated exercise into one template entry", () => {
  const plan = parseTrackedWorkoutPage(
    synthetic([
      { label: "1A", name: "Bench Press", chips: ["Sets 3", "Reps 5"] },
      { label: "2A", name: "Row", chips: [] },
      { label: "3A", name: "bench press", chips: ["Sets 2"] },
    ]),
    workoutId,
  );
  const preview = previewWorkoutImport(empty, plan);
  assert.equal(preview.rows.length, 3);
  assert.equal(preview.exerciseCount, 2);
  assert.deepEqual(preview.repeated, [{ name: "Bench Press", count: 2, sets: 5 }]);
  const { document } = applyWorkoutImport(empty, plan, ids());
  assert.deepEqual(
    document.workouts[0]!.exercises.map((exercise) => exercise.name),
    ["Bench Press", "Row"],
  );
  assert.deepEqual(Object.values(document.workouts[0]!.setCounts!), [5, 3]);
  assert.equal(document.exercises[0]!.notes, "Reps 5");
});

test("blocks imports that would exceed library limits", () => {
  const plan = parseTrackedWorkoutPage(page, workoutId);
  const exercise = (index: number): ExerciseDefinition => ({
    id: `e${index}`,
    name: `Exercise ${index}`,
    muscleGroup: "",
    equipment: "",
    notes: "",
    tracking: "single",
  });
  const fullLibrary = {
    ...empty,
    exercises: Array.from({ length: exerciseLibraryLimit - 19 }, (_, index) => exercise(index)),
  };
  assert.match(previewWorkoutImport(fullLibrary, plan).problem ?? "", /library is full/);
  assert.throws(() => applyWorkoutImport(fullLibrary, plan, ids()), /library is full/);
  const roomy = { ...fullLibrary, exercises: fullLibrary.exercises.slice(1) };
  assert.equal(previewWorkoutImport(roomy, plan).problem, null);

  const template = { id: "t", name: "T", exercises: [exercise(0)], setCounts: { e0: 3 } };
  const fullWorkouts = {
    ...empty,
    exercises: [exercise(0)],
    workouts: Array.from({ length: workoutLibraryLimit }, (_, index) => ({
      ...template,
      id: `t${index}`,
    })),
  };
  assert.match(previewWorkoutImport(fullWorkouts, plan).problem ?? "", /most saved workouts/);
  fullWorkouts.workouts[0] = { ...template, id: `tracked-${workoutId}` };
  assert.equal(previewWorkoutImport(fullWorkouts, plan).problem, null);
});

test("persists an import as one write and plans its set counts", async () => {
  let raw: string | null = null,
    writes = 0;
  const storage: DurableStorage = {
    async getItem() {
      return raw;
    },
    async setItem(_key, value) {
      ++writes;
      raw = value;
    },
  };
  const store = createExercisePersistence({ storage, createId: ids(), now: () => 1000 });
  store.start();
  for (let n = 0; n < 12; n++) await Promise.resolve();
  const plan = parseTrackedWorkoutPage(page, workoutId);
  const result = await store.importWorkoutPlan(plan);
  assert.equal(result?.created, 20);
  assert.equal(writes, 1);
  const saved = parseExerciseDocument(raw);
  assert.equal(saved.workouts.length, 1);
  assert.equal(saved.exercises.length, 20);
  const sessionId = await store.planWorkout({ date: "2026-10-12", workoutId: result!.templateId });
  const session = parseExerciseDocument(raw).sessions.find((item) => item.id === sessionId)!;
  assert.equal(session.exercises[2]!.sets.length, 4);
  assert.equal(session.exercises[2]!.sets[0]!.kind, "sides");
  assert.equal(session.exercises[4]!.sets.length, 3);
  const again = await store.importWorkoutPlan(plan);
  assert.deepEqual([again?.created, again?.replaced], [0, true]);
  assert.equal(parseExerciseDocument(raw).exercises.length, 20);
  store.stop();
});

function respond(
  body: string,
  { status = 200, type = "text/x-component", url = link.url, length = "" } = {},
) {
  const response = new Response(body, {
    status,
    headers: { "content-type": type, ...(length ? { "content-length": length } : {}) },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

test("downloads a shared workout from Tracked's own host", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const plan = await fetchTrackedWorkout(link, {
    fetch: async (url, init) => {
      requests.push({ url, init });
      return respond(page);
    },
  });
  assert.equal(plan.exercises.length, 20);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.url, link.url);
  assert.deepEqual(requests[0]!.init?.headers, { RSC: "1", Accept: "text/x-component" });
  assert.equal(requests[0]!.init?.credentials, "omit");
});

test("falls back to the HTML page when the component payload can't be read", async () => {
  const html = `<html><script>self.__next_f.push(${JSON.stringify([1, page])})</script></html>`;
  const formats: string[] = [];
  const plan = await fetchTrackedWorkout(link, {
    fetch: async (_url, init) => {
      const flight = (init?.headers as Record<string, string>).RSC === "1";
      formats.push(flight ? "flight" : "html");
      return flight ? respond("1:null\n") : respond(html, { type: "text/html; charset=utf-8" });
    },
  });
  assert.deepEqual(formats, ["flight", "html"]);
  assert.equal(plan.name, "FB");
  // A server that ignores the component header still sends the HTML page once.
  const single = await fetchTrackedWorkout(link, {
    fetch: async () => respond(html, { type: "text/html" }),
  });
  assert.equal(single.exercises.length, 20);
});

test("explains unavailable, failed, oversized, redirected and slow downloads", async () => {
  const attempt = (
    fetch: (url: string, init?: RequestInit) => Promise<Response>,
    signal?: AbortSignal,
  ) => fetchTrackedWorkout(link, { fetch, signal, timeoutMs: 20 });
  await assert.rejects(
    attempt(async () => respond(missing)),
    kind("not-found"),
  );
  await assert.rejects(
    attempt(async () => respond("", { status: 404 })),
    kind("not-found"),
  );
  await assert.rejects(
    attempt(async () => respond("", { status: 503 })),
    kind("network"),
  );
  await assert.rejects(
    attempt(async () => {
      throw new TypeError("Network request failed");
    }),
    kind("network"),
  );
  await assert.rejects(
    attempt(async () => respond(page, { length: String(3 * 1024 * 1024) })),
    kind("too-large"),
  );
  await assert.rejects(
    attempt(async () => respond(page + "é".repeat(1024 * 1024))),
    kind("too-large"),
  );
  await assert.rejects(
    attempt(async () => respond(page, { url: "https://example.com/v/workout/x" })),
    kind("unrecognized"),
  );
  await assert.rejects(
    attempt(() => new Promise<Response>(() => {})),
    kind("timeout"),
  );
  const controller = new AbortController();
  const pending = attempt(() => new Promise<Response>(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(pending, kind("cancelled"));
  await assert.rejects(
    attempt(async () => respond(page), controller.signal),
    kind("cancelled"),
  );
});

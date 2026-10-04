import assert from "node:assert/strict";
import test from "node:test";
import { parseExerciseDocument, elapsedSeconds, createEmptySet, isBlankSet, type ExerciseDefinition, type ExerciseDocument, type WorkoutSession } from "../src/exercise/model.ts";
import { seedDevelopmentExamples } from "../src/exercise/commands.ts";
import { summarizeSessions } from "../src/exercise/summary.ts";

const exercise: ExerciseDefinition = { id: "curl", name: "Curl", muscleGroup: "Arms", equipment: "Dumbbells", notes: "", tracking: "sides" };
const session: WorkoutSession = { id: "session", date: "2026-10-04", name: "Strength", status: "completed", startedAt: null, durationSeconds: null,
  exercises: [{ id: "occurrence", exercise, sets: [{ id: "set", kind: "sides", left: { reps: "8", weightKg: "10" }, right: { reps: "6", weightKg: "12" } }] }] };
const document = (sessions: WorkoutSession[] = []): ExerciseDocument => ({ version: 1, exercises: [exercise], workouts: [], sessions });
const parse = (value: unknown) => parseExerciseDocument(JSON.stringify(value));

test("left/right pair counts as one set with both sides' reps and volume", () => {
  const result = summarizeSessions([session]);
  assert.equal(result.sets, 1); assert.equal(result.reps, 14); assert.equal(result.volume, 152);
  assert.equal(result.exercises.length, 1); assert.deepEqual(result.exercises[0]!.load, { kind: "range", minKg: 10, maxKg: 12 });
  assert.equal(result.durationKnown, false);
});
test("planned and active sessions never contribute totals", () => {
  const result = summarizeSessions([{ ...session, status: "planned" }, { ...session, id: "active", status: "active", startedAt: 1000 }]);
  assert.equal(result.name, null); assert.equal(result.sets, 0); assert.equal(result.volume, 0); assert.deepEqual(result.exercises, []);
});
test("multiple completed sessions aggregate independently with occurrence IDs", () => {
  const result = summarizeSessions([{ ...session, durationSeconds: 60 }, { ...session, id: "second", durationSeconds: 120 }]);
  assert.equal(result.name, "Workouts of the day"); assert.equal(result.sets, 2); assert.equal(result.reps, 28);
  assert.equal(result.volume, 304); assert.equal(result.durationSeconds, 180); assert.equal(result.durationKnown, true);
  assert.notEqual(result.exercises[0]!.id, result.exercises[1]!.id);
});
test("recorded duration sums known sessions when another manual duration is unknown", () => {
  const result = summarizeSessions([session, { ...session, id: "known", durationSeconds: 90 }]);
  assert.equal(result.durationSeconds, 90); assert.equal(result.durationKnown, true);
});
test("occurrence identities cannot collide when persisted IDs contain separators", () => {
  const result = summarizeSessions([
    { ...session, id: "a:b", exercises: [{ ...session.exercises[0]!, id: "c" }] },
    { ...session, id: "a", exercises: [{ ...session.exercises[0]!, id: "b:c" }] },
  ]);
  assert.notEqual(result.exercises[0]!.id, result.exercises[1]!.id);
});
test("bodyweight never invents lifted mass; empty exercise rows are omitted", () => {
  const result = summarizeSessions([{ ...session, exercises: [
    { id: "empty", exercise, sets: [] },
    { id: "bodyweight", exercise: { ...exercise, tracking: "single" }, sets: [{ id: "body", kind: "single", reps: "10", weightKg: "" }] },
  ] }]);
  assert.equal(result.volume, 0); assert.equal(result.exercises.length, 1);
  assert.deepEqual(result.exercises[0]!.load, { kind: "bodyweight" });
});
test("draft numeric strings survive exactly while completed measurements are strict", () => {
  const draft = { ...session, status: "planned", exercises: [{ ...session.exercises[0]!, sets: [{ id: "set", kind: "sides", left: { reps: " 1e ", weightKg: "-" }, right: { reps: ".", weightKg: "abc" } }] }] };
  assert.deepEqual(parse({ ...document(), sessions: [draft] }).sessions[0], draft);
  assert.throws(() => parse({ ...document(), sessions: [{ ...draft, status: "completed" }] }));
  for (const reps of ["0", "-1", "1.5", "1e2", "Infinity", "100001"]) {
    assert.throws(() => parse(document([{ ...session, exercises: [{ id: "row", exercise: { ...exercise, tracking: "single" }, sets: [{ id: "set", kind: "single", reps, weightKg: "10" }] }] }])));
  }
  for (const weightKg of ["-1", "1e3", "Infinity", "100001", "1junk"]) {
    assert.throws(() => parse(document([{ ...session, exercises: [{ id: "row", exercise: { ...exercise, tracking: "single" }, sets: [{ id: "set", kind: "single", reps: "1", weightKg }] }] }])));
  }
});
test("side measurements permit one zero side but reject a zero pair and nonstring drafts", () => {
  const row = session.exercises[0]!;
  const set = { id: "set", kind: "sides", left: { reps: "0", weightKg: "" }, right: { reps: "6", weightKg: "12" } };
  assert.doesNotThrow(() => parse(document([{ ...session, exercises: [{ ...row, sets: [set as never] }] }])));
  assert.throws(() => parse(document([{ ...session, exercises: [{ ...row, sets: [{ ...set, right: { reps: "0", weightKg: "" } } as never] }] }])));
  assert.throws(() => parse({ ...document(), sessions: [{ ...session, status: "planned", exercises: [{ ...row, sets: [{ ...set, left: { reps: 8, weightKg: "" } }] }] }] }));
});
test("an unused side may be blank but a weight without reps is rejected", () => {
  const row = session.exercises[0]!;
  const set = { id: "set", kind: "sides" as const, left: { reps: "", weightKg: "" }, right: { reps: "6", weightKg: "12" } };
  assert.doesNotThrow(() => parse(document([{ ...session, exercises: [{ ...row, sets: [set] }] }])));
  const result = summarizeSessions([{ ...session, exercises: [{ ...row, sets: [set] }] }]);
  assert.equal(result.reps, 6); assert.equal(result.volume, 72); assert.deepEqual(result.exercises[0]!.load, { kind: "weight", weightKg: 12 });
  assert.throws(() => parse(document([{ ...session, exercises: [{ ...row, sets: [{ ...set, left: { reps: "", weightKg: "10" } }] }] }])));
  assert.throws(() => parse(document([{ ...session, exercises: [{ ...row, sets: [{ ...set, right: { reps: "", weightKg: "" } }] }] }])));
});
test("parser rejects malformed identity, date, structure, uniqueness and lifecycle", () => {
  assert.deepEqual(parseExerciseDocument(null), { version: 1, exercises: [], workouts: [], sessions: [] });
  const invalid: unknown[] = ["broken", [], { ...document(), version: 2 }, { ...document(), exercises: [exercise, exercise] },
    { ...document(), exercises: [{ ...exercise, id: "" }] }, { ...document(), workouts: {} },
    document([{ ...session, date: "2026-02-30" }]), document([{ ...session, name: " " }]), document([{ ...session, startedAt: -1 }]),
    document([{ ...session, status: "active", startedAt: null }]), document([{ ...session, status: "planned", startedAt: 1000 }]),
    document([{ ...session, status: "active", startedAt: 1000, durationSeconds: 10 }]),
    document([{ ...session, status: "completed", durationSeconds: -1 }]), document([{ ...session, exercises: [] }]),
    document([session, session]), document([{ ...session, exercises: [session.exercises[0]!, session.exercises[0]!] }]),
    document([{ ...session, exercises: [{ ...session.exercises[0]!, sets: [session.exercises[0]!.sets[0]!, session.exercises[0]!.sets[0]!] }] }]),
    document([{ ...session, status: "active", startedAt: 1000 }, { ...session, id: "other", status: "active", startedAt: 2000 }]),
    document([{ ...session, exercises: [{ ...session.exercises[0]!, exercise: { ...exercise, tracking: "single" } }] }]),
  ];
  for (const value of invalid) assert.throws(() => parse(value), JSON.stringify(value));
});
test("elapsed timer derives wall time, floors seconds and tolerates clock moving back", () => {
  const active = { ...session, status: "active" as const, startedAt: 1000 };
  assert.equal(elapsedSeconds(active, 42500), 41); assert.equal(elapsedSeconds(active, 500), 0);
  assert.equal(elapsedSeconds({ ...session, durationSeconds: 120 }, 999999), 120);
  assert.equal(elapsedSeconds({ ...session, status: "planned" }, 999999), 0);
});

test("development example marker survives parsing without changing legacy session data", () => {
  const legacy = document([session, { ...session, id: "legacy-empty", name: "", status: "planned", exercises: [] }]);
  assert.deepEqual(parse(legacy), legacy);
  assert.deepEqual(parse({ ...legacy, developmentExamplesSeeded: true }), { ...legacy, developmentExamplesSeeded: true });
  for (const marker of [false, null, "true", 1]) {
    assert.throws(() => parse({ ...legacy, developmentExamplesSeeded: marker }));
  }
});

test("a completed development seed never recreates a removed example", () => {
  const seeded: ExerciseDocument = { ...document([session]), developmentExamplesSeeded: true };
  assert.deepEqual(seedDevelopmentExamples(seeded).document, seeded);
});

test("legacy templates omit set counts while configured counts survive version-one parsing", () => {
  const workout = { id: "template", name: "Arms", exercises: [exercise] };
  assert.deepEqual(parse({ ...document(), workouts: [workout] }).workouts[0], workout);
  for (const count of [0, 3, 100]) {
    const configured = { ...workout, setCounts: { curl: count } };
    assert.deepEqual(parse({ ...document(), workouts: [configured] }).workouts[0], configured);
  }
  for (const setCounts of [null, [], 3, { missing: 3 }, { curl: -1 }, { curl: 101 }, { curl: 1.5 }, { curl: "3" }]) {
    assert.throws(() => parse({ ...document(), workouts: [{ ...workout, setCounts }] }));
  }
});
test("empty set factory creates tracking-specific isolated placeholders and blank detection ignores whitespace", () => {
  assert.deepEqual(createEmptySet("single", "single-blank"), { id: "single-blank", kind: "single", reps: "", weightKg: "" });
  const sides = createEmptySet("sides", "sides-blank");
  assert.deepEqual(sides, { id: "sides-blank", kind: "sides", left: { reps: "", weightKg: "" }, right: { reps: "", weightKg: "" } });
  assert.equal(isBlankSet(sides), true);
  if (sides.kind !== "sides") throw new Error("Expected side tracking");
  sides.left.reps = "8"; assert.equal(sides.right.reps, ""); assert.equal(isBlankSet(sides), false);
  assert.equal(isBlankSet({ id: "space", kind: "single", reps: " \t", weightKg: " " }), true);
  assert.equal(isBlankSet({ id: "zero", kind: "single", reps: "0", weightKg: "" }), false);
  assert.equal(isBlankSet({ id: "weight", kind: "single", reps: "", weightKg: "10" }), false);
  assert.equal(isBlankSet({ id: "side-weight", kind: "sides", left: { reps: "", weightKg: "" }, right: { reps: "", weightKg: "10" } }), false);
});
test("persisted completed records still reject untouched placeholders alongside valid sets", () => {
  const row = session.exercises[0]!;
  assert.throws(() => parse(document([{ ...session, exercises: [{ ...row, sets: [...row.sets, { id: "blank", kind: "sides", left: { reps: "", weightKg: "" }, right: { reps: "", weightKg: "" } }] }] }])));
});

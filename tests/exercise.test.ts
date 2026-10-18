import assert from "node:assert/strict";
import test from "node:test";
import {
  parseExerciseDocument,
  elapsedSeconds,
  matchingExercises,
  parsePlannedSetCount,
  setHints,
  type ExerciseDefinition,
  type ExerciseDocument,
  type ExerciseSet,
  type WorkoutSession,
} from "../src/exercise/model.ts";
import { seedDevelopmentExamples } from "../src/exercise/commands.ts";
import { summarizeSessions } from "../src/exercise/summary.ts";

const exercise: ExerciseDefinition = {
  id: "curl",
  name: "Curl",
  muscleGroup: "Arms",
  equipment: "Dumbbells",
  notes: "",
  tracking: "sides",
};
const session: WorkoutSession = {
  id: "session",
  date: "2026-10-04",
  name: "Strength",
  status: "completed",
  startedAt: null,
  durationSeconds: null,
  exercises: [
    {
      id: "occurrence",
      exercise,
      sets: [
        {
          id: "set",
          kind: "sides",
          left: { reps: "8", weightKg: "10" },
          right: { reps: "6", weightKg: "12" },
        },
      ],
    },
  ],
};
const document = (sessions: WorkoutSession[] = []): ExerciseDocument => ({
  version: 1,
  exercises: [exercise],
  workouts: [],
  sessions,
});
const parse = (value: unknown) => parseExerciseDocument(JSON.stringify(value));

test("left/right pair counts as one set with both sides' reps and volume", () => {
  const result = summarizeSessions([session]);
  assert.equal(result.sets, 1);
  assert.equal(result.reps, 14);
  assert.equal(result.volume, 152);
  assert.equal(result.exercises.length, 1);
  assert.deepEqual(result.exercises[0]!.load, { kind: "range", minKg: 10, maxKg: 12 });
  assert.equal(result.durationKnown, false);
});
test("planned and active sessions never contribute totals", () => {
  const result = summarizeSessions([
    { ...session, status: "planned" },
    { ...session, id: "active", status: "active", startedAt: 1000 },
  ]);
  assert.equal(result.name, null);
  assert.equal(result.sets, 0);
  assert.equal(result.volume, 0);
  assert.deepEqual(result.exercises, []);
});
test("multiple completed sessions aggregate independently with occurrence IDs", () => {
  const result = summarizeSessions([
    { ...session, durationSeconds: 60 },
    { ...session, id: "second", durationSeconds: 120 },
  ]);
  assert.equal(result.name, "Workouts of the day");
  assert.equal(result.sets, 2);
  assert.equal(result.reps, 28);
  assert.equal(result.volume, 304);
  assert.equal(result.durationSeconds, 180);
  assert.equal(result.durationKnown, true);
  assert.notEqual(result.exercises[0]!.id, result.exercises[1]!.id);
});
test("recorded duration sums known sessions when another manual duration is unknown", () => {
  const result = summarizeSessions([session, { ...session, id: "known", durationSeconds: 90 }]);
  assert.equal(result.durationSeconds, 90);
  assert.equal(result.durationKnown, true);
});
test("occurrence identities cannot collide when persisted IDs contain separators", () => {
  const result = summarizeSessions([
    { ...session, id: "a:b", exercises: [{ ...session.exercises[0]!, id: "c" }] },
    { ...session, id: "a", exercises: [{ ...session.exercises[0]!, id: "b:c" }] },
  ]);
  assert.notEqual(result.exercises[0]!.id, result.exercises[1]!.id);
});
test("bodyweight never invents lifted mass; empty exercise rows are omitted", () => {
  const result = summarizeSessions([
    {
      ...session,
      exercises: [
        { id: "empty", exercise, sets: [] },
        {
          id: "bodyweight",
          exercise: { ...exercise, tracking: "single" },
          sets: [{ id: "body", kind: "single", reps: "10", weightKg: "" }],
        },
      ],
    },
  ]);
  assert.equal(result.volume, 0);
  assert.equal(result.exercises.length, 1);
  assert.deepEqual(result.exercises[0]!.load, { kind: "bodyweight" });
});
test("draft numeric strings survive exactly while completed measurements are strict", () => {
  const draft = {
    ...session,
    status: "planned",
    exercises: [
      {
        ...session.exercises[0]!,
        sets: [
          {
            id: "set",
            kind: "sides",
            left: { reps: " 1e ", weightKg: "-" },
            right: { reps: ".", weightKg: "abc" },
          },
        ],
      },
    ],
  };
  assert.deepEqual(parse({ ...document(), sessions: [draft] }).sessions[0], draft);
  assert.throws(() => parse({ ...document(), sessions: [{ ...draft, status: "completed" }] }));
  for (const reps of ["0", "-1", "1.5", "1e2", "Infinity", "100001"]) {
    assert.throws(() =>
      parse(
        document([
          {
            ...session,
            exercises: [
              {
                id: "row",
                exercise: { ...exercise, tracking: "single" },
                sets: [{ id: "set", kind: "single", reps, weightKg: "10" }],
              },
            ],
          },
        ]),
      ),
    );
  }
  for (const weightKg of ["-1", "1e3", "Infinity", "100001", "1junk"]) {
    assert.throws(() =>
      parse(
        document([
          {
            ...session,
            exercises: [
              {
                id: "row",
                exercise: { ...exercise, tracking: "single" },
                sets: [{ id: "set", kind: "single", reps: "1", weightKg }],
              },
            ],
          },
        ]),
      ),
    );
  }
});
test("side measurements permit one zero side but reject a zero pair and nonstring drafts", () => {
  const row = session.exercises[0]!;
  const set = {
    id: "set",
    kind: "sides",
    left: { reps: "0", weightKg: "" },
    right: { reps: "6", weightKg: "12" },
  };
  assert.doesNotThrow(() =>
    parse(document([{ ...session, exercises: [{ ...row, sets: [set as never] }] }])),
  );
  assert.throws(() =>
    parse(
      document([
        {
          ...session,
          exercises: [{ ...row, sets: [{ ...set, right: { reps: "0", weightKg: "" } } as never] }],
        },
      ]),
    ),
  );
  assert.throws(() =>
    parse({
      ...document(),
      sessions: [
        {
          ...session,
          status: "planned",
          exercises: [{ ...row, sets: [{ ...set, left: { reps: 8, weightKg: "" } }] }],
        },
      ],
    }),
  );
});
test("parser rejects malformed identity, date, structure, uniqueness and lifecycle", () => {
  assert.deepEqual(parseExerciseDocument(null), {
    version: 1,
    exercises: [],
    workouts: [],
    sessions: [],
  });
  const invalid: unknown[] = [
    "broken",
    [],
    { ...document(), version: 2 },
    { ...document(), exercises: [exercise, exercise] },
    { ...document(), exercises: [{ ...exercise, id: "" }] },
    { ...document(), workouts: {} },
    document([{ ...session, date: "2026-02-30" }]),
    document([{ ...session, name: " " }]),
    document([{ ...session, startedAt: -1 }]),
    document([{ ...session, status: "active", startedAt: null }]),
    document([{ ...session, status: "planned", startedAt: 1000 }]),
    document([{ ...session, status: "active", startedAt: 1000, durationSeconds: 10 }]),
    document([{ ...session, status: "completed", durationSeconds: -1 }]),
    document([{ ...session, exercises: [] }]),
    document([session, session]),
    document([{ ...session, exercises: [session.exercises[0]!, session.exercises[0]!] }]),
    document([
      {
        ...session,
        exercises: [
          {
            ...session.exercises[0]!,
            sets: [session.exercises[0]!.sets[0]!, session.exercises[0]!.sets[0]!],
          },
        ],
      },
    ]),
    document([
      { ...session, status: "active", startedAt: 1000 },
      { ...session, id: "other", status: "active", startedAt: 2000 },
    ]),
    document([
      {
        ...session,
        exercises: [{ ...session.exercises[0]!, exercise: { ...exercise, tracking: "single" } }],
      },
    ]),
  ];
  for (const value of invalid) assert.throws(() => parse(value), JSON.stringify(value));
});
test("elapsed timer derives wall time, floors seconds and tolerates clock moving back", () => {
  const active = { ...session, status: "active" as const, startedAt: 1000 };
  assert.equal(elapsedSeconds(active, 42500), 41);
  assert.equal(elapsedSeconds(active, 500), 0);
  assert.equal(elapsedSeconds({ ...session, durationSeconds: 120 }, 999999), 120);
  assert.equal(elapsedSeconds({ ...session, status: "planned" }, 999999), 0);
});

test("development example marker survives parsing without changing legacy session data", () => {
  const legacy = document([
    session,
    { ...session, id: "legacy-empty", name: "", status: "planned", exercises: [] },
  ]);
  assert.deepEqual(parse(legacy), legacy);
  assert.deepEqual(parse({ ...legacy, developmentExamplesSeeded: true }), {
    ...legacy,
    developmentExamplesSeeded: true,
  });
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
  for (const setCounts of [
    null,
    [],
    3,
    { missing: 3 },
    { curl: -1 },
    { curl: 101 },
    { curl: 1.5 },
    { curl: "3" },
  ]) {
    assert.throws(() => parse({ ...document(), workouts: [{ ...workout, setCounts }] }));
  }
});
test("persisted completed records still reject untouched placeholders alongside valid sets", () => {
  const row = session.exercises[0]!;
  assert.throws(() =>
    parse(
      document([
        {
          ...session,
          exercises: [
            {
              ...row,
              sets: [
                ...row.sets,
                {
                  id: "blank",
                  kind: "sides",
                  left: { reps: "", weightKg: "" },
                  right: { reps: "", weightKg: "" },
                },
              ],
            },
          ],
        },
      ]),
    ),
  );
});

const squat: ExerciseDefinition = { ...exercise, id: "squat", name: "Squat", tracking: "single" };
const lift = (id: string, reps: string, weightKg: string): ExerciseSet => ({
  id,
  kind: "single",
  reps,
  weightKg,
});
const blank = (id: string) => lift(id, "", "");
function log(
  id: string,
  date: string,
  sets: ExerciseSet[],
  status: WorkoutSession["status"] = "completed",
  definition = squat,
): WorkoutSession {
  return {
    ...session,
    id,
    date,
    status,
    startedAt: status === "active" ? 1000 : null,
    exercises: [{ id: `${id}-row`, exercise: definition, sets }],
  };
}
const today = { id: "today", date: "2026-10-04" };
const hints = (sessions: WorkoutSession[], sets: ExerciseSet[], definition = squat) =>
  setHints(sessions, today, { id: "row", exercise: definition, sets });
const hint = (reps?: string, weightKg?: string) => ({ kind: "single", reps, weightKg });

test("Previous sets come from the latest other completed log on or before the log's day", () => {
  const sessions = [
    log("older", "2026-10-02", [lift("a", "8", "50")]),
    log("latest", "2026-10-03", [lift("b", "6", "60"), lift("c", "5", "65")]),
    log("later", "2026-10-05", [lift("d", "1", "1")]),
    // The log being edited never hints at itself.
    log("today", "2026-10-04", [lift("e", "9", "90")]),
  ];
  assert.deepEqual(hints(sessions, [blank("x"), blank("y")]), [hint("6", "60"), hint("5", "65")]);
});

test("Previous sets skip drafts, active logs and logs without sets for the exercise", () => {
  const sessions = [
    log("old", "2026-10-01", [lift("a", "8", "50")]),
    log("draft", "2026-10-03", [lift("b", "6", "60")], "planned"),
    log("running", "2026-10-03", [lift("c", "6", "60")], "active"),
    log("empty", "2026-10-03", []),
    log("other", "2026-10-03", [lift("d", "6", "60")], "completed", { ...squat, id: "bench" }),
  ];
  assert.deepEqual(hints(sessions, [blank("x")]), [hint("8", "50")]);
});

test("same-day completed logs hint from the first in document order", () => {
  const sessions = [
    log("first", "2026-10-03", [lift("a", "8", "50")]),
    log("second", "2026-10-03", [lift("b", "6", "60")]),
  ];
  assert.deepEqual(hints(sessions, [blank("x")]), [hint("8", "50")]);
});

test("a set past the previous sets hints from the set above it; blank values give no hint", () => {
  const sessions = [log("old", "2026-10-03", [lift("a", "8", "")])];
  assert.deepEqual(hints(sessions, [blank("x"), lift("y", "7", ""), blank("z")]), [
    hint("8"),
    // Falls back to the blank set above.
    hint(),
    hint("7"),
  ]);
  assert.deepEqual(hints([], [blank("x")]), [hint()]);
});

test("hints follow a tracking change between single-load and left/right sets", () => {
  const sided: ExerciseSet = {
    id: "a",
    kind: "sides",
    left: { reps: "8", weightKg: "10" },
    right: { reps: "6", weightKg: "" },
  };
  const sides = { ...squat, tracking: "sides" as const };
  // A single-load set reads the left side.
  assert.deepEqual(hints([log("old", "2026-10-03", [sided], "completed", sides)], [blank("x")]), [
    hint("8", "10"),
  ]);
  const blankSides: ExerciseSet = {
    id: "x",
    kind: "sides",
    left: { reps: "", weightKg: "" },
    right: { reps: "", weightKg: "" },
  };
  assert.deepEqual(
    hints([log("old", "2026-10-03", [sided], "completed", sides)], [blankSides], sides),
    [
      {
        kind: "sides",
        left: { reps: "8", weightKg: "10" },
        right: { reps: "6", weightKg: undefined },
      },
    ],
  );
  // A left/right set reads a single load on both sides.
  assert.deepEqual(hints([log("old", "2026-10-03", [lift("a", "5", "20")])], [blankSides], sides), [
    {
      kind: "sides",
      left: { reps: "5", weightKg: "20" },
      right: { reps: "5", weightKg: "20" },
    },
  ]);
});

test("library search matches name, muscle group, equipment or notes in any case", () => {
  const library: ExerciseDefinition[] = [
    { ...squat, id: "a", name: "Back Squat", muscleGroup: "Legs", equipment: "Barbell" },
    { ...squat, id: "b", name: "Curl", muscleGroup: "Arms", equipment: "Dumbbells" },
    { ...squat, id: "c", name: "Press", muscleGroup: "", equipment: "", notes: "Barbell variant" },
  ];
  const ids = (search: string) => matchingExercises(library, search).map((item) => item.id);
  assert.deepEqual(ids("squat"), ["a"]);
  assert.deepEqual(ids("arms"), ["b"]);
  assert.deepEqual(ids("barbell"), ["a", "c"]);
  assert.deepEqual(ids("bench"), []);
});

test("planned set counts are whole numbers from 0 to 100", () => {
  for (const [raw, count] of [
    ["0", 0],
    [" 3 ", 3],
    ["100", 100],
  ] as const)
    assert.equal(parsePlannedSetCount(raw), count);
  for (const raw of ["", "-1", "101", "3.0", "1e2", "abc"])
    assert.equal(parsePlannedSetCount(raw), null);
});

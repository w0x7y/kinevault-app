import assert from "node:assert/strict";
import test from "node:test";
import { parseFoodLog, type FoodLogDocument } from "../src/food/log-model.ts";
import { parseWaterLog } from "../src/water/model.ts";
import {
  parseWorkoutSession,
  type ExerciseSet,
  type WorkoutSession,
} from "../src/exercise/model.ts";
import { profileStreak, workoutGraph, workoutWeekLabel } from "../src/profile/activity.ts";

function food(days: Record<string, unknown[]> = {}): FoodLogDocument {
  return parseFoodLog(JSON.stringify({ version: 1, days }));
}
const entry = {
  id: "food-1",
  fdcId: 1,
  name: "Food",
  grams: 50,
  meal: "breakfast",
  calories: 0,
  carbs: 0,
  protein: 0,
  fat: 0,
};
function water(days: Record<string, number> = {}) {
  return parseWaterLog(JSON.stringify({ version: 1, days }));
}
function single(weightKg = "10", reps = "5"): ExerciseSet {
  return { id: "set-1", kind: "single", reps, weightKg };
}
function sides(leftKg: string, leftReps: string, rightKg: string, rightReps: string): ExerciseSet {
  return {
    id: "set-1",
    kind: "sides",
    left: { reps: leftReps, weightKg: leftKg },
    right: { reps: rightReps, weightKg: rightKg },
  };
}
function session(
  input: {
    id?: string;
    date?: string;
    name?: string;
    exerciseId?: string;
    exerciseName?: string;
    sets?: ExerciseSet[];
    tracking?: "single" | "sides";
    status?: WorkoutSession["status"];
    durationSeconds?: number | null;
  } = {},
): WorkoutSession {
  const status = input.status ?? "completed";
  return parseWorkoutSession({
    id: input.id ?? "session-1",
    date: input.date ?? "2026-10-04",
    name: input.name ?? "Strength",
    status,
    startedAt: status === "active" ? 1 : null,
    durationSeconds: input.durationSeconds === undefined ? null : input.durationSeconds,
    exercises: [
      {
        id: "row-1",
        exercise: {
          id: input.exerciseId ?? "press",
          name: input.exerciseName ?? "Press",
          muscleGroup: "",
          equipment: "",
          notes: "",
          tracking: input.tracking ?? "single",
        },
        sets: input.sets ?? [single()],
      },
    ],
  });
}
const pressKey = JSON.stringify(["press", "single"]);
const sidesKey = JSON.stringify(["press", "sides"]);

test("streak deduplicates qualifying sources and ignores future, zero water, and unfinished workouts", () => {
  const result = profileStreak({
    today: "2026-10-04",
    food: food({
      "2026-10-01": [entry],
      "2026-10-04": [],
      "2026-10-05": [{ ...entry, id: "food-2" }],
    }),
    water: water({ "2026-10-01": 250, "2026-10-02": 0, "2026-10-03": 250, "2026-10-05": 250 }),
    sessions: [
      session({ date: "2026-10-01" }),
      session({ date: "2026-10-03", id: "duplicate" }),
      session({ date: "2026-10-02", id: "planned", status: "planned" }),
      session({ id: "active", status: "active" }),
      session({ date: "2026-10-05", id: "future" }),
    ],
  });
  assert.deepEqual(result, {
    current: 1,
    longest: 1,
    days: ["2026-10-01", "2026-10-03"],
    week: [
      { date: "2026-10-04", logged: false },
      { date: "2026-10-05", logged: false },
      { date: "2026-10-06", logged: false },
      { date: "2026-10-07", logged: false },
      { date: "2026-10-08", logged: false },
      { date: "2026-10-09", logged: false },
      { date: "2026-10-10", logged: false },
    ],
  });
});

test("streak displays the Sunday through Saturday calendar week containing today", () => {
  for (const [today, todayIndex, dates] of [
    [
      "2026-10-04",
      0,
      [
        "2026-10-04",
        "2026-10-05",
        "2026-10-06",
        "2026-10-07",
        "2026-10-08",
        "2026-10-09",
        "2026-10-10",
      ],
    ],
    [
      "2026-10-03",
      6,
      [
        "2026-09-27",
        "2026-09-28",
        "2026-09-29",
        "2026-09-30",
        "2026-10-01",
        "2026-10-02",
        "2026-10-03",
      ],
    ],
    [
      "2026-01-01",
      4,
      [
        "2025-12-28",
        "2025-12-29",
        "2025-12-30",
        "2025-12-31",
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
      ],
    ],
  ] satisfies [string, number, string[]][]) {
    const result = profileStreak({
      today,
      food: food(),
      water: water(Object.fromEntries(dates.map((date) => [date, 250]))),
      sessions: [],
    });
    assert.deepEqual(
      result.week,
      dates.map((date, index) => ({ date, logged: index <= todayIndex })),
      today,
    );
    assert.equal(result.current, todayIndex + 1, today);
    assert.equal(result.longest, todayIndex + 1, today);
  }
});

test("current streak grants yesterday grace and expires the following day", () => {
  assert.equal(
    profileStreak({
      today: "2026-10-04",
      food: { version: 1, days: {} },
      water: { version: 1, days: { "2026-10-02": 250, "2026-10-03": 250 } },
      sessions: [],
    }).current,
    2,
  );
  assert.equal(
    profileStreak({
      today: "2026-10-05",
      food: { version: 1, days: {} },
      water: { version: 1, days: { "2026-10-02": 250, "2026-10-03": 250 } },
      sessions: [],
    }).current,
    0,
  );
  assert.equal(
    profileStreak({
      today: "2026-10-04",
      food: food(),
      water: water({ "2026-10-02": 250, "2026-10-03": 250, "2026-10-04": 250 }),
      sessions: [],
    }).current,
    3,
  );
});

test("clearing food, zeroing water, and deleting workouts recomputes streaks without retained activity", () => {
  const before = {
    today: "2026-10-04",
    food: food({ "2026-10-02": [entry] }),
    water: water({ "2026-10-03": 250 }),
    sessions: [session()],
  };
  assert.equal(profileStreak(before).current, 3);
  const cleared = profileStreak({
    ...before,
    food: food({ "2026-10-02": [] }),
    water: water({ "2026-10-03": 0 }),
    sessions: [],
  });
  assert.deepEqual(
    { current: cleared.current, longest: cleared.longest, days: cleared.days },
    { current: 0, longest: 0, days: [] },
  );
});

test("longest streak includes earlier runs", () => {
  const result = profileStreak({
    today: "2026-10-04",
    food: food(),
    water: water({ "2026-09-01": 1, "2026-09-02": 1, "2026-09-03": 1, "2026-10-04": 1 }),
    sessions: [],
  });
  assert.equal(result.longest, 3);
  assert.equal(result.current, 1);
});

test("exercise options preserve snapshot identities and tracking while choosing latest historical names", () => {
  const { options } = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "weight",
    sessions: [
      session({ id: "new", date: "2026-10-03", exerciseName: "Renamed press" }),
      session({
        id: "sides",
        date: "2026-10-02",
        tracking: "sides",
        sets: [sides("10", "5", "20", "5")],
      }),
      session({ id: "old", date: "2026-10-01", exerciseName: "Old press" }),
      session({ id: "deleted", exerciseId: "deleted", exerciseName: "Deleted definition" }),
      session({ id: "future", date: "2026-10-05", exerciseName: "Future name" }),
      session({ id: "planned", exerciseId: "planned", status: "planned" }),
      session({ id: "active", exerciseId: "active", status: "active" }),
    ],
  });
  assert.deepEqual(options, [
    { key: JSON.stringify(["deleted", "single"]), name: "Deleted definition", tracking: "single" },
    { key: sidesKey, name: "Press", tracking: "sides" },
    { key: pressKey, name: "Renamed press", tracking: "single" },
  ]);
});

test("graph covers each range in weeks ending today and preserves empty weeks as null", () => {
  for (const [weeks, first] of [
    [4, "2026-09-13"],
    [12, "2026-07-19"],
    [52, "2025-10-12"],
  ] satisfies [4 | 12 | 52, string][]) {
    const graph = workoutGraph({ today: "2026-10-04", weeks, metric: "volume", sessions: [] });
    assert.equal(graph.weeks.length, weeks);
    assert.equal(graph.weeks[0]?.date, first);
    assert.equal(graph.latest, graph.weeks.at(-1));
    assert.deepEqual(graph.latest, {
      date: "2026-10-04",
      total: null,
      left: null,
      right: null,
      workouts: 0,
      partialDuration: false,
    });
    assert.equal(
      graph.weeks.every((week) => week.total === null),
      true,
    );
    assert.equal(graph.unit, "kg x reps");
    assert.equal(graph.tracking, "single");
    assert.equal(graph.pending, `No volume logged in the last ${weeks} weeks.`);
  }
});

test("exercise weight falls back to the first option when the chosen exercise has no completed sets", () => {
  const sessions = [
    session(),
    session({ id: "squat", exerciseId: "squat", exerciseName: "Squat", sets: [single("50")] }),
  ];
  for (const exerciseKey of [undefined, JSON.stringify(["missing", "single"])]) {
    const graph = workoutGraph({
      today: "2026-10-04",
      weeks: 4,
      metric: "weight",
      exerciseKey,
      sessions,
    });
    assert.equal(graph.exerciseKey, pressKey);
    assert.equal(graph.latest.total, 10);
  }
  const squat = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "weight",
    exerciseKey: JSON.stringify(["squat", "single"]),
    sessions,
  });
  assert.equal(squat.exerciseKey, JSON.stringify(["squat", "single"]));
  assert.equal(squat.latest.total, 50);

  const none = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "weight",
    exerciseKey: pressKey,
    sessions: [session({ status: "planned" })],
  });
  assert.deepEqual(none.options, []);
  assert.equal(none.exerciseKey, undefined);
  assert.equal(none.tracking, "single");
  assert.equal(
    none.weeks.every((week) => week.total === null && week.workouts === 0),
    true,
  );
  assert.equal(none.pending, "No exercise weight logged in the last 4 weeks.");
});

test("the graph waits for measurements in two different weeks", () => {
  const graph = (sessions: WorkoutSession[], metric: "volume" | "duration" = "volume") =>
    workoutGraph({ today: "2026-10-04", weeks: 12, metric, sessions });
  const trend = "Your trend appears after workouts in two different weeks.";
  assert.equal(graph([session()]).pending, trend);
  assert.equal(graph([session(), session({ id: "monday", date: "2026-09-28" })]).pending, trend);
  assert.equal(graph([session(), session({ id: "sunday", date: "2026-09-27" })]).pending, null);
  // Workouts without a recorded duration measure nothing.
  assert.equal(
    graph([session(), session({ id: "earlier", date: "2026-09-20" })], "duration").pending,
    "No duration logged in the last 12 weeks.",
  );
});

test("a selected week's label names its end date, values and unrecorded durations", () => {
  const volume = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "volume",
    sessions: [session()],
  });
  assert.equal(workoutWeekLabel(volume, volume.latest), "Week ending 2026-10-04: 50 kg x reps");
  assert.equal(
    workoutWeekLabel(volume, volume.weeks[0]!),
    "Week ending 2026-09-13: No measurement recorded",
  );
  const weight = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "weight",
    exerciseKey: sidesKey,
    sessions: [
      session({ tracking: "sides", sets: [sides("10", "5", "20", "5")] }),
      session({
        id: "left",
        date: "2026-09-27",
        tracking: "sides",
        sets: [sides("8", "5", "", "")],
      }),
    ],
  });
  assert.equal(
    workoutWeekLabel(weight, weight.latest),
    "Week ending 2026-10-04: Left 10 kg, Right 20 kg",
  );
  assert.equal(
    workoutWeekLabel(weight, weight.weeks.at(-2)!),
    "Week ending 2026-09-27: Left 8 kg, Right not logged",
  );
  const duration = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "duration",
    sessions: [session({ durationSeconds: 1800 }), session({ id: "unknown" })],
  });
  assert.equal(
    workoutWeekLabel(duration, duration.latest),
    "Week ending 2026-10-04: 30 min · Some workout durations were not recorded",
  );
});

test("volume sums real single and side measurements across workouts regardless of exercise selection", () => {
  const graph = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "volume",
    exerciseKey: sidesKey,
    sessions: [
      session({ sets: [single("10", "5"), { ...single("20", "3"), id: "set-2" }] }),
      session({ id: "sides", tracking: "sides", sets: [sides("7.5", "4", "10", "3")] }),
      session({ id: "planned", status: "planned" }),
      session({ id: "active", status: "active" }),
      session({ id: "future", date: "2026-10-05" }),
      session({ id: "old", date: "2026-09-06" }),
    ],
  });
  assert.equal(graph.tracking, "single");
  assert.deepEqual(graph.latest, {
    date: "2026-10-04",
    total: 170,
    left: null,
    right: null,
    workouts: 2,
    partialDuration: false,
  });
});

test("weekly totals sum recorded volume and duration across days, preserving empty weeks and zero", () => {
  const sessions = [
    session({ id: "first", date: "2026-09-01", sets: [single("10", "10")], durationSeconds: 6000 }),
    session({
      id: "second",
      date: "2026-09-04",
      sets: [single("50", "5")],
      durationSeconds: 15000,
    }),
    session({ id: "zero", date: "2026-09-21", sets: [single("", "12")], durationSeconds: 0 }),
  ];
  const graph = (metric: "volume" | "duration") =>
    workoutGraph({ today: "2026-09-21", weeks: 4, metric, sessions });
  assert.deepEqual(
    graph("volume").weeks.map((week) => [week.date, week.total, week.workouts]),
    [
      ["2026-08-31", null, 0],
      ["2026-09-07", 350, 2],
      ["2026-09-14", null, 0],
      ["2026-09-21", 0, 1],
    ],
  );
  assert.deepEqual(
    graph("duration").weeks.map((week) => week.total),
    [null, 350, null, 0],
  );
});

test("bodyweight workouts record zero volume and have no invented positive weight", () => {
  const sessions = [session({ sets: [single("", "12")] })];
  assert.equal(
    workoutGraph({ today: "2026-10-04", weeks: 4, metric: "volume", sessions }).latest.total,
    0,
  );
  assert.deepEqual(
    workoutGraph({
      today: "2026-10-04",
      weeks: 4,
      metric: "weight",
      exerciseKey: pressKey,
      sessions,
    }).latest,
    {
      date: "2026-10-04",
      total: null,
      left: null,
      right: null,
      workouts: 1,
      partialDuration: false,
    },
  );
});

test("selected single weight takes the weekly maximum and excludes other identities and tracking", () => {
  const sessions = [
    session({ sets: [single("10", "5"), { ...single("25", "1"), id: "set-2" }] }),
    session({ id: "another", date: "2026-10-01", sets: [single("20", "8")] }),
    session({ id: "other", exerciseId: "other", sets: [single("100", "8")] }),
    session({ id: "sides", tracking: "sides", sets: [sides("200", "5", "150", "5")] }),
  ];
  const graph = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "weight",
    exerciseKey: pressKey,
    sessions,
  });
  assert.equal(graph.unit, "kg");
  assert.equal(graph.tracking, "single");
  assert.deepEqual(graph.latest, {
    date: "2026-10-04",
    total: 25,
    left: null,
    right: null,
    workouts: 2,
    partialDuration: false,
  });
});

test("selected side weight keeps each side's weekly maximum and ignores kilograms without repetitions", () => {
  const graph = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "weight",
    exerciseKey: sidesKey,
    sessions: [
      session({ tracking: "sides", sets: [sides("12", "4", "999", "0")] }),
      session({
        id: "another",
        date: "2026-10-01",
        tracking: "sides",
        sets: [sides("25", "5", "18", "3")],
      }),
      session({
        id: "third",
        date: "2026-10-02",
        tracking: "sides",
        sets: [sides("15", "5", "30", "5")],
      }),
      session({
        id: "earlier",
        date: "2026-09-27",
        tracking: "sides",
        sets: [sides("", "", "20", "2")],
      }),
    ],
  });
  assert.equal(graph.tracking, "sides");
  assert.deepEqual(graph.latest, {
    date: "2026-10-04",
    total: 30,
    left: 25,
    right: 30,
    workouts: 3,
    partialDuration: false,
  });
  assert.deepEqual(graph.weeks.at(-2), {
    date: "2026-09-27",
    total: 20,
    left: null,
    right: 20,
    workouts: 1,
    partialDuration: false,
  });
});

test("duration totals known seconds in minutes and distinguishes unknown, partial, and known zero", () => {
  const graph = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "duration",
    exerciseKey: sidesKey,
    sessions: [
      session({ durationSeconds: 90 }),
      session({ id: "unknown", date: "2026-09-29" }),
      session({ id: "missing", date: "2026-09-22" }),
      session({ id: "zero", date: "2026-09-15", durationSeconds: 0 }),
      session({ id: "known", date: "2026-09-08", durationSeconds: 120 }),
    ],
  });
  assert.equal(graph.unit, "min");
  assert.equal(graph.tracking, "single");
  assert.deepEqual(graph.weeks, [
    { date: "2026-09-13", total: 2, left: null, right: null, workouts: 1, partialDuration: false },
    { date: "2026-09-20", total: 0, left: null, right: null, workouts: 1, partialDuration: false },
    {
      date: "2026-09-27",
      total: null,
      left: null,
      right: null,
      workouts: 1,
      partialDuration: true,
    },
    { date: "2026-10-04", total: 1.5, left: null, right: null, workouts: 2, partialDuration: true },
  ]);
});

test("duration sums recorded seconds before converting the weekly total to minutes", () => {
  const graph = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "duration",
    sessions: [
      session({ durationSeconds: 1 }),
      session({ id: "second", date: "2026-10-01", durationSeconds: 5 }),
    ],
  });
  assert.equal(graph.latest.total, 0.1);
});

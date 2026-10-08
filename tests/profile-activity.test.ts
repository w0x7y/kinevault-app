import assert from "node:assert/strict";
import test from "node:test";
import { parseFoodLog, type FoodLogDocument } from "../src/food/log-model.ts";
import { parseWaterLog } from "../src/water/model.ts";
import {
  parseWorkoutSession,
  type ExerciseSet,
  type WorkoutSession,
} from "../src/exercise/model.ts";
import { profileStreak, workoutExerciseOptions, workoutGraph } from "../src/profile/activity.ts";

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
      "2026-10-07",
      3,
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
      "2026-10-01",
      4,
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
    [
      "2024-03-01",
      5,
      [
        "2024-02-25",
        "2024-02-26",
        "2024-02-27",
        "2024-02-28",
        "2024-02-29",
        "2024-03-01",
        "2024-03-02",
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

test("longest streak includes earlier runs and local date arithmetic crosses leap, year, and DST boundaries", () => {
  for (const [today, days] of [
    ["2024-03-01", ["2024-02-28", "2024-02-29", "2024-03-01"]],
    ["2026-01-01", ["2025-12-30", "2025-12-31", "2026-01-01"]],
    ["2026-03-30", ["2026-03-28", "2026-03-29", "2026-03-30"]],
    ["2026-10-26", ["2026-10-24", "2026-10-25", "2026-10-26"]],
  ] satisfies [string, string[]][]) {
    const result = profileStreak({
      today,
      food: food(),
      water: water(Object.fromEntries(days.map((date) => [date, 1]))),
      sessions: [],
    });
    assert.equal(result.current, 3);
    assert.equal(result.longest, 3);
  }
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
  const options = workoutExerciseOptions(
    [
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
    "2026-10-04",
  );
  assert.deepEqual(options, [
    { key: JSON.stringify(["deleted", "single"]), name: "Deleted definition", tracking: "single" },
    { key: sidesKey, name: "Press", tracking: "sides" },
    { key: pressKey, name: "Renamed press", tracking: "single" },
  ]);
});

test("graph covers every day of each range and preserves empty days as null", () => {
  for (const [weeks, first, length] of [
    [4, "2026-09-07", 28],
    [12, "2026-07-13", 84],
    [52, "2025-10-06", 364],
  ] satisfies [4 | 12 | 52, string, number][]) {
    const graph = workoutGraph({ today: "2026-10-04", weeks, metric: "volume", sessions: [] });
    assert.equal(graph.points.length, length);
    assert.equal(graph.points[0]?.date, first);
    assert.deepEqual(graph.points.at(-1), {
      date: "2026-10-04",
      total: null,
      left: null,
      right: null,
      workouts: 0,
      partialDuration: false,
    });
    assert.equal(
      graph.points.every((point) => point.total === null),
      true,
    );
    assert.equal(graph.unit, "kg x reps");
    assert.equal(graph.tracking, "single");
  }
});

test("graph calendar dates stay consecutive across local DST and leap boundaries", () => {
  for (const [today, lastDays] of [
    ["2024-03-01", ["2024-02-28", "2024-02-29", "2024-03-01"]],
    ["2026-03-30", ["2026-03-28", "2026-03-29", "2026-03-30"]],
    ["2026-10-26", ["2026-10-24", "2026-10-25", "2026-10-26"]],
  ] satisfies [string, string[]][]) {
    assert.deepEqual(
      workoutGraph({ today, weeks: 4, metric: "volume", sessions: [] })
        .points.slice(-3)
        .map((point) => point.date),
      lastDays,
    );
  }
});

test("weight requires an existing exercise selection", () => {
  for (const exerciseKey of [undefined, JSON.stringify(["missing", "single"])]) {
    const graph = workoutGraph({
      today: "2026-10-04",
      weeks: 4,
      metric: "weight",
      exerciseKey,
      sessions: [session()],
    });
    assert.equal(graph.tracking, "single");
    assert.equal(
      graph.points.every((point) => point.total === null && point.workouts === 0),
      true,
    );
  }
});

test("daily volume sums real single and side measurements across workouts regardless of exercise selection", () => {
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
  assert.deepEqual(graph.points.at(-1), {
    date: "2026-10-04",
    total: 170,
    left: null,
    right: null,
    workouts: 2,
    partialDuration: false,
  });
});

test("bodyweight workouts record zero volume and have no invented positive weight", () => {
  const sessions = [session({ sets: [single("", "12")] })];
  assert.equal(
    workoutGraph({ today: "2026-10-04", weeks: 4, metric: "volume", sessions }).points.at(-1)
      ?.total,
    0,
  );
  assert.deepEqual(
    workoutGraph({
      today: "2026-10-04",
      weeks: 4,
      metric: "weight",
      exerciseKey: pressKey,
      sessions,
    }).points.at(-1),
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

test("selected single weight takes the daily maximum and excludes other identities and tracking", () => {
  const sessions = [
    session({ sets: [single("10", "5"), { ...single("25", "1"), id: "set-2" }] }),
    session({ id: "another", sets: [single("20", "8")] }),
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
  assert.deepEqual(graph.points.at(-1), {
    date: "2026-10-04",
    total: 25,
    left: null,
    right: null,
    workouts: 2,
    partialDuration: false,
  });
});

test("selected side weight preserves each side and ignores kilograms without repetitions", () => {
  const graph = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "weight",
    exerciseKey: sidesKey,
    sessions: [
      session({ tracking: "sides", sets: [sides("12", "4", "999", "0")] }),
      session({ id: "another", tracking: "sides", sets: [sides("10", "5", "18", "3")] }),
      session({
        id: "next",
        date: "2026-10-03",
        tracking: "sides",
        sets: [sides("", "", "20", "2")],
      }),
    ],
  });
  assert.equal(graph.tracking, "sides");
  assert.deepEqual(graph.points.at(-1), {
    date: "2026-10-04",
    total: 18,
    left: 12,
    right: 18,
    workouts: 2,
    partialDuration: false,
  });
  assert.deepEqual(graph.points.at(-2), {
    date: "2026-10-03",
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
      session({ id: "unknown" }),
      session({ id: "missing", date: "2026-10-03" }),
      session({ id: "zero", date: "2026-10-02", durationSeconds: 0 }),
      session({ id: "known", date: "2026-10-01", durationSeconds: 120 }),
    ],
  });
  assert.equal(graph.unit, "min");
  assert.equal(graph.tracking, "single");
  assert.deepEqual(graph.points.slice(-4), [
    { date: "2026-10-01", total: 2, left: null, right: null, workouts: 1, partialDuration: false },
    { date: "2026-10-02", total: 0, left: null, right: null, workouts: 1, partialDuration: false },
    {
      date: "2026-10-03",
      total: null,
      left: null,
      right: null,
      workouts: 1,
      partialDuration: true,
    },
    { date: "2026-10-04", total: 1.5, left: null, right: null, workouts: 2, partialDuration: true },
  ]);
});

test("duration sums recorded seconds before converting the daily total to minutes", () => {
  const graph = workoutGraph({
    today: "2026-10-04",
    weeks: 4,
    metric: "duration",
    sessions: [session({ durationSeconds: 1 }), session({ id: "second", durationSeconds: 5 })],
  });
  assert.equal(graph.points.at(-1)?.total, 0.1);
});

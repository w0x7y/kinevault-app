import assert from "node:assert/strict";
import test from "node:test";
import { interpretDayActivity } from "../src/daily/activity.ts";
import type { FoodEntry } from "../src/daily/model.ts";
import { emptyAnswers } from "../src/profile/answers.ts";
import { parseWaterGoal } from "../src/water/goal-model.ts";

const date = "2026-10-01";
const otherDate = "2026-09-30";
const drink: FoodEntry = {
  id: "drink",
  fdcId: 1,
  name: "Drink",
  meal: "drinks",
  measurement: "volume",
  drinkMl: 250,
  calories: 100,
  carbs: 20,
  protein: 3,
  fat: 1,
};
type Sources = Parameters<typeof interpretDayActivity>[0];
const readyFood = {
  kind: "ready",
  document: { version: 1, days: { [date]: [drink] } },
} satisfies Sources["food"];
const readyWater = {
  kind: "ready",
  document: { version: 1, days: { [date]: 500 } },
} satisfies Sources["water"];
const readyGoal = { kind: "ready", document: parseWaterGoal(null) } satisfies Sources["goal"];
const adult = {
  ...emptyAnswers,
  age: "30",
  height: "180",
  weight: "80",
  goal: "maintain" as const,
  activity: "moderate" as const,
  sex: "male" as const,
  eligible: true,
};
const readyProfile = {
  kind: "ready",
  document: { version: 1, kind: "complete", answers: adult },
} satisfies Sources["profile"];
const sources = {
  date,
  profile: readyProfile,
  food: readyFood,
  water: readyWater,
  goal: readyGoal,
};
test("known empty selected day has usable zero food, water and progress", () => {
  const activity = interpretDayActivity({ ...sources, date: otherDate });
  assert.equal(activity.food.kind, "ready");
  if (activity.food.kind !== "ready") return;
  assert.deepEqual(activity.food.day.foods, []);
  assert.equal(activity.food.day.date, otherDate);
  assert.equal(activity.food.summary.calories, 0);
  assert.deepEqual(activity.water.total, { kind: "ready", manualMl: 0, drinkMl: 0, ml: 0 });
  assert.equal(activity.water.progress, 0);
});

test("selection uses only matching food and water records and does not mutate sources", () => {
  const input = {
    ...sources,
    food: {
      kind: "ready",
      document: {
        version: 1,
        days: { [date]: [drink], [otherDate]: [{ ...drink, id: "other", drinkMl: 100 }] },
      },
    },
    water: { kind: "ready", document: { version: 1, days: { [date]: 500, [otherDate]: 200 } } },
  } satisfies Parameters<typeof interpretDayActivity>[0];
  const original = structuredClone(input);
  const first = interpretDayActivity(input);
  const previous = interpretDayActivity({ ...input, date: otherDate });
  assert.deepEqual(previous.water.total, { kind: "ready", manualMl: 200, drinkMl: 100, ml: 300 });
  assert.equal(previous.water.progress, 0.2);
  assert.equal(previous.date, otherDate);
  assert.equal(previous.food.kind, "ready");
  if (previous.food.kind === "ready") assert.equal(previous.food.day.foods[0].id, "other");
  assert.deepEqual(interpretDayActivity(input), first);
  assert.deepEqual(input, original);
});

test("only explicit Drinks volumes contribute, including legacy gram records with volume", () => {
  const legacy: FoodEntry = {
    id: "legacy",
    fdcId: 2,
    name: "Legacy",
    meal: "drinks",
    grams: 300,
    calories: 60,
    carbs: 10,
    protein: 2,
    fat: 1,
  };
  const foods: FoodEntry[] = [
    drink,
    legacy,
    { ...legacy, id: "explicit", drinkMl: 120 },
    { ...legacy, id: "snack", meal: "snacks", drinkMl: 900 },
  ];
  const activity = interpretDayActivity({
    ...sources,
    food: { kind: "ready", document: { version: 1, days: { [date]: foods } } },
  });
  assert.deepEqual(activity.water.total, { kind: "ready", manualMl: 500, drinkMl: 370, ml: 870 });
  assert.equal(activity.food.kind, "ready");
  if (activity.food.kind === "ready") assert.equal(activity.food.summary.calories, 280);
});

test("recovery publishes usable data only when both logs are known and goal only gates progress", () => {
  const failed = interpretDayActivity({
    ...sources,
    food: { kind: "error" },
    water: { kind: "error" },
    goal: { kind: "error" },
  });
  const foodRecovered = interpretDayActivity({
    ...sources,
    water: { kind: "error" },
    goal: { kind: "error" },
  });
  assert.equal(foodRecovered.food.kind, "ready");
  assert.deepEqual(foodRecovered.water.total, { kind: "error" });
  const retrying = interpretDayActivity({
    ...sources,
    water: { kind: "loading" },
    goal: { kind: "error" },
  });
  assert.deepEqual(retrying.water.total, { kind: "loading" });
  const logsRecovered = interpretDayActivity({ ...sources, goal: { kind: "loading" } });
  assert.deepEqual(logsRecovered.water.total, {
    kind: "ready",
    manualMl: 500,
    drinkMl: 250,
    ml: 750,
  });
  assert.equal(logsRecovered.water.progress, null);
  const recovered = interpretDayActivity(sources);
  assert.equal(recovered.water.progress, 0.5);
  assert.deepEqual(failed.water.total, { kind: "error" });
  assert.equal(failed.water.progress, null);
  assert.equal(failed.food.kind, "error");
  assert.deepEqual(failed.water.goal, { kind: "error" });
  assert.deepEqual(recovered.water.goal, { kind: "ready", ml: 1500 });
  // A failed log outranks one still loading.
  const mixed = interpretDayActivity({
    ...sources,
    food: { kind: "loading" },
    water: { kind: "error" },
  });
  assert.deepEqual(mixed.water.total, { kind: "error" });
});

test("exercise records aggregate only completed sessions on the selected date independently of food", () => {
  const definition = {
    id: "squat",
    name: "Squat",
    muscleGroup: "Legs",
    equipment: "Barbell",
    notes: "",
    tracking: "single" as const,
  };
  const session = {
    id: "morning",
    date,
    name: "Morning",
    status: "completed" as const,
    startedAt: null,
    durationSeconds: 600,
    exercises: [
      {
        id: "squat-row",
        exercise: definition,
        sets: [{ id: "set", kind: "single" as const, reps: "5", weightKg: "40" }],
      },
    ],
  };
  const exercise = {
    kind: "ready" as const,
    document: {
      version: 1 as const,
      exercises: [definition],
      workouts: [],
      sessions: [
        session,
        { ...session, id: "evening", name: "Evening" },
        { ...session, id: "planned", status: "planned" as const, durationSeconds: null },
        { ...session, id: "other-date", date: otherDate },
      ],
    },
  };
  const activity = interpretDayActivity({ ...sources, food: { kind: "error" }, exercise });
  assert.equal(activity.food.kind, "error");
  assert.equal(activity.workoutState, "ready");
  assert.equal(activity.workout.volume, 400);
  assert.equal(activity.workout.sets, 2);
  assert.equal(activity.workout.reps, 10);
  assert.equal(activity.workout.durationSeconds, 1200);
  assert.equal(activity.workout.exercises.length, 2);
  const past = interpretDayActivity({ ...sources, date: otherDate, exercise });
  assert.equal(past.workout.volume, 200);
});

for (const kind of ["loading", "error"] as const) {
  test(`unavailable exercise ${kind} keeps known nutrition and explicit workout source state`, () => {
    const activity = interpretDayActivity({ ...sources, exercise: { kind } });
    assert.equal(activity.food.kind, "ready");
    if (activity.food.kind === "ready") assert.equal(activity.food.summary.calories, 100);
    assert.equal(activity.workoutState, kind);
  });
}

test("ready empty exercise storage is distinct from failed storage", () => {
  const activity = interpretDayActivity({
    ...sources,
    exercise: {
      kind: "ready",
      document: { version: 1, exercises: [], workouts: [], sessions: [] },
    },
  });
  assert.equal(activity.workoutState, "ready");
  assert.equal(activity.workout.sets, 0);
  assert.equal(activity.workout.name, null);
});

test("targets follow the saved Profile and report its availability", () => {
  assert.deepEqual(interpretDayActivity(sources).targets, {
    kind: "ready",
    calories: 2760,
    carbs: 345,
    protein: 173,
    fat: 77,
  });
  for (const kind of ["loading", "error"] as const) {
    const activity = interpretDayActivity({ ...sources, profile: { kind } });
    assert.deepEqual(activity.targets, { kind });
    // Day records stay usable while the Profile is unavailable.
    assert.equal(activity.food.kind, "ready");
  }
});

test("the Active workout names its own day, with a fallback for a blank name", () => {
  const active = {
    id: "active",
    date,
    name: "Strength",
    status: "active" as const,
    startedAt: 1000000,
    durationSeconds: null,
    exercises: [],
  };
  const exercise = (...sessions: (typeof active)[]) => ({
    kind: "ready" as const,
    document: { version: 1 as const, exercises: [], workouts: [], sessions },
  });
  assert.equal(
    interpretDayActivity({ ...sources, exercise: exercise(active) }).activeWorkoutName,
    "Strength",
  );
  assert.equal(
    interpretDayActivity({ ...sources, exercise: exercise({ ...active, name: "" }) })
      .activeWorkoutName,
    "Active workout",
  );
  // It stays on its original date when another day is shown.
  assert.equal(
    interpretDayActivity({ ...sources, date: otherDate, exercise: exercise(active) })
      .activeWorkoutName,
    undefined,
  );
  assert.equal(
    interpretDayActivity({ ...sources, exercise: exercise() }).activeWorkoutName,
    undefined,
  );
  for (const kind of ["loading", "error"] as const)
    assert.equal(
      interpretDayActivity({ ...sources, exercise: { kind } }).activeWorkoutName,
      undefined,
    );
});

import assert from "node:assert/strict";
import test from "node:test";
import { interpretDayActivity } from "../src/daily/activity.ts";
import type { FoodEntry } from "../src/daily/model.ts";
import { emptyAnswers } from "../src/profile/answers.ts";
import type { PhoneStepsReading } from "../src/steps/summary.ts";
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
const noRetry = () => {};
/** A saved source as its provider reports it. */
const source = <State>(state: State, retryLoad = noRetry) => ({ state, retryLoad });
const readyFood = source({
  kind: "ready",
  document: { version: 1, days: { [date]: [drink] } },
} satisfies Sources["food"]["state"]);
const readyWater = source({
  kind: "ready",
  document: { version: 1, days: { [date]: 500 } },
} satisfies Sources["water"]["state"]);
const readyGoal = source({
  kind: "ready",
  document: parseWaterGoal(null),
} satisfies Sources["goal"]["state"]);
const phone = (patch: Partial<PhoneStepsReading> = {}): PhoneStepsReading => ({
  access: "unavailable",
  state: "loading",
  steps: null,
  retry: noRetry,
  connect: async () => {},
  openSettings: async () => {},
  ...patch,
});
const noExercise = { version: 1 as const, exercises: [], workouts: [], sessions: [] };
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
const sources: Sources = {
  date,
  profile: readyProfile,
  food: readyFood,
  water: readyWater,
  goal: readyGoal,
  exercise: source({ kind: "ready", document: noExercise } satisfies Sources["exercise"]["state"]),
  phoneSteps: phone(),
  loggedSteps: source({
    kind: "ready",
    document: { version: 1, days: {} },
  } satisfies Sources["loggedSteps"]["state"]),
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
  const input: Sources = {
    ...sources,
    food: source({
      kind: "ready",
      document: {
        version: 1,
        days: { [date]: [drink], [otherDate]: [{ ...drink, id: "other", drinkMl: 100 }] },
      },
    }),
    water: source({
      kind: "ready",
      document: { version: 1, days: { [date]: 500, [otherDate]: 200 } },
    }),
  };
  const original = structuredClone({ food: input.food.state, water: input.water.state });
  const first = interpretDayActivity(input);
  const previous = interpretDayActivity({ ...input, date: otherDate });
  assert.deepEqual(previous.water.total, { kind: "ready", manualMl: 200, drinkMl: 100, ml: 300 });
  assert.equal(previous.water.progress, 0.2);
  assert.equal(previous.date, otherDate);
  assert.equal(previous.food.kind, "ready");
  if (previous.food.kind === "ready") assert.equal(previous.food.day.foods[0].id, "other");
  const again = interpretDayActivity(input);
  assert.deepEqual(
    [again.food, again.water, again.workout],
    [first.food, first.water, first.workout],
  );
  assert.deepEqual({ food: input.food.state, water: input.water.state }, original);
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
    food: source({ kind: "ready", document: { version: 1, days: { [date]: foods } } }),
  });
  assert.deepEqual(activity.water.total, { kind: "ready", manualMl: 500, drinkMl: 370, ml: 870 });
  assert.equal(activity.food.kind, "ready");
  if (activity.food.kind === "ready") assert.equal(activity.food.summary.calories, 280);
});

test("recovery publishes usable data only when both logs are known and goal only gates progress", () => {
  const failed = interpretDayActivity({
    ...sources,
    food: source({ kind: "error" }),
    water: source({ kind: "error" }),
    goal: source({ kind: "error" }),
  });
  const foodRecovered = interpretDayActivity({
    ...sources,
    water: source({ kind: "error" }),
    goal: source({ kind: "error" }),
  });
  assert.equal(foodRecovered.food.kind, "ready");
  assert.deepEqual(foodRecovered.water.total, { kind: "error" });
  const retrying = interpretDayActivity({
    ...sources,
    water: source({ kind: "loading" }),
    goal: source({ kind: "error" }),
  });
  assert.deepEqual(retrying.water.total, { kind: "loading" });
  const logsRecovered = interpretDayActivity({ ...sources, goal: source({ kind: "loading" }) });
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
    food: source({ kind: "loading" }),
    water: source({ kind: "error" }),
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
  const exercise = source({
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
  });
  const activity = interpretDayActivity({ ...sources, food: source({ kind: "error" }), exercise });
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
    const activity = interpretDayActivity({ ...sources, exercise: source({ kind }) });
    assert.equal(activity.food.kind, "ready");
    if (activity.food.kind === "ready") assert.equal(activity.food.summary.calories, 100);
    assert.equal(activity.workoutState, kind);
  });
}

test("ready empty exercise storage is distinct from failed storage", () => {
  const activity = interpretDayActivity({
    ...sources,
    exercise: source({ kind: "ready", document: noExercise }),
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
  const exercise = (...sessions: (typeof active)[]) =>
    source({ kind: "ready" as const, document: { ...noExercise, sessions } });
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
      interpretDayActivity({ ...sources, exercise: source({ kind }) }).activeWorkoutName,
      undefined,
    );
});

test("each saved source reports its own availability and retries only itself", () => {
  const retried: string[] = [];
  const failing = <Name extends "food" | "water" | "goal" | "exercise" | "loggedSteps">(
    name: Name,
  ) => source({ kind: "error" as const }, () => retried.push(name));
  const activity = interpretDayActivity({
    ...sources,
    food: failing("food"),
    water: source({ kind: "loading" as const }, () => retried.push("water")),
    goal: failing("goal"),
    exercise: failing("exercise"),
    loggedSteps: failing("loggedSteps"),
  });
  const { food, water, waterGoal, workouts, loggedSteps } = activity.sources;
  assert.deepEqual(
    [food.kind, water.kind, waterGoal.kind, workouts.kind, loggedSteps.kind],
    ["error", "loading", "error", "error", "error"],
  );
  for (const each of [workouts, waterGoal, food, loggedSteps, water]) each.retry();
  assert.deepEqual(retried, ["exercise", "goal", "food", "loggedSteps", "water"]);
  const ready = interpretDayActivity(sources).sources;
  assert.ok(Object.values(ready).every((each) => each.kind === "ready"));
});

test("the Water tile says what is missing and where to retry it", () => {
  const ready = interpretDayActivity(sources).water.tile;
  assert.deepEqual(ready, {
    value: (0.75).toLocaleString(),
    status: null,
    progress: "50% of goal",
    captions: [`Goal: ${(1500).toLocaleString()} ml`, "Includes Drinks"],
    label: `Add water. 750 ml consumed of a ${(1500).toLocaleString()} ml daily goal. 50% of goal.`,
  });

  const goalFailed = interpretDayActivity({ ...sources, goal: source({ kind: "error" }) }).water
    .tile;
  assert.equal(goalFailed.progress, "Goal progress unavailable");
  assert.deepEqual(goalFailed.captions, [
    "Goal unavailable",
    "Retry in Settings",
    "Includes Drinks",
  ]);
  assert.equal(
    goalFailed.label,
    "Add water. 750 ml consumed. Daily goal unavailable. Progress unavailable. Retry water goal in Settings.",
  );
  const goalLoading = interpretDayActivity({ ...sources, goal: source({ kind: "loading" }) }).water
    .tile;
  assert.deepEqual(goalLoading.captions, ["Goal loading...", "Includes Drinks"]);
  assert.equal(
    goalLoading.label,
    "Add water. 750 ml consumed. Daily goal loading. Progress unavailable.",
  );

  const logFailed = interpretDayActivity({ ...sources, water: source({ kind: "error" }) }).water
    .tile;
  assert.equal(logFailed.value, null);
  assert.equal(logFailed.status, "tap to retry");
  assert.equal(
    logFailed.label,
    `Add water. Water total unavailable. Daily goal: ${(1500).toLocaleString()} ml. Progress unavailable.`,
  );
  const logLoading = interpretDayActivity({ ...sources, water: source({ kind: "loading" }) }).water
    .tile;
  assert.equal(logLoading.status, "loading...");
});

test("the Steps tile adds logged steps to the phone's and says where the figure comes from", () => {
  const tile = (patch: Partial<PhoneStepsReading>, logged: number | null) => {
    const { value: total, captions } = interpretDayActivity({
      ...sources,
      phoneSteps: phone({ access: "granted", state: "ready", steps: 4000, ...patch }),
      loggedSteps:
        logged === null
          ? source({ kind: "loading" })
          : source({ kind: "ready", document: { version: 1, days: { [date]: logged } } }),
    }).steps.tile;
    return { total, captions };
  };
  assert.deepEqual(tile({}, 0), { total: 4000, captions: ["From your phone"] });
  assert.deepEqual(tile({}, 1500), {
    total: 5500,
    captions: ["From your phone", `Includes ${(1500).toLocaleString()} logged`],
  });
  assert.deepEqual(tile({ access: null, steps: null, state: "loading" }, 0), {
    total: null,
    captions: ["loading..."],
  });
  assert.deepEqual(tile({ state: "loading", steps: null }, 200), {
    total: 200,
    captions: ["loading..."],
  });
  assert.deepEqual(tile({ state: "error", steps: null }, 0), {
    total: null,
    captions: ["Couldn't read phone steps"],
  });
  for (const access of ["undetermined", "denied", "install"] as const)
    assert.deepEqual(tile({ access, steps: null }, 0), {
      total: null,
      captions: ["Not connected"],
    });
  assert.deepEqual(tile({ access: "unavailable", steps: null }, 0), {
    total: null,
    captions: ["Tap to log steps"],
  });
  assert.deepEqual(tile({ access: "unavailable", steps: null }, 1500), {
    total: 1500,
    captions: ["Logged manually"],
  });
  // Logged steps that can't be read add nothing.
  assert.deepEqual(tile({}, null), { total: 4000, captions: ["From your phone"] });
  const reading = phone({ access: "granted", state: "ready", steps: 4000 });
  const activity = interpretDayActivity({ ...sources, phoneSteps: reading });
  assert.match(activity.steps.tile.label, /^Log steps\. .+ steps for .+\. From your phone\.$/);
  assert.equal(activity.steps.phone, reading, "the editor gets the same reading to connect");
});

test("the journal streak waits for food, water and workouts and is counted once", () => {
  for (const missing of ["food", "water", "exercise"] as const)
    assert.equal(
      interpretDayActivity({ ...sources, [missing]: source({ kind: "error" }) }).streak(),
      null,
    );
  const activity = interpretDayActivity(sources);
  const streak = activity.streak();
  assert.equal(streak?.current, 1);
  assert.equal(activity.streak(), streak);
});

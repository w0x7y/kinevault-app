import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { interpretDayActivity } from "../src/daily/activity.ts";
import type { FoodEntry } from "../src/daily/model.ts";
import type { CatalogFood } from "../src/food/catalog.ts";
import { entryForFood } from "../src/food/log-model.ts";
import type { WorkoutSession } from "../src/exercise/model.ts";
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
  today: date,
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
  assert.equal(activity.workout.kind, "done");
  if (activity.workout.kind !== "done") return;
  assert.equal(activity.workout.lifted, "400");
  assert.deepEqual(activity.workout.stats, [
    { label: "Duration", value: "20 min" },
    { label: "Sets", value: "2" },
    { label: "Reps", value: "10" },
  ]);
  assert.equal(activity.workout.detail, "2 exercises · 5 reps per set on average");
  const past = interpretDayActivity({ ...sources, date: otherDate, exercise }).workout;
  assert.deepEqual(past.kind === "done" && [past.lifted, past.detail], [
    "200",
    "1 exercise · 5 reps per set on average",
  ]);
});

for (const kind of ["loading", "error"] as const) {
  test(`unavailable exercise ${kind} keeps known nutrition and explicit workout source state`, () => {
    const activity = interpretDayActivity({ ...sources, exercise: source({ kind }) });
    assert.equal(activity.food.kind, "ready");
    if (activity.food.kind === "ready") assert.equal(activity.food.summary.calories, 100);
    assert.equal(activity.workout.kind, kind);
  });
}

test("ready empty exercise storage is distinct from failed storage", () => {
  const activity = interpretDayActivity({
    ...sources,
    exercise: source({ kind: "ready", document: noExercise }),
  });
  assert.equal(activity.workout.kind, "empty");
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
  const live = (tile: ReturnType<typeof interpretDayActivity>["workout"]) =>
    tile.kind === "live" ? tile.name : tile.kind;
  assert.equal(
    live(interpretDayActivity({ ...sources, exercise: exercise(active) }).workout),
    "Strength",
  );
  assert.equal(
    live(interpretDayActivity({ ...sources, exercise: exercise({ ...active, name: "" }) }).workout),
    "Active workout",
  );
  // It stays on its original date when another day is shown.
  assert.equal(
    live(interpretDayActivity({ ...sources, date: otherDate, exercise: exercise(active) }).workout),
    "empty",
  );
  assert.equal(live(interpretDayActivity({ ...sources, exercise: exercise() }).workout), "empty");
  for (const kind of ["loading", "error"] as const)
    assert.equal(
      live(interpretDayActivity({ ...sources, exercise: source({ kind }) }).workout),
      kind,
    );
});

test("the Workout tile covers every state, with one minutes rule for the title and the card", () => {
  const definition = {
    id: "squat",
    name: "Squat",
    muscleGroup: "Legs",
    equipment: "Barbell",
    notes: "",
    tracking: "single" as const,
  };
  const set = (weightKg: string) => ({ id: "set", kind: "single" as const, reps: "5", weightKg });
  const completed = {
    id: "morning",
    date,
    name: "Morning",
    status: "completed" as const,
    startedAt: null,
    // 29m40s: the title and the card both show 30 min.
    durationSeconds: 1780,
    exercises: [{ id: "row", exercise: definition, sets: [set("40")] }],
  };
  const running = {
    ...completed,
    id: "running",
    name: "Strength",
    status: "active" as const,
    startedAt: 1000000,
    durationSeconds: null,
    exercises: [],
  };
  const retried: string[] = [];
  const tile = (sessions: WorkoutSession[], patch: Partial<Sources> = {}) =>
    interpretDayActivity({
      ...sources,
      exercise: source({ kind: "ready" as const, document: { ...noExercise, sessions } }),
      ...patch,
    }).workout;
  const stats = (duration: string, sets = 1, reps = 5) => [
    { label: "Duration", value: duration },
    { label: "Sets", value: String(sets) },
    { label: "Reps", value: String(reps) },
  ];

  for (const kind of ["loading", "error"] as const) {
    const unavailable = tile([], { exercise: source({ kind }, () => retried.push(kind)) });
    assert.deepEqual(
      { ...unavailable, retry: undefined },
      { kind, summary: null, retry: undefined },
    );
    unavailable.retry();
  }
  assert.deepEqual(retried, ["loading", "error"]);

  assert.deepEqual(tile([]), {
    kind: "empty",
    retry: noRetry,
    summary: "No workouts yet",
    message: "Nothing logged yet today.",
  });
  // Another Selected day doesn't say "today".
  const past = tile([], { date: otherDate });
  assert.equal(past.kind === "empty" && past.message, "No workouts logged.");
  assert.equal(past.summary, "No workouts logged");

  assert.deepEqual(tile([running]), {
    kind: "live",
    retry: noRetry,
    summary: "No workouts yet",
    name: "Strength",
  });

  assert.deepEqual(tile([completed]), {
    kind: "done",
    retry: noRetry,
    summary: "200 kg · 30 min",
    name: "Morning",
    status: "Done",
    lifted: "200",
    detail: "1 exercise · 5 reps per set on average",
    exercises: [
      {
        id: JSON.stringify(["morning", "row"]),
        name: "Squat",
        counts: ["1 set", "5 reps"],
        amount: "40 kg",
        amountLabel: "weight 40 kg",
      },
    ],
    stats: stats("30 min"),
  });
  // A timed exercise counts its sets and shows its total time instead of reps and weight.
  const stretch = { ...definition, id: "stretch", name: "Stretch", tracking: "time" as const };
  const timed = tile([
    {
      ...completed,
      exercises: [
        {
          id: "row",
          exercise: stretch,
          sets: [
            { id: "a", kind: "time" as const, seconds: "45" },
            { id: "b", kind: "time" as const, seconds: "30" },
          ],
        },
      ],
    },
  ]);
  assert.deepEqual(timed.kind === "done" && timed.exercises[0], {
    id: JSON.stringify(["morning", "row"]),
    name: "Stretch",
    counts: ["2 sets"],
    amount: "1:15",
    amountLabel: "time 1:15",
  });
  // A Timed-only day has no reps to average.
  assert.equal(timed.kind === "done" && timed.detail, "1 exercise");
  // The card's total rounds like the summary line.
  const fractional = tile([
    { ...completed, exercises: [{ ...completed.exercises[0], sets: [set("12.5")] }] },
  ]);
  assert.equal(fractional.summary, "63 kg · 30 min");
  assert.equal(fractional.kind === "done" && fractional.lifted, "63");
  const doneWhileLive = tile([completed, running]);
  assert.equal(doneWhileLive.kind === "done" && doneWhileLive.status, "Live");

  // Bodyweight sets count sets instead of kilograms; an unknown duration is left out.
  const bodyweight = tile([
    {
      ...completed,
      durationSeconds: null,
      exercises: [{ ...completed.exercises[0], sets: [set("0")] }],
    },
  ]);
  assert.equal(bodyweight.summary, "1 set");
  assert.deepEqual(bodyweight.kind === "done" && bodyweight.stats, stats("Not recorded"));
  const twoSets = tile([
    {
      ...completed,
      durationSeconds: 0,
      exercises: [{ ...completed.exercises[0], sets: [set("0"), { ...set("0"), id: "second" }] }],
    },
  ]);
  assert.equal(twoSets.summary, "2 sets");
  assert.deepEqual(twoSets.kind === "done" && twoSets.stats, stats("0 min", 2, 10));
  assert.equal(tile([{ ...completed, durationSeconds: 3600 * 2 }]).summary, `200 kg · 120 min`);
});

test("each saved source reports its own availability and retries only itself", () => {
  const retried: string[] = [];
  const failing = <Name extends "food" | "water" | "goal" | "exercise">(name: Name) =>
    source({ kind: "error" as const }, () => retried.push(name));
  const activity = interpretDayActivity({
    ...sources,
    food: failing("food"),
    water: source({ kind: "loading" as const }, () => retried.push("water")),
    goal: failing("goal"),
    exercise: failing("exercise"),
  });
  const { food, water, waterGoal, workouts } = activity.sources;
  assert.deepEqual(
    [food.kind, water.kind, waterGoal.kind, workouts.kind],
    ["error", "loading", "error", "error"],
  );
  for (const each of [workouts, waterGoal, food, water]) each.retry();
  assert.deepEqual(retried, ["exercise", "goal", "food", "water"]);
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

test("accessibility labels read the rounded figures the screen shows", () => {
  const { foods }: { foods: CatalogFood[] } = JSON.parse(
    readFileSync(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"),
  );
  const banana = foods.find((food) => food.name === "Banana, raw");
  assert.ok(banana);
  const day = [10, 10].map((grams, index) =>
    entryForFood({ id: `banana-${index}`, food: banana, grams, meal: "lunch" }),
  );
  const activity = interpretDayActivity({
    ...sources,
    profile: { kind: "ready", document: { version: 1, kind: "complete", answers: emptyAnswers } },
    food: source({ kind: "ready", document: { version: 1, days: { [date]: day } } }),
  });
  // The raw sum is 19.400000000000002, which a label once read out in full.
  assert.ok(activity.food.kind === "ready" && !Number.isInteger(activity.food.summary.calories));
  const nutrition = activity.nutrition;
  assert.ok(nutrition);
  assert.equal(nutrition.calories.label, "19 kilocalories consumed, calorie goal unset");
  const carbs = Math.round(activity.food.summary.carbs * 10) / 10;
  assert.equal(nutrition.carbs.eaten, carbs);
  assert.equal(nutrition.carbs.label, `Carbs, ${carbs} grams consumed, target unset`);
  assert.equal(nutrition.carbs.value, carbs.toLocaleString());
  // The journal's Water row: 500 ml logged and none from Drinks, against the default goal.
  assert.deepEqual(
    { value: activity.water.value, ofTarget: activity.water.ofTarget, label: activity.water.label },
    {
      value: "500",
      ofTarget: `/ ${(1500).toLocaleString()} ml`,
      label: "500 milliliters consumed, water goal 1500 milliliters",
    },
  );

  // While the food log or water isn't loaded the journal still reads each target.
  const loading = interpretDayActivity({
    ...sources,
    food: source({ kind: "loading" }),
    goal: source({ kind: "error" }),
  });
  assert.deepEqual(loading.unavailableNutrition.calories, {
    value: "Unavailable",
    ofTarget: `/ ${(2760).toLocaleString()} kcal`,
    fraction: 0,
    label: "Calories consumed unavailable, calorie goal 2760 kilocalories",
  });
  assert.deepEqual(loading.unavailableNutrition.carbs, {
    value: "—",
    ofTarget: "/ 345 g",
    fraction: 0,
    label: "Carbs, consumed unavailable, target 345 grams",
  });
  assert.deepEqual(
    { value: loading.water.value, ofTarget: loading.water.ofTarget, label: loading.water.label },
    {
      value: "—",
      ofTarget: "/ — ml",
      label: "Water consumed unavailable, water goal unavailable",
    },
  );
  const unset = interpretDayActivity({
    ...sources,
    food: source({ kind: "loading" }),
    profile: { kind: "loading" },
  });
  assert.equal(unset.unavailableNutrition.fat.ofTarget, "/ — g");
  assert.equal(unset.unavailableNutrition.fat.label, "Fat, consumed unavailable, target unset");
});

test("nutrition progress counts what is left, how far over and each macro's share once", () => {
  const meal = (calories: number): FoodEntry => ({
    ...drink,
    id: `meal-${calories}`,
    meal: "lunch",
    measurement: "grams",
    grams: 100,
    drinkMl: undefined,
    calories,
  });
  const progress = (foods: FoodEntry[]) => {
    const { nutrition } = interpretDayActivity({
      ...sources,
      food: source({ kind: "ready", document: { version: 1, days: { [date]: foods } } }),
    });
    assert.ok(nutrition);
    return nutrition;
  };
  // The adult fixture's goal is 2,760 kcal with 345 g carbs.
  const under = progress([meal(1379.6)]);
  assert.deepEqual(
    { ...under.calories, segments: undefined, label: undefined },
    {
      eaten: 1380,
      target: 2760,
      fraction: 1379.6 / 2760,
      percentage: 50,
      remaining: 1380,
      overFraction: 0,
      segments: undefined,
      label: undefined,
      value: (1380).toLocaleString(),
      ofTarget: `/ ${(2760).toLocaleString()} kcal`,
      figure: `${(1380).toLocaleString()} / ${(2760).toLocaleString()} kcal`,
      title: `${(1380).toLocaleString()} / ${(2760).toLocaleString()} kcal`,
      balance: { value: (1380).toLocaleString(), caption: "left" },
    },
  );
  assert.equal(under.carbs.figure, "20 / 345 g");
  assert.equal(under.carbs.ofTarget, "/ 345 g");
  assert.equal(under.calories.label, "1380 kilocalories consumed, calorie goal 2760 kilocalories");
  assert.equal(under.carbs.percentage, Math.round((20 / 345) * 100));
  const shares = under.calories.segments.reduce((sum, part) => sum + part.fraction, 0);
  assert.ok(Math.abs(shares - under.calories.fraction) < 1e-12);

  const over = progress([meal(3036)]).calories;
  assert.equal(over.remaining, -276);
  assert.equal(over.percentage, 100);
  assert.ok(Math.abs(over.overFraction - 0.1) < 1e-12);
  assert.deepEqual(over.balance, { value: "276", caption: "over" });
  assert.equal(over.title, `${(3036).toLocaleString()} / ${(2760).toLocaleString()} kcal`);

  const unavailable = interpretDayActivity({ ...sources, food: source({ kind: "loading" }) });
  assert.equal(unavailable.nutrition, null);
  const noTargets = interpretDayActivity({ ...sources, profile: { kind: "loading" } }).nutrition;
  assert.equal(noTargets?.calories.target, null);
  assert.equal(noTargets?.calories.remaining, null);
  // An unset target shows a dash; the Food title leaves it out and the ring shows what was eaten.
  assert.deepEqual(
    noTargets && {
      figure: noTargets.calories.figure,
      ofTarget: noTargets.calories.ofTarget,
      title: noTargets.calories.title,
      balance: noTargets.calories.balance,
      carbs: noTargets.carbs.figure,
    },
    {
      figure: "100 / — kcal",
      ofTarget: "/ — kcal",
      title: "100 kcal",
      balance: { value: "100", caption: "eaten" },
      carbs: "20 / — g",
    },
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseDefinition, ExerciseSet, WorkoutSession } from "../src/exercise/model.ts";
import { estimatedOneRepMax, personalRecords } from "../src/exercise/records.ts";
import { summarizeSessions } from "../src/exercise/summary.ts";

const squat: ExerciseDefinition = {
  id: "squat",
  name: "Squat",
  muscleGroup: "",
  equipment: "",
  notes: "",
  tracking: "single",
};
const lift = (reps: string, weightKg: string, id = `${reps}x${weightKg}`): ExerciseSet => ({
  id,
  kind: "single",
  reps,
  weightKg,
});
function workout(
  id: string,
  date: string,
  sets: ExerciseSet[],
  patch: Partial<WorkoutSession> = {},
  exercise = squat,
): WorkoutSession {
  return {
    id,
    date,
    name: "Strength",
    status: "completed",
    startedAt: null,
    durationSeconds: null,
    exercises: [{ id: `${id}-row`, exercise, sets }],
    ...patch,
  };
}
/** A day's records as [the workout whose row set it, the record]. */
function recordsOn(sessions: WorkoutSession[], date: string) {
  return [...personalRecords(sessions, date)].map(([row, record]) => [
    sessions.find((session) => session.exercises.includes(row))!.id,
    record,
  ]);
}

test("the estimated one-rep max is Epley's, and a single rep is its own weight", () => {
  assert.equal(estimatedOneRepMax({ reps: 1, weightKg: 100 }), 100);
  assert.equal(estimatedOneRepMax({ reps: 3, weightKg: 100 }).toFixed(6), "110.000000");
  assert.equal(estimatedOneRepMax({ reps: 30, weightKg: 50 }), 100);
});

test("a record beats every earlier workout's best lift; the first and a tie set none", () => {
  const first = workout("first", "2026-10-01", [lift("5", "100"), lift("8", "90")]);
  assert.deepEqual(recordsOn([first], "2026-10-01"), []);
  // 100 kg × 8 beats 100 kg × 5: more reps at the same weight count.
  const more = workout("more", "2026-10-03", [lift("8", "100"), lift("3", "100")]);
  assert.deepEqual(recordsOn([first, more], "2026-10-03"), [
    ["more", { reps: 8, weightKg: 100, oneRepMaxKg: 100 * (1 + 8 / 30) }],
  ]);
  const tie = workout("tie", "2026-10-05", [lift("8", "100")]);
  assert.deepEqual(recordsOn([first, more, tie], "2026-10-05"), []);
  // Later workouts and other days' records don't count for this day.
  assert.deepEqual(recordsOn([first, more, tie], "2026-10-01"), []);
  assert.deepEqual(recordsOn([first, more, tie], "2026-10-02"), [], "a day without a workout");
});

test("only Completed workouts on or before the day count, in date then document order", () => {
  const base = workout("base", "2026-10-01", [lift("5", "100")]);
  const planned = workout("planned", "2026-10-02", [lift("5", "200")], { status: "planned" });
  const later = workout("later", "2026-10-09", [lift("5", "300")]);
  const morning = workout("morning", "2026-10-02", [lift("5", "110")]);
  const evening = workout("evening", "2026-10-02", [lift("5", "120")]);
  // The evening log beats the morning one; both beat the earlier day. The later and planned don't.
  assert.deepEqual(
    recordsOn([later, morning, planned, evening, base], "2026-10-02").map(([id]) => id),
    ["morning", "evening"],
  );
  const lighterEvening = workout("evening", "2026-10-02", [lift("5", "105")]);
  assert.deepEqual(
    recordsOn([base, morning, lighterEvening], "2026-10-02").map(([id]) => id),
    ["morning"],
  );
});

test("bodyweight lifts set no record, and each Tracking mode keeps its own history", () => {
  const bodyweight = workout("bodyweight", "2026-10-01", [lift("10", "0")]);
  const moreReps = workout("more", "2026-10-02", [lift("20", "0")]);
  assert.deepEqual(recordsOn([bodyweight, moreReps], "2026-10-02"), []);
  const sides = { ...squat, tracking: "sides" as const };
  const sided = (id: string, date: string, left: string, right: string) =>
    workout(
      id,
      date,
      [
        {
          id: "set",
          kind: "sides",
          left: { reps: "5", weightKg: left },
          right: { reps: "5", weightKg: right },
        },
      ],
      {},
      sides,
    );
  const single = workout("single", "2026-10-01", [lift("5", "200")]);
  // The single-weight history doesn't count for the left/right one; the best side does.
  const firstSided = sided("left-right", "2026-10-01", "20", "22");
  const better = sided("better", "2026-10-02", "24", "18");
  assert.deepEqual(recordsOn([single, firstSided, better], "2026-10-02"), [
    ["better", { reps: 5, weightKg: 24, oneRepMaxKg: 24 * (1 + 5 / 30) }],
  ]);
});

test("the Exercise summary gives each row the record it set", () => {
  const first = workout("first", "2026-10-01", [lift("5", "100")]);
  const today = workout("today", "2026-10-02", [lift("5", "110")]);
  const summary = summarizeSessions([today], personalRecords([first, today], "2026-10-02"));
  assert.deepEqual(summary.exercises[0]!.record, {
    reps: 5,
    weightKg: 110,
    oneRepMaxKg: 110 * (1 + 5 / 30),
  });
  assert.equal(summarizeSessions([today]).exercises[0]!.record, null, "no records given");
});

test("warm-up and cardio sets never set or hold a record", () => {
  const warm = (reps: string, weightKg: string) =>
    ({ ...lift(reps, weightKg, `w${reps}x${weightKg}`), warmUp: true }) as ExerciseSet;
  const first = workout("first", "2026-10-01", [warm("5", "150"), lift("5", "100")]);
  // 110 kg beats the working 100 kg; the 150 kg warm-up never counted.
  const better = workout("better", "2026-10-02", [lift("5", "110")]);
  assert.deepEqual(recordsOn([first, better], "2026-10-02"), [
    ["better", { reps: 5, weightKg: 110, oneRepMaxKg: 110 * (1 + 5 / 30) }],
  ]);
  // A heavier warm-up alone sets nothing.
  const heavyWarmUp = workout("heavy", "2026-10-02", [warm("5", "200"), lift("5", "90")]);
  assert.deepEqual(recordsOn([first, heavyWarmUp], "2026-10-02"), []);
  const run = { ...squat, id: "run", tracking: "cardio" as const };
  const runs = (id: string, date: string, distanceMeters: string) =>
    workout(id, date, [{ id: "r", kind: "cardio", seconds: "1800", distanceMeters }], {}, run);
  assert.deepEqual(
    recordsOn([runs("a", "2026-10-01", "5000"), runs("b", "2026-10-02", "9000")], "2026-10-02"),
    [],
  );
});

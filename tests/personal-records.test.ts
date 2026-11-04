import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseDefinition, ExerciseSet, WorkoutSession } from "../src/exercise/model.ts";
import { estimatedOneRepMax, personalRecords } from "../src/exercise/records.ts";

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
const key = (session: string) => JSON.stringify([session, `${session}-row`]);

test("the estimated one-rep max is Epley's, and a single rep is its own weight", () => {
  assert.equal(estimatedOneRepMax({ reps: 1, weightKg: 100 }), 100);
  assert.equal(estimatedOneRepMax({ reps: 3, weightKg: 100 }).toFixed(6), "110.000000");
  assert.equal(estimatedOneRepMax({ reps: 30, weightKg: 50 }), 100);
});

test("a record beats every earlier workout's best lift; the first and a tie set none", () => {
  const first = workout("first", "2026-10-01", [lift("5", "100"), lift("8", "90")]);
  assert.deepEqual([...personalRecords([first], "2026-10-01")], []);
  // 100 kg × 8 beats 100 kg × 5: more reps at the same weight count.
  const more = workout("more", "2026-10-03", [lift("8", "100"), lift("3", "100")]);
  assert.deepEqual(
    [...personalRecords([first, more], "2026-10-03")],
    [[key("more"), { reps: 8, weightKg: 100, oneRepMaxKg: 100 * (1 + 8 / 30) }]],
  );
  const tie = workout("tie", "2026-10-05", [lift("8", "100")]);
  assert.deepEqual([...personalRecords([first, more, tie], "2026-10-05")], []);
  // Later workouts and other days' records don't count for this day.
  assert.deepEqual([...personalRecords([first, more, tie], "2026-10-01")], []);
});

test("only Completed workouts on or before the day count, in date then document order", () => {
  const base = workout("base", "2026-10-01", [lift("5", "100")]);
  const planned = workout("planned", "2026-10-02", [lift("5", "200")], { status: "planned" });
  const later = workout("later", "2026-10-09", [lift("5", "300")]);
  const morning = workout("morning", "2026-10-02", [lift("5", "110")]);
  const evening = workout("evening", "2026-10-02", [lift("5", "120")]);
  // The evening log beats the morning one; both beat the earlier day. The later and planned don't.
  assert.deepEqual(
    [...personalRecords([later, morning, planned, evening, base], "2026-10-02").keys()],
    [key("morning"), key("evening")],
  );
  const lighterEvening = workout("evening", "2026-10-02", [lift("5", "105")]);
  assert.deepEqual(
    [...personalRecords([base, morning, lighterEvening], "2026-10-02").keys()],
    [key("morning")],
  );
});

test("bodyweight lifts set no record, and each Tracking mode keeps its own history", () => {
  const bodyweight = workout("bodyweight", "2026-10-01", [lift("10", "0")]);
  const moreReps = workout("more", "2026-10-02", [lift("20", "0")]);
  assert.deepEqual([...personalRecords([bodyweight, moreReps], "2026-10-02")], []);
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
  assert.deepEqual(
    [...personalRecords([single, firstSided, better], "2026-10-02")],
    [[key("better"), { reps: 5, weightKg: 24, oneRepMaxKg: 24 * (1 + 5 / 30) }]],
  );
});

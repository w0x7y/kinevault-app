import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkoutSession, type SessionExercise } from "../src/exercise/model.ts";
import { summarizeSessions } from "../src/exercise/summary.ts";

function row(id: string, name: string, values: [number, number][]): SessionExercise {
  return {
    id,
    exercise: { id, name, muscleGroup: "", equipment: "", notes: "", tracking: "single" },
    sets: values.map(([weightKg, reps], index) => ({
      id: `set-${index}`,
      kind: "single",
      weightKg: String(weightKg),
      reps: String(reps),
    })),
  };
}
function session(name: string, durationSeconds: number | null, exercises: SessionExercise[]) {
  return parseWorkoutSession({
    id: "session",
    date: "2026-10-02",
    name,
    durationSeconds,
    exercises,
    status: "completed",
    startedAt: null,
  });
}
const occurrence = (id: string) => JSON.stringify(["session", id]);

test("completed workout totals and exercise rows describe the same saved sets", () => {
  const completed = session("Strength", 1800, [
    row("squat", "Squat", [
      [40, 10],
      [60, 8],
    ]),
    row("press", "Press", [[30, 12]]),
    row("empty", "Empty", []),
  ]);
  const planned = {
    ...completed,
    id: "planned",
    status: "planned" as const,
    exercises: [row("planned", "Planned row", [[100, 5]])],
  };
  const workout = summarizeSessions([completed, planned]);
  assert.deepEqual(workout, {
    name: "Strength",
    durationSeconds: 1800,
    durationKnown: true,
    volume: 1240,
    sets: 3,
    reps: 30,
    averageRepsPerSet: 10,
    exercises: [
      {
        id: occurrence("squat"),
        name: "Squat",
        volume: 880,
        sets: 2,
        reps: 18,
        load: { kind: "range", minKg: 40, maxKg: 60 },
      },
      {
        id: occurrence("press"),
        name: "Press",
        volume: 360,
        sets: 1,
        reps: 12,
        load: { kind: "weight", weightKg: 30 },
      },
    ],
  });
});

test("no saved session is empty and persisted completion requires a logged set", () => {
  assert.deepEqual(summarizeSessions([]), {
    name: null,
    durationSeconds: 0,
    durationKnown: true,
    volume: 0,
    sets: 0,
    reps: 0,
    averageRepsPerSet: 0,
    exercises: [],
  });
  assert.throws(() => session("Empty", 300, []), /Enter at least one set/);
});

test("mixed bodyweight and weighted loads preserve actual kilograms", () => {
  const workout = summarizeSessions([
    session("Pull-ups", 300, [
      row("pullup", "Pull-up", [
        [0, 8],
        [10, 6],
      ]),
    ]),
  ]);
  assert.equal(workout.volume, 60);
  assert.deepEqual(workout.exercises[0]!.load, { kind: "range", minKg: 0, maxKg: 10 });
});
test("workout average weights exercises by completed set count", () => {
  const workout = summarizeSessions([
    session("Mixed reps", 60, [
      row("one", "One set", [[10, 20]]),
      row("two", "Two sets", [
        [5, 6],
        [5, 6],
      ]),
    ]),
  ]);
  assert.equal(workout.averageRepsPerSet, 11);
  assert.equal(workout.sets, 3);
  assert.equal(workout.reps, 32);
});

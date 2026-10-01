import assert from "node:assert/strict";
import test from "node:test";
import { emptyDay, summarizeDay, type Workout } from "../src/daily/model.ts";

function completedWorkout(workout: Workout | null) {
  return summarizeDay({ ...emptyDay("2026-10-02"), workout }).workout;
}

test("completed workout totals and exercise rows describe the same completed sets", () => {
  const workout = completedWorkout({
    name: "Strength", durationSeconds: 1800, exercises: [
      { id: "squat", name: "Squat", sets: [
        { weightKg: 40, reps: 10, completed: true },
        { weightKg: 60, reps: 8, completed: true },
        { weightKg: 100, reps: 5, completed: false },
      ] },
      { id: "press", name: "Press", sets: [{ weightKg: 30, reps: 12, completed: true }] },
      { id: "planned", name: "Planned row", sets: [{ weightKg: 40, reps: 12, completed: false }] },
      { id: "empty", name: "Empty exercise", sets: [] },
    ],
  });
  assert.deepEqual(workout, {
    name: "Strength", durationSeconds: 1800, volume: 1240, sets: 3, reps: 30,
    averageRepsPerSet: 10,
    exercises: [
      { id: "squat", name: "Squat", volume: 880, sets: 2, reps: 18,
        load: { kind: "range", minKg: 40, maxKg: 60 } },
      { id: "press", name: "Press", volume: 360, sets: 1, reps: 12,
        load: { kind: "weight", weightKg: 30 } },
    ],
  });
});

test("no session and a logged empty session keep distinct names and duration", () => {
  assert.deepEqual(completedWorkout(null), {
    name: null, durationSeconds: 0, volume: 0, sets: 0, reps: 0,
    averageRepsPerSet: 0, exercises: [],
  });
  assert.deepEqual(completedWorkout({ name: "Empty", durationSeconds: 300, exercises: [] }), {
    name: "Empty", durationSeconds: 300, volume: 0, sets: 0, reps: 0,
    averageRepsPerSet: 0, exercises: [],
  });
});

test("a planned session has no completed exercises or average reps", () => {
  assert.deepEqual(completedWorkout({ name: "Planned", durationSeconds: 60, exercises: [
    { id: "planned", name: "Planned press", sets: [{ weightKg: 50, reps: 10, completed: false }] },
  ] }), {
    name: "Planned", durationSeconds: 60, volume: 0, sets: 0, reps: 0,
    averageRepsPerSet: 0, exercises: [],
  });
});

test("bodyweight completed sets count repetitions and round the workout average", () => {
  assert.deepEqual(completedWorkout({ name: "Push-ups", durationSeconds: 90, exercises: [
    { id: "pushup", name: "Push-up", sets: [
      { weightKg: 0, reps: 15, completed: true },
      { weightKg: 0, reps: 10, completed: true },
      { weightKg: 20, reps: 5, completed: false },
    ] },
  ] }), {
    name: "Push-ups", durationSeconds: 90, volume: 0, sets: 2, reps: 25,
    averageRepsPerSet: 13,
    exercises: [{ id: "pushup", name: "Push-up", volume: 0, sets: 2, reps: 25,
      load: { kind: "bodyweight" } }],
  });
});

test("mixed bodyweight and weighted loads preserve actual kilograms", () => {
  assert.deepEqual(completedWorkout({ name: "Pull-ups", durationSeconds: 300, exercises: [
    { id: "pullup", name: "Pull-up", sets: [
      { weightKg: 0, reps: 8, completed: true },
      { weightKg: 10, reps: 6, completed: true },
    ] },
  ] }), {
    name: "Pull-ups", durationSeconds: 300, volume: 60, sets: 2, reps: 14,
    averageRepsPerSet: 7,
    exercises: [{ id: "pullup", name: "Pull-up", volume: 60, sets: 2, reps: 14,
      load: { kind: "range", minKg: 0, maxKg: 10 } }],
  });
});

test("workout average weights exercises by completed set count", () => {
  const workout = completedWorkout({ name: "Mixed reps", durationSeconds: 60, exercises: [
    { id: "one", name: "One set", sets: [{ weightKg: 10, reps: 20, completed: true }] },
    { id: "two", name: "Two sets", sets: [
      { weightKg: 5, reps: 6, completed: true },
      { weightKg: 5, reps: 6, completed: true },
    ] },
  ] });
  assert.equal(workout.averageRepsPerSet, 11);
  assert.equal(workout.sets, 3);
  assert.equal(workout.reps, 32);
});

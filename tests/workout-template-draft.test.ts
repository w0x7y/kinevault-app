import assert from "node:assert/strict";
import test from "node:test";
import { createWorkoutTemplateDraft } from "../src/exercise/workout-template-draft.ts";
import type { ExerciseDefinition, WorkoutTemplate } from "../src/exercise/model.ts";

const squat: ExerciseDefinition = {
  id: "squat",
  name: "Squat",
  muscleGroup: "Legs",
  equipment: "Barbell",
  notes: "Retained notes",
  tracking: "single",
};
const curl: ExerciseDefinition = {
  id: "curl",
  name: "Curl",
  muscleGroup: "Arms",
  equipment: "Dumbbells",
  notes: "",
  tracking: "sides",
};
const press: ExerciseDefinition = {
  id: "press",
  name: "Press",
  muscleGroup: "Shoulders",
  equipment: "Barbell",
  notes: "",
  tracking: "single",
};
const legacy: WorkoutTemplate = { id: "strength", name: "Strength", exercises: [squat, curl] };

test("legacy omitted counts stay zero while previously unseen selected IDs default to three", () => {
  const draft = createWorkoutTemplateDraft(legacy).add(press);
  assert.deepEqual(
    draft.rows.map((row) => [row.exercise.id, row.rawCount]),
    [
      ["squat", "0"],
      ["curl", "0"],
      ["press", "3"],
    ],
  );
  assert.deepEqual(draft.prepare(), {
    kind: "ready",
    input: {
      id: "strength",
      name: "Strength",
      exerciseIds: ["squat", "curl", "press"],
      setCounts: { squat: 0, curl: 0, press: 3 },
    },
  });
});

test("explicit saved counts preserve zero and missing saved entries initialize to zero", () => {
  const draft = createWorkoutTemplateDraft({
    ...legacy,
    exercises: [squat, curl, press],
    setCounts: { squat: 0, curl: 7 },
  });
  assert.deepEqual(
    draft.rows.map((row) => row.rawCount),
    ["0", "7", "0"],
  );
});

test("removing and re-adding retains raw count text including invalid input", () => {
  for (const rawCount of ["07", " 8 ", "", "1e", "101"]) {
    const removed = createWorkoutTemplateDraft()
      .rename("Strength")
      .add(squat)
      .add(curl)
      .setCount("squat", rawCount)
      .remove("squat");
    assert.deepEqual(removed.prepare(), {
      kind: "ready",
      input: { name: "Strength", exerciseIds: ["curl"], setCounts: { curl: 3 } },
    });
    const restored = removed.add(squat);
    assert.equal(restored.rows[1]!.rawCount, rawCount);
    assert.deepEqual(
      restored.rows.map((row) => row.exercise.id),
      ["curl", "squat"],
    );
    assert.equal(restored.prepare().kind, ["07", " 8 "].includes(rawCount) ? "ready" : "invalid");
  }
});

test("invalid blank and oversize raw counts remain visible and prevent preparation", () => {
  const draft = createWorkoutTemplateDraft().rename("Strength").add(squat);
  for (const rawCount of ["", "   ", "-1", "2.5", "1e2", "abc", "101", "9".repeat(400)]) {
    const edited = draft.setCount("squat", rawCount);
    assert.equal(edited.rows[0]!.rawCount, rawCount);
    const preparation = edited.prepare();
    assert.equal(preparation.kind, "invalid");
    if (preparation.kind === "invalid") assert.match(preparation.message, /Squat/);
  }
});

test("whole counts accept zero and one hundred and prepare numbers without changing raw text", () => {
  const draft = createWorkoutTemplateDraft()
    .rename("  Strength  ")
    .add(squat)
    .add(curl)
    .setCount("squat", " 000 ")
    .setCount("curl", "100");
  assert.deepEqual(draft.prepare(), {
    kind: "ready",
    input: {
      name: "  Strength  ",
      exerciseIds: ["squat", "curl"],
      setCounts: { squat: 0, curl: 100 },
    },
  });
  assert.deepEqual(
    draft.rows.map((row) => row.rawCount),
    [" 000 ", "100"],
  );
});

test("duplicate additions keep the selected snapshot and entered count", () => {
  const draft = createWorkoutTemplateDraft()
    .rename("Strength")
    .add(squat)
    .setCount("squat", "8")
    .add({ ...squat, name: "Updated squat" });
  assert.equal(draft.rows.length, 1);
  assert.equal(draft.rows[0]!.exercise.name, "Squat");
  assert.equal(draft.rows[0]!.rawCount, "8");
});

test("moving rows preserves order snapshots and count identity", () => {
  const original = createWorkoutTemplateDraft(legacy)
    .add(press)
    .setCount("squat", "5")
    .setCount("curl", "1e");
  const moved = original.move(2, -1).move(0, 1);
  assert.deepEqual(
    moved.rows.map((row) => [row.exercise.id, row.rawCount]),
    [
      ["press", "3"],
      ["squat", "5"],
      ["curl", "1e"],
    ],
  );
  assert.deepEqual(
    original.rows.map((row) => row.exercise.id),
    ["squat", "curl", "press"],
  );
  const ready = moved.setCount("curl", "6").prepare();
  assert.deepEqual(ready, {
    kind: "ready",
    input: {
      id: "strength",
      name: "Strength",
      exerciseIds: ["press", "squat", "curl"],
      setCounts: { press: 3, squat: 5, curl: 6 },
    },
  });
});

test("moves at list edges leave every row intact", () => {
  const draft = createWorkoutTemplateDraft(legacy);
  for (const moved of [
    draft.move(0, -1),
    draft.move(1, 1),
    draft.move(-1, 1),
    draft.move(99, -1),
  ]) {
    assert.deepEqual(
      moved.rows.map((row) => row.exercise.id),
      ["squat", "curl"],
    );
  }
});

test("retained definitions survive source removal or mutation without library lookup", () => {
  const source = { ...squat };
  const incoming = { ...legacy, exercises: [source] };
  const draft = createWorkoutTemplateDraft(incoming).rename("Retained");
  source.name = "Changed";
  incoming.exercises.length = 0;
  assert.deepEqual(draft.rows[0]!.exercise, squat);
  assert.deepEqual(draft.prepare(), {
    kind: "ready",
    input: { id: "strength", name: "Retained", exerciseIds: ["squat"], setCounts: { squat: 0 } },
  });
  const addedSource = { ...curl };
  const added = draft.add(addedSource);
  addedSource.notes = "Changed";
  assert.equal(added.rows[1]!.exercise.notes, "");
});

test("readiness requires a valid name and at least one selected exercise", () => {
  assert.equal(createWorkoutTemplateDraft().prepare().kind, "invalid");
  assert.equal(createWorkoutTemplateDraft().rename("Strength").prepare().kind, "invalid");
  for (const name of ["", "   ", "x".repeat(401)]) {
    assert.equal(createWorkoutTemplateDraft().add(squat).rename(name).prepare().kind, "invalid");
  }
  assert.equal(
    createWorkoutTemplateDraft().add(squat).rename("x".repeat(400)).prepare().kind,
    "ready",
  );
});

test("preparation captures only current selection and stays detached from later edits", () => {
  const draft = createWorkoutTemplateDraft(legacy).remove("curl").setCount("squat", "5");
  const preparation = draft.prepare();
  const edited = draft.rename("Later").add(press).setCount("squat", "6");
  assert.deepEqual(preparation, {
    kind: "ready",
    input: { id: "strength", name: "Strength", exerciseIds: ["squat"], setCounts: { squat: 5 } },
  });
  assert.equal(edited.rows[0]!.rawCount, "6");
  if (preparation.kind !== "ready") throw new Error("Expected ready preparation");
  preparation.input.exerciseIds.length = 0;
  preparation.input.setCounts!.squat = 99;
  assert.deepEqual(draft.prepare(), {
    kind: "ready",
    input: { id: "strength", name: "Strength", exerciseIds: ["squat"], setCounts: { squat: 5 } },
  });
});

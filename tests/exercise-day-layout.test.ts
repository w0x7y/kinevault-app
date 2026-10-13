import assert from "node:assert/strict";
import test from "node:test";
import { exerciseDayLayout } from "../src/exercise/day-layout.ts";
import type { ExerciseDocument, WorkoutSession } from "../src/exercise/model.ts";
import type { WorkoutPanel } from "../src/exercise/workout-editing.ts";

const day = "2026-10-04";
function session(
  id: string,
  status: WorkoutSession["status"],
  date = day,
  name = "Strength",
): WorkoutSession {
  return {
    id,
    name,
    date,
    status,
    startedAt: status === "active" ? 1000000 : null,
    durationSeconds: status === "completed" ? 120 : null,
    exercises: [],
  };
}
function documentWith(...sessions: WorkoutSession[]): ExerciseDocument {
  return { version: 1, exercises: [], workouts: [], sessions };
}
function layout(input: Partial<Parameters<typeof exerciseDayLayout>[0]> = {}) {
  return exerciseDayLayout({
    document: documentWith(),
    date: day,
    panel: null,
    query: "",
    workoutState: "ready",
    workoutName: null,
    ...input,
  });
}
const libraryPanel: WorkoutPanel = { content: { kind: "library", date: day }, token: 1 };

test("an empty default view shows the Add workout fallback and Import", () => {
  assert.deepEqual(layout(), {
    panel: null,
    search: null,
    workspace: null,
    plannedCards: [],
    showDailyWorkout: true,
    showImport: true,
    editingSession: null,
  });
});

test("an Active workout from another date still expands on the default view", () => {
  const active = session("active", "active", "2026-10-03");
  const plan = layout({ document: documentWith(active, session("draft", "planned")) });
  assert.equal(plan.workspace, active);
  assert.deepEqual(plan.plannedCards, []);
  assert.equal(plan.showDailyWorkout, false);
  assert.equal(plan.showImport, true);
});

test("the Active workout stays expanded while searching but not behind a panel", () => {
  const active = session("active", "active");
  assert.equal(layout({ document: documentWith(active), query: "squat" }).workspace, active);
  assert.equal(layout({ document: documentWith(active), panel: libraryPanel }).workspace, null);
});

test("Selected-day drafts show as compact cards on the default view only", () => {
  const draft = session("draft", "planned"),
    other = session("other", "planned", "2026-10-05");
  const document = documentWith(draft, other, session("done", "completed"));
  const plan = layout({ document });
  assert.deepEqual(plan.plannedCards, [draft]);
  // The Add workout fallback hides behind the cards.
  assert.equal(plan.showDailyWorkout, false);
  assert.deepEqual(layout({ document, query: " Squat " }).plannedCards, []);
  assert.deepEqual(layout({ document, panel: libraryPanel }).plannedCards, []);
});

test("a completed workout summary shows beside the Selected day's drafts", () => {
  const plan = layout({ document: documentWith(session("draft", "planned")), workoutName: "Legs" });
  assert.equal(plan.plannedCards.length, 1);
  assert.equal(plan.showDailyWorkout, true);
});

test("the daily workout fallback hides behind search and panels", () => {
  assert.equal(layout({ query: "squat" }).showDailyWorkout, false);
  assert.equal(layout({ panel: libraryPanel }).showDailyWorkout, false);
});

test("loading or failed workouts always show the daily workout card", () => {
  for (const workoutState of ["loading", "error"] as const) {
    const plan = layout({ document: null, workoutState, query: "squat", panel: libraryPanel });
    assert.equal(plan.showDailyWorkout, true);
    assert.equal(plan.panel, null);
    assert.equal(plan.search, null);
    assert.equal(plan.showImport, false);
  }
});

test("search text is normalized and shown only with a library", () => {
  assert.equal(layout({ query: "  Squat " }).search, "squat");
  assert.equal(layout({ query: "   " }).search, null);
  assert.equal(layout({ query: "   " }).showImport, true);
});

test("the Import button hides while searching or when any panel is open", () => {
  assert.equal(layout({ query: "squat" }).showImport, false);
  const panels: WorkoutPanel["content"][] = [
    { kind: "exercise" },
    { kind: "workout" },
    { kind: "library", date: day },
    { kind: "session", id: "draft" },
    { kind: "import" },
  ];
  for (const content of panels) {
    const plan = layout({ panel: { content, token: 2 } });
    assert.equal(plan.showImport, false, content.kind);
    assert.equal(plan.panel?.content, content);
  }
});

test("a session panel resolves the workout log being edited", () => {
  const draft = session("draft", "planned");
  const panel: WorkoutPanel = { content: { kind: "session", id: "draft" }, token: 3 };
  assert.equal(layout({ document: documentWith(draft), panel }).editingSession, draft);
  assert.equal(layout({ panel }).editingSession, null);
  assert.equal(layout({ document: documentWith(draft), panel: libraryPanel }).editingSession, null);
});

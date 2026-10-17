import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseDocument, WorkoutSession } from "../src/exercise/model.ts";
import { exerciseTabView } from "../src/exercise/tab-view.ts";
import type { WorkoutPanel, WorkoutView } from "../src/exercise/workout-editing.ts";

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
function view(input: Partial<Parameters<typeof exerciseTabView>[0]> = {}) {
  return exerciseTabView({
    document: documentWith(),
    date: day,
    panel: null,
    query: "",
    workoutState: "ready",
    ...input,
  });
}
let token = 0;
const panel = (content: WorkoutView): WorkoutPanel => ({ content, token: ++token });
const libraryPanel = panel({ kind: "library", date: day });

test("an empty default view shows the Add workout fallback and Import", () => {
  assert.deepEqual(view(), {
    search: null,
    showDailyWorkout: true,
    plannedCards: [],
    inline: null,
    live: null,
    showImport: true,
    sheet: null,
  });
});

test("an Active workout from another date replaces the day's cards with its live card", () => {
  const active = session("active", "active", "2026-10-03");
  const tab = view({ document: documentWith(active, session("draft", "planned")) });
  assert.equal(tab.live, active);
  assert.equal(tab.inline, null);
  assert.deepEqual(tab.plannedCards, []);
  assert.equal(tab.showDailyWorkout, false);
  assert.equal(tab.showImport, false);
  assert.equal(tab.sheet, null);
});

test("the live card hides while searching and behind a sheet", () => {
  const active = session("active", "active");
  assert.equal(view({ document: documentWith(active), query: "squat" }).live, null);
  const behind = view({ document: documentWith(active), panel: libraryPanel });
  assert.equal(behind.live, null);
  assert.equal(behind.sheet?.testID, "workout-library");
});

test("Selected-day drafts show as compact cards on the default view only", () => {
  const draft = session("draft", "planned"),
    other = session("other", "planned", "2026-10-05");
  const document = documentWith(draft, other, session("done", "completed", "2026-10-05"));
  const tab = view({ document });
  assert.deepEqual(tab.plannedCards, [draft]);
  // The Add workout fallback hides behind the cards.
  assert.equal(tab.showDailyWorkout, false);
  assert.deepEqual(view({ document, query: " Squat " }).plannedCards, []);
  assert.deepEqual(view({ document, panel: libraryPanel }).plannedCards, []);
});

test("a completed workout summary shows beside the Selected day's drafts", () => {
  const tab = view({
    document: documentWith(session("draft", "planned"), session("done", "completed")),
  });
  assert.equal(tab.plannedCards.length, 1);
  assert.equal(tab.showDailyWorkout, true);
});

test("the daily workout card hides behind search and panels", () => {
  assert.equal(view({ query: "squat" }).showDailyWorkout, false);
});

test("loading or failed workouts always show the daily workout card and nothing else", () => {
  for (const workoutState of ["loading", "error"] as const) {
    const tab = view({ document: null, workoutState, query: "squat", panel: libraryPanel });
    assert.deepEqual(tab, {
      search: null,
      showDailyWorkout: true,
      plannedCards: [],
      inline: null,
      live: null,
      showImport: false,
      sheet: null,
    });
  }
});

test("search text is normalized and shown only with a library", () => {
  assert.equal(view({ query: "  Squat " }).search, "squat");
  assert.equal(view({ query: "   " }).search, null);
  assert.equal(view({ query: "   " }).showImport, true);
});

test("the Import button hides while searching or when any panel is open", () => {
  const draft = session("draft", "planned");
  assert.equal(view({ query: "squat" }).showImport, false);
  for (const content of [
    { kind: "library", date: day },
    { kind: "session", id: "draft" },
  ] satisfies WorkoutView[]) {
    const tab = view({ document: documentWith(draft), panel: panel(content) });
    assert.equal(tab.showImport, false, content.kind);
    assert.equal(tab.showDailyWorkout, false, content.kind);
  }
});

test("library pages slide up as sheets with their own titles and back buttons", () => {
  const exercise = { id: "squat", name: "Squat", muscleGroup: "", equipment: "", notes: "" };
  const pages: [WorkoutView, string, string, string][] = [
    [{ kind: "exercise" }, "Create exercise", "Cancel", "exercise-form"],
    [
      { kind: "exercise", exercise: { ...exercise, tracking: "single" } },
      "Edit exercise",
      "Cancel",
      "exercise-form",
    ],
    [{ kind: "workout" }, "Create workout", "Cancel", "workout-form"],
    [
      { kind: "workout", workout: { id: "t", name: "Legs", exercises: [] } },
      "Edit workout",
      "Cancel",
      "workout-form",
    ],
    [{ kind: "library", date: day }, "Saved workouts", "Close saved workouts", "workout-library"],
    [{ kind: "import", source: "tracked" }, "Import workouts", "Close import", "workout-import"],
  ];
  for (const [content, title, closeLabel, testID] of pages) {
    const open = panel(content);
    assert.deepEqual(view({ panel: open }).sheet, {
      panel: open,
      title,
      closeLabel,
      testID,
      log: null,
    });
  }
});

test("a panel keeps a compact card on the tab and opens every other log on a sheet", () => {
  const draft = session("draft", "planned"),
    active = session("active", "active"),
    done = session("done", "completed");
  const document = documentWith(draft, active, done);
  const compact = panel({ kind: "session", id: "draft" });
  assert.deepEqual(view({ document, panel: compact }), {
    search: null,
    showDailyWorkout: false,
    plannedCards: [],
    inline: { session: draft, mode: "compact", panel: compact, closeLabel: "Close workout" },
    live: null,
    showImport: false,
    sheet: null,
  });
  const live = panel({ kind: "session", id: "active" });
  const page = view({ document, panel: live });
  assert.equal(page.inline, null);
  assert.deepEqual(page.sheet, {
    panel: live,
    title: "Strength",
    closeLabel: "Back to Exercise",
    testID: "active-workout",
    log: { session: active, mode: "active" },
  });
  for (const [content, log, title] of [
    [
      { kind: "session", id: "draft", manual: true },
      { session: draft, mode: "manual" },
      "Log workout",
    ],
    [{ kind: "session", id: "done" }, { session: done, mode: "completed" }, "Logged workout"],
  ] as const) {
    const open = panel(content);
    const tab = view({ document, panel: open });
    assert.equal(tab.inline, null);
    assert.deepEqual(tab.sheet, {
      panel: open,
      title,
      closeLabel: "Cancel",
      testID: "session-editor",
      log,
    });
  }
});

test("a log the panel opened follows its status, whatever the Selected day", () => {
  // Starting from the manual page keeps the page up as the Active workout's.
  const started = session("draft", "active", "2026-10-03", "");
  const open = panel({ kind: "session", id: "draft", manual: true });
  const tab = view({ document: documentWith(started), panel: open });
  assert.equal(tab.inline, null);
  assert.equal(tab.sheet?.log?.mode, "active");
  assert.equal(tab.sheet?.title, "Workout");
  const elsewhere = session("other", "planned", "2026-10-05");
  const card = view({
    document: documentWith(elsewhere),
    panel: panel({ kind: "session", id: "other" }),
  });
  assert.equal(card.inline?.session, elsewhere);
});

test("a session page whose workout is gone says so behind a Close workout button", () => {
  const open = panel({ kind: "session", id: "missing" });
  assert.deepEqual(view({ panel: open }).sheet, {
    panel: open,
    title: "Workout",
    closeLabel: "Close workout",
    log: null,
  });
});

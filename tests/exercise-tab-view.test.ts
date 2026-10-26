import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseDocument, WorkoutSession } from "../src/exercise/model.ts";
import { createExercisePersistence, exerciseStorageKey } from "../src/exercise/persistence.ts";
import { createExerciseTabView, exerciseTabView } from "../src/exercise/tab-view.ts";
import type { ExerciseTabPage, WorkoutPanel, WorkoutView } from "../src/exercise/tab-view.ts";

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
    inline: { session: draft, panel: compact },
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

const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
async function owner(...sessions: WorkoutSession[]) {
  let raw = JSON.stringify(documentWith(...sessions));
  const store = createExercisePersistence({
    storage: {
      async getItem(key: string) {
        assert.equal(key, exerciseStorageKey);
        return raw;
      },
      async setItem(_key: string, value: string) {
        raw = value;
      },
    },
    createId: () => "unused",
    now: () => 1120000,
  });
  store.start();
  await tick();
  const tab = createExerciseTabView({ store, date: day, importSources: [] });
  tab.start();
  tab.setFocused(true);
  return tab;
}

test("a Saved workouts request opens that day's menu and ignores a malformed day", async () => {
  const tab = await owner();
  assert.equal(await tab.openWorkoutMenu("2026-02-30"), false);
  assert.equal(await tab.openWorkoutMenu("tomorrow"), false);
  assert.equal(tab.getSnapshot().panel, null);
  assert.equal(await tab.openWorkoutMenu("2026-10-03"), true);
  assert.deepEqual(tab.getSnapshot().panel?.content, { kind: "library", date: "2026-10-03" });
});

test("an import request keeps an import that is already open", async () => {
  const tab = await owner();
  assert.equal(await tab.openImport("tracked"), true);
  const open = tab.getSnapshot().panel;
  assert.deepEqual(open?.content, { kind: "import", source: "tracked" });
  assert.equal(await tab.openImport("tracked"), false);
  assert.equal(tab.getSnapshot().panel, open);
});

test("a live workout request opens only the Active workout's page, once", async () => {
  const tab = await owner(session("active", "active", "2026-10-03"), session("draft", "planned"));
  assert.equal(await tab.openLiveWorkout("draft"), false);
  assert.equal(await tab.openLiveWorkout("missing"), false);
  assert.equal(tab.getSnapshot().panel, null);
  assert.equal(await tab.openLiveWorkout("active"), true);
  const page = tab.getSnapshot().panel;
  assert.deepEqual(page?.content, { kind: "session", id: "active" });
  assert.equal(await tab.openLiveWorkout("active"), false);
  assert.equal(tab.getSnapshot().panel, page);
});

test("discarding the live workout marks the day's card to fade in until it hides", async () => {
  const tab = await owner(session("active", "active"));
  assert.equal(tab.getSnapshot().liveEnded, false);
  await tab.requestView({ kind: "session", id: "active" });
  const edit = tab.edits.edit("active");
  assert.equal(await edit.run("discard"), true);
  await tick();
  assert.equal(tab.getSnapshot().panel, null);
  assert.equal(tab.getSnapshot().showDailyWorkout, true);
  assert.equal(tab.getSnapshot().liveEnded, true);
  // An unrelated change keeps the mark while the card stays up.
  tab.setDay("2026-10-05");
  tab.setDay(day);
  assert.equal(tab.getSnapshot().liveEnded, true);
  // A card that comes back after hiding is simply there.
  tab.search("squat");
  assert.equal(tab.getSnapshot().liveEnded, false);
  tab.search("");
  assert.equal(tab.getSnapshot().showDailyWorkout, true);
  assert.equal(tab.getSnapshot().liveEnded, false);
});

test("a live workout covered by a panel, then discarded there, doesn't fade the card in", async () => {
  const tab = await owner(session("active", "active"));
  await tab.requestView({ kind: "library", date: day });
  assert.equal(
    await tab.drafts.savedWorkouts(tab.getSnapshot().panel!.token, day).removeLog("active"),
    true,
  );
  tab.closeView(tab.getSnapshot().panel!.token);
  assert.equal(tab.getSnapshot().showDailyWorkout, true);
  assert.equal(tab.getSnapshot().liveEnded, false);
});

test("a card on the tab from the start doesn't fade in", async () => {
  const tab = await owner(session("done", "completed"));
  assert.equal(tab.getSnapshot().showDailyWorkout, true);
  assert.equal(tab.getSnapshot().liveEnded, false);
});

test("away from the tab the sheet hides and its panel and query wait for the return", async () => {
  const tab = await owner();
  tab.search("Squat");
  await tab.requestView({ kind: "library", date: day });
  const open = tab.getSnapshot().panel;
  tab.setFocused(false);
  assert.equal(tab.getSnapshot().sheet, null);
  assert.equal(tab.getSnapshot().panel, open);
  tab.setFocused(true);
  assert.equal(tab.getSnapshot().sheet?.panel, open);
  assert.equal(tab.getSnapshot().query, "Squat");
});

/** The sheet's page, which must be of `kind`. */
function pageOf<Kind extends ExerciseTabPage["kind"]>(
  tab: Awaited<ReturnType<typeof owner>>,
  kind: Kind,
): Extract<ExerciseTabPage, { kind: Kind }> {
  const page = tab.getSnapshot().sheet?.page;
  assert.equal(page?.kind, kind);
  return page as Extract<ExerciseTabPage, { kind: Kind }>;
}

test("each sheet page carries the owner of its panel", async () => {
  const tab = await owner(session("draft", "planned"));
  assert.equal(tab.getSnapshot().loaded, true);
  const token = () => tab.getSnapshot().panel!.token;
  await tab.requestView({ kind: "exercise" });
  const exercise = pageOf(tab, "exercise");
  exercise.draft.change((values) => ({ ...values, name: "Squat" }));
  assert.equal(tab.drafts.exercise(token()).getSnapshot().values.name, "Squat");
  assert.equal(exercise.linkDemo, false);
  await tab.requestView({ kind: "workout" });
  pageOf(tab, "workout").draft.search("legs");
  assert.equal(tab.drafts.template(token()).getSnapshot().query, "legs");
  await tab.requestView({ kind: "library", date: "2026-10-03" });
  const library = pageOf(tab, "library");
  assert.equal(library.date, "2026-10-03");
  assert.equal(
    library.actions.getSnapshot(),
    tab.drafts.savedWorkouts(token(), "2026-10-03").getSnapshot(),
  );
  await tab.requestView({ kind: "import", source: "tracked" });
  assert.equal(pageOf(tab, "import").flow, tab.drafts.workoutImport(token(), "tracked"));
  await tab.requestView({ kind: "session", id: "draft", manual: true });
  assert.equal(pageOf(tab, "session").edit?.getSnapshot().mode, "manual");
  assert.equal(pageOf(tab, "session").edit?.getSnapshot(), tab.edits.edit("draft").getSnapshot());
  await tab.requestView({ kind: "session", id: "missing" });
  assert.equal(pageOf(tab, "session").edit, null);
});

test("Saved workouts opens on the Selected day", async () => {
  const tab = await owner();
  tab.setDay("2026-10-05");
  assert.equal(await tab.openLibrary(), true);
  assert.deepEqual(tab.getSnapshot().panel?.content, { kind: "library", date: "2026-10-05" });
});

test("a sheet's close leaves its own panel, never a newer one", async () => {
  const tab = await owner();
  await tab.requestView({ kind: "library", date: day });
  const { close } = tab.getSnapshot().sheet!;
  await tab.requestView({ kind: "exercise" });
  close();
  assert.equal(tab.getSnapshot().panel?.content.kind, "exercise");
  tab.getSnapshot().sheet!.close();
  assert.equal(tab.getSnapshot().panel, null);
});

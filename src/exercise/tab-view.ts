import type { ExerciseDocument, WorkoutSession } from "./model.ts";
import {
  workoutLogMode,
  type WorkoutLogMode,
  type WorkoutPanel,
  type WorkoutView,
} from "./workout-editing.ts";

/** A workout log shown on the tab itself rather than on a sheet. */
type InlineWorkoutLog = {
  session: WorkoutSession;
  mode: Extract<WorkoutLogMode, "compact" | "active">;
  /** The panel that opened the log in place; null for the Active workout on the default view. */
  panel: WorkoutPanel | null;
  /** Names the control that closes that panel. The Active workout ends instead of closing. */
  closeLabel: string | null;
};

/** The page that slides up over the tab for every other panel. */
type ExerciseTabSheet = {
  panel: WorkoutPanel;
  title: string;
  /** The back button's accessible name. */
  closeLabel: string;
  testID?: string;
  /** A session page's workout log; null when that workout is no longer available. */
  log: { session: WorkoutSession; mode: Extract<WorkoutLogMode, "manual" | "completed"> } | null;
};

type ExerciseTabView = {
  /** Normalized search text while searching the available library. */
  search: string | null;
  /** The daily workout card, whose "Add workout" fallback hides behind every other view. */
  showDailyWorkout: boolean;
  /** Selected-day drafts shown as compact cards on the default view. */
  plannedCards: readonly WorkoutSession[];
  inline: InlineWorkoutLog | null;
  showImport: boolean;
  sheet: ExerciseTabSheet | null;
};

/**
 * Where every Workout log and panel of the Exercise tab goes. The default view is the tab with
 * no panel open and no search; it shows the Selected day's drafts as compact cards, or the
 * Active workout, whatever its date, expanded in place. A panel that opens a compact card or the
 * Active workout keeps it on the tab; every other panel is a sheet over the tab.
 */
export function exerciseTabView({
  document,
  date,
  panel,
  query,
  workoutState,
}: {
  document: ExerciseDocument | null;
  date: string;
  panel: WorkoutPanel | null;
  query: string;
  workoutState: "ready" | "loading" | "error";
}): ExerciseTabView {
  const search = query.trim().toLocaleLowerCase();
  // Panels open only over an available library.
  const open = document ? panel : null;
  const defaultView = !open && !search;
  const sessions = document?.sessions ?? [];
  const content = open?.content;
  const opened =
    content?.kind === "session"
      ? (sessions.find((session) => session.id === content.id) ?? null)
      : null;
  // The edit owner preserves workspace fields across panel, search and calendar changes.
  const workspace = open ? null : (sessions.find((session) => session.status === "active") ?? null);
  const planned = sessions.filter(
    (session) => session.date === date && session.status === "planned",
  );
  const completed = sessions.some(
    (session) => session.date === date && session.status === "completed",
  );
  const showCards = defaultView && !workspace;
  let inline: InlineWorkoutLog | null = null,
    sheet: ExerciseTabSheet | null = null;
  if (open) {
    const mode = opened && workoutLogMode(opened, content);
    if (opened && (mode === "compact" || mode === "active"))
      inline = {
        session: opened,
        mode,
        panel: open,
        closeLabel: mode === "compact" ? "Close workout" : null,
      };
    else
      sheet = {
        panel: open,
        ...sheetPage(
          open.content,
          opened && (mode === "manual" || mode === "completed") ? { session: opened, mode } : null,
        ),
      };
  } else if (workspace)
    inline = { session: workspace, mode: "active", panel: null, closeLabel: null };
  return {
    search: document && search ? search : null,
    // A completed workout's summary shows beside the day's drafts; the empty fallback doesn't.
    showDailyWorkout:
      workoutState !== "ready" || (showCards && (planned.length === 0 || completed)),
    plannedCards: showCards ? planned : [],
    inline,
    showImport: Boolean(document) && defaultView,
    sheet,
  };
}

/** The sheet's title, back button name and test ID for a panel that opens over the tab. */
function sheetPage(
  content: WorkoutView,
  log: ExerciseTabSheet["log"],
): Omit<ExerciseTabSheet, "panel"> {
  switch (content.kind) {
    case "exercise":
      return {
        title: content.exercise ? "Edit exercise" : "Create exercise",
        closeLabel: "Cancel",
        testID: "exercise-form",
        log: null,
      };
    case "workout":
      return {
        title: content.workout ? "Edit workout" : "Create workout",
        closeLabel: "Cancel",
        testID: "workout-form",
        log: null,
      };
    case "library":
      return {
        title: "Saved workouts",
        closeLabel: "Close saved workouts",
        testID: "workout-library",
        log: null,
      };
    case "import":
      return {
        title: "Import workouts",
        closeLabel: "Close import",
        testID: "workout-import",
        log: null,
      };
    case "session":
      return log
        ? {
            title: log.mode === "completed" ? "Logged workout" : "Log workout",
            closeLabel: "Cancel",
            testID: "session-editor",
            log,
          }
        : { title: "Workout", closeLabel: "Close workout", log: null };
  }
}

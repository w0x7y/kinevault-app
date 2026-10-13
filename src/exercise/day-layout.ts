import type { ExerciseDocument, WorkoutSession } from "./model.ts";
import type { WorkoutPanel } from "./workout-editing.ts";

export type ExerciseDayLayout = {
  // The open panel, once the exercise library is available.
  panel: WorkoutPanel | null;
  // Normalized search text while searching the available library.
  search: string | null;
  // The Active workout, expanded whenever no panel is open, whatever the Selected day.
  workspace: WorkoutSession | null;
  // Selected-day drafts shown as compact cards on the default view.
  plannedCards: readonly WorkoutSession[];
  // The daily workout card, whose "Add workout" fallback hides behind every other view.
  showDailyWorkout: boolean;
  showImport: boolean;
  // The workout log open in a session panel; null once it is no longer available.
  editingSession: WorkoutSession | null;
};

// The default view is the Exercise screen with no panel open and no search.
// The edit owner preserves workspace fields across panel, search and calendar changes.
export function exerciseDayLayout({
  document,
  date,
  panel,
  query,
  workoutState,
  workoutName,
}: {
  document: ExerciseDocument | null;
  date: string;
  panel: WorkoutPanel | null;
  query: string;
  workoutState: "ready" | "loading" | "error";
  // The Selected day's completed workout name, if any.
  workoutName: string | null;
}): ExerciseDayLayout {
  const search = query.trim().toLocaleLowerCase();
  const defaultView = !panel && !search;
  const active = document?.sessions.find((session) => session.status === "active") ?? null;
  const workspace = panel ? null : active;
  const planned =
    document?.sessions.filter((session) => session.date === date && session.status === "planned") ??
    [];
  const showCards = defaultView && !workspace;
  const content = panel?.content;
  return {
    panel: document ? panel : null,
    search: document && search ? search : null,
    workspace,
    plannedCards: document && showCards ? planned : [],
    showDailyWorkout:
      workoutState !== "ready" || (showCards && (planned.length === 0 || workoutName !== null)),
    showImport: Boolean(document) && defaultView,
    editingSession:
      content?.kind === "session"
        ? (document?.sessions.find((session) => session.id === content.id) ?? null)
        : null,
  };
}

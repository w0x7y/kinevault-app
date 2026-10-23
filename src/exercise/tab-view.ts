import { parseDay } from "../calendar/dates.ts";
import type { WorkoutImportFlowSource } from "./import/import-flow.ts";
import { createLibraryDrafts, type LibraryDrafts } from "./library-drafts.ts";
import {
  activeWorkout,
  type ExerciseDefinition,
  type ExerciseDocument,
  type WorkoutSession,
  type WorkoutTemplate,
} from "./model.ts";
import type { createExercisePersistence } from "./persistence.ts";
import {
  createWorkoutEditing,
  workoutLogControls,
  workoutLogMode,
  type WorkoutEdit,
  type WorkoutLogMode,
} from "./workout-editing.ts";

export type WorkoutView =
  | {
      kind: "exercise";
      exercise?: ExerciseDefinition;
      /** Opened from "Link demo": focus the KineVault search. */
      linkDemo?: boolean;
      /** The workout to return to after Save or Cancel. */
      returnTo?: WorkoutView;
    }
  | { kind: "workout"; workout?: WorkoutTemplate }
  | { kind: "library"; date: string }
  | { kind: "session"; id: string; manual?: boolean }
  | { kind: "import"; source?: string };
export type WorkoutPanel = { content: WorkoutView; token: number };
/** The panel and request a Workout edit's action began on. */
type PanelOrigin = { readonly request: number; readonly attachment: number };
/**
 * The tab's panel seam. Workout edits and Library drafts read the open panel and, once their
 * durable work succeeds, leave or hand over the panel it began on, never a newer one.
 */
export type ExercisePanels = {
  panel(): WorkoutPanel | null;
  subscribe(listener: () => void): () => void;
  origin(): PanelOrigin;
  /** Replaces panel `token` (none: the default view) with `content` unless another view took over since `origin`. */
  leave(token: number | null, origin: PanelOrigin, content?: WorkoutView | null): void;
  /** Leaves panel `token` for the workout it returns to (after "Link demo"), or no panel. */
  closeView(token: number): void;
  /** Panel `token` hands over to `content`, e.g. Saved workouts opening the log it added. */
  replaceView(token: number, content: WorkoutView): void;
};
type Store = Parameters<typeof createWorkoutEditing>[0] &
  Parameters<typeof createLibraryDrafts>[0]["store"] &
  Pick<ReturnType<typeof createExercisePersistence>, "getSnapshot" | "subscribe">;

/** A compact workout card that a panel opened on the tab itself rather than on a sheet. */
type InlineWorkoutLog = {
  session: WorkoutSession;
  mode: Extract<WorkoutLogMode, "compact">;
  /** The panel that opened the card in place. */
  panel: WorkoutPanel;
};

/** The page that slides up over the tab for every other panel. */
type ExerciseTabSheet = {
  panel: WorkoutPanel;
  title: string;
  /** The back button's accessible name. */
  closeLabel: string;
  testID?: string;
  /** A session page's workout log; null when that workout is no longer available. */
  log: {
    session: WorkoutSession;
    mode: Extract<WorkoutLogMode, "active" | "manual" | "completed">;
  } | null;
};

type ExerciseTabProjection = {
  /** Normalized search text while searching the available library. */
  search: string | null;
  /** The daily workout card, whose "Add workout" fallback hides behind every other view. */
  showDailyWorkout: boolean;
  /** Selected-day drafts shown as compact cards on the default view. */
  plannedCards: readonly WorkoutSession[];
  inline: InlineWorkoutLog | null;
  /** The Active workout, shown as a card that opens its page, on the default view. */
  live: WorkoutSession | null;
  showImport: boolean;
  sheet: ExerciseTabSheet | null;
};

/**
 * The tab view's snapshot builder: where every Workout log and panel of the Exercise tab goes. The default view is the tab with
 * no panel open and no search; it shows the Selected day's drafts as compact cards, or a card for
 * the Active workout, whatever its date, that opens it. A panel that opens a compact card keeps it
 * on the tab; every other panel, the Active workout's included, is a sheet over the tab.
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
}): ExerciseTabProjection {
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
  // The edit owner preserves the Active workout's fields across panel, search and calendar changes.
  const workspace = open ? null : activeWorkout(sessions);
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
    if (opened && mode === "compact") inline = { session: opened, mode, panel: open };
    else
      sheet = {
        panel: open,
        ...sheetPage(
          open.content,
          opened && mode && mode !== "compact" ? { session: opened, mode } : null,
        ),
      };
  }
  return {
    search: document && search ? search : null,
    // A completed workout's summary shows beside the day's drafts; the empty fallback doesn't.
    showDailyWorkout:
      workoutState !== "ready" || (showCards && (planned.length === 0 || completed)),
    plannedCards: showCards ? planned : [],
    inline,
    live: defaultView ? workspace : null,
    showImport: Boolean(document) && showCards,
    sheet,
  };
}

/** A workout log's page over the tab; a null title shows the workout's name. */
const logSheets = {
  active: { title: null, testID: "active-workout" },
  manual: { title: "Log workout", testID: "session-editor" },
  completed: { title: "Logged workout", testID: "session-editor" },
} satisfies Record<
  NonNullable<ExerciseTabSheet["log"]>["mode"],
  { title: string | null; testID: string }
>;

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
    case "session": {
      if (!log) return { title: "Workout", closeLabel: "Close workout", log: null };
      const sheet = logSheets[log.mode];
      return {
        title: sheet.title ?? (log.session.name || "Workout"),
        closeLabel: workoutLogControls[log.mode].backLabel,
        testID: sheet.testID,
        log,
      };
    }
  }
}

/** The sheet's page with the owner that renders it. */
export type ExerciseTabPage =
  | {
      kind: "exercise";
      draft: ReturnType<LibraryDrafts["exercise"]>;
      exercise?: ExerciseDefinition;
      linkDemo: boolean;
    }
  | { kind: "workout"; draft: ReturnType<LibraryDrafts["template"]>; workout?: WorkoutTemplate }
  | { kind: "library"; actions: ReturnType<LibraryDrafts["savedWorkouts"]>; date: string }
  | { kind: "import"; flow: ReturnType<LibraryDrafts["workoutImport"]> }
  /** A null edit: the workout is no longer available. */
  | { kind: "session"; edit: WorkoutEdit | null };

/** A Workout log card on the tab with the edit that renders it. */
export type ExerciseTabCard = { session: WorkoutSession; edit: WorkoutEdit };
type ExerciseTabSnapshot = Readonly<
  Omit<ExerciseTabProjection, "sheet" | "plannedCards" | "inline"> & {
    plannedCards: readonly ExerciseTabCard[];
    inline: (InlineWorkoutLog & ExerciseTabCard) | null;
    sheet: (ExerciseTabSheet & { page: ExerciseTabPage; close: () => void }) | null;
    query: string;
    panel: WorkoutPanel | null;
    /** The live workout just ended: the day's card fades in where the live card was. */
    liveEnded: boolean;
    /** Whether the exercise document is loaded; panels open only over it. */
    loaded: boolean;
    /** The library's Exercise definitions, which search reads. */
    exercises: readonly ExerciseDefinition[];
  }
>;

/**
 * Owns the Exercise tab's view: its panel and the tokens that keep late results local to the
 * panel they began on, the query, focus and route requests. Workout edits and Library drafts
 * consume its panel seam; before a panel changes, Workout edits save the logs it leaves. Away from
 * the tab the sheet hides, and its panel and drafts wait for the return.
 */
export function createExerciseTabView({
  store,
  date,
  importSources,
  now,
}: {
  store: Store;
  date: string;
  importSources: readonly WorkoutImportFlowSource[];
  /** The time set clocks read; the device clock by default. */
  now?: () => number;
}) {
  const listeners = new Set<() => void>();
  let panel: WorkoutPanel | null = null;
  let day = date,
    query = "",
    focused = false;
  let sequence = 0,
    request = 0,
    attached = true,
    attachment = 0;
  let wasLive = false,
    liveEnded = false,
    dailyShown = false;
  let unfollow: (() => void) | undefined;

  function build(): ExerciseTabSnapshot {
    const state = store.getSnapshot().state;
    const document = state.kind === "ready" ? state.document : null;
    const view = exerciseTabView({ document, date: day, panel, query, workoutState: state.kind });
    const live = view.live !== null || view.sheet?.log?.mode === "active";
    // When the live workout ends (not when a panel or search covers it), the day's card that
    // replaces it fades in where the live card was. It stays marked until it hides; a card that is
    // simply there on arrival doesn't animate.
    if (live || (dailyShown && !view.showDailyWorkout)) liveEnded = false;
    else if (wasLive && !activeWorkout(document?.sessions ?? [])) liveEnded = true;
    wasLive = live;
    dailyShown = view.showDailyWorkout;
    const { sheet, inline } = view;
    return {
      ...view,
      plannedCards: view.plannedCards.map((session) => ({ session, edit: edits.edit(session.id) })),
      inline: inline && { ...inline, edit: edits.edit(inline.session.id) },
      sheet:
        focused && sheet
          ? {
              ...sheet,
              page: page(sheet.panel, sheet.log),
              close: () => panels.closeView(sheet.panel.token),
            }
          : null,
      query,
      panel,
      liveEnded: liveEnded && view.showDailyWorkout,
      loaded: document !== null,
      exercises: document?.exercises ?? [],
    };
  }
  function page({ content, token }: WorkoutPanel, log: ExerciseTabSheet["log"]): ExerciseTabPage {
    switch (content.kind) {
      case "exercise":
        return {
          kind: "exercise",
          draft: drafts.exercise(token, content.exercise, content.linkDemo),
          exercise: content.exercise,
          linkDemo: content.linkDemo ?? false,
        };
      case "workout":
        return {
          kind: "workout",
          draft: drafts.template(token, content.workout),
          workout: content.workout,
        };
      case "library":
        return {
          kind: "library",
          actions: drafts.savedWorkouts(token, content.date),
          date: content.date,
        };
      case "import":
        return { kind: "import", flow: drafts.workoutImport(token, content.source) };
      case "session":
        return { kind: "session", edit: log && edits.edit(log.session.id) };
    }
  }
  function publish() {
    snapshot = build();
    for (const listener of listeners) listener();
  }
  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
  function replace(content: WorkoutView | null) {
    panel = content ? { content, token: ++sequence } : null;
    publish();
  }
  const panels: ExercisePanels = {
    panel: () => panel,
    subscribe,
    origin: () => ({ request, attachment }),
    leave(token, origin, content = null) {
      if (
        attached &&
        attachment === origin.attachment &&
        request === origin.request &&
        (panel?.token ?? null) === token
      ) {
        ++request;
        replace(content);
      }
    },
    closeView(token) {
      const content = panel?.content;
      if (attached && panel?.token === token) {
        ++request;
        replace((content?.kind === "exercise" && content.returnTo) || null);
      }
    },
    replaceView(token, content) {
      if (attached && panel?.token === token) {
        ++request;
        replace(content);
      }
    },
  };
  // Library drafts subscribe first, so a replaced panel's draft retires before the screen renders.
  const drafts = createLibraryDrafts({ store, panels, importSources });
  const edits = createWorkoutEditing(store, panels, requestView, now);
  let snapshot = build();

  /** Opens `content` once the logs it leaves are saved; only the latest request opens. */
  async function requestView(content: WorkoutView) {
    const ticket = ++request,
      originAttachment = attachment;
    const departed = edits.depart(content);
    if (departed !== true && !(await departed)) return false;
    if (!attached || attachment !== originAttachment || ticket !== request) return false;
    replace(content);
    return true;
  }
  function document(): ExerciseDocument | null {
    const state = store.getSnapshot().state;
    return state.kind === "ready" ? state.document : null;
  }
  /** Follows a newly published exercise document. */
  function refresh() {
    edits.refreshDocument();
    publish();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe,
    /** Workout edits, which save the logs a panel change leaves. */
    edits,
    /** Library drafts, one per library panel. */
    drafts,
    requestView,
    closeView: panels.closeView,
    /** Saved workouts for the Selected day. */
    openLibrary: () => requestView({ kind: "library", date: day }),
    search(text: string) {
      query = text;
      publish();
    },
    setDay(date: string) {
      if (date === day) return;
      day = date;
      publish();
    },
    /** Away from the tab the sheet hides; its panel and drafts wait for the return. */
    setFocused(next: boolean) {
      if (next === focused) return;
      focused = next;
      publish();
    },
    /** Follows the exercise document, catching up on anything it published before. */
    start() {
      if (unfollow) return;
      attached = true;
      unfollow = store.subscribe(refresh);
      refresh();
    },
    /** Leaving rejects pending navigation and late panel changes from before. */
    stop() {
      attached = false;
      ++attachment;
      ++request;
      unfollow?.();
      unfollow = undefined;
    },
    /** `?workoutMenu=<day>`: Saved workouts for that day. A malformed day does nothing. */
    openWorkoutMenu(date: string) {
      try {
        parseDay(date);
      } catch {
        return Promise.resolve(false);
      }
      return requestView({ kind: "library", date });
    },
    /** `?workoutImport=<source>`: an import already open keeps its link, preview or pending save. */
    openImport(source: string) {
      if (panel?.content.kind === "import") return Promise.resolve(false);
      return requestView({ kind: "import", source });
    },
    /** `?liveWorkout=<id>`: the Active workout's page, unless it is already up or no longer active. */
    openLiveWorkout(id: string) {
      if (panel?.content.kind === "session" && panel.content.id === id)
        return Promise.resolve(false);
      if (activeWorkout(document()?.sessions ?? [])?.id !== id) return Promise.resolve(false);
      return requestView({ kind: "session", id });
    },
  };
}
export type ExerciseTabView = ReturnType<typeof createExerciseTabView>;

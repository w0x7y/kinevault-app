import {
  activeWorkout,
  defaultPlannedSets,
  durationFromMinutes,
  formatElapsed,
  matchingExercises,
  minutesText,
  parsePlannedSetCount,
  plannedSetCountMessage,
  resizeSets,
  setHints,
  type ExerciseDefinition,
  type ExerciseDocument,
  type ExerciseSet,
  type SessionExercise,
  type SetHint,
  type WorkoutSession,
} from "./model.ts";
import {
  createEmptySet,
  isBlankSet,
  timedSeconds,
  withHintValues,
  withSetValue,
  type SetField,
  type SetLine,
} from "./tracking.ts";
import { writeFailure, type createExercisePersistence, type ExerciseWrite } from "./persistence.ts";
import {
  createSetClock,
  type SetClockTime,
  type ShownClock,
  type StoppedClock,
} from "./set-clock.ts";
import { exerciseRowLabel } from "./short-name.ts";
import type { ExercisePanels, WorkoutView } from "./tab-view.ts";
import {
  keepShown,
  librarySearch,
  moreResults,
  resultPage,
  workspaceView,
  type LibrarySearch,
} from "./workspace-page.ts";

/**
 * How a workout log presents: a compact planned card, the live workspace, manual logging of a
 * planned log, or an edit of a completed one.
 */
export type WorkoutLogMode = "compact" | "active" | "manual" | "completed";
type WorkoutFields = { name: string; exercises: SessionExercise[]; minutes: string };
type SetClocks = SetClockTime & {
  /** A countdown ran out, e.g. to buzz. */
  onCountdownEnd?: () => void;
};
type WorkoutEditState = {
  session: WorkoutSession;
  fields: WorkoutFields;
  /**
   * Planned count text typed on a compact card that its row's sets may not match: invalid, blocked
   * by entered sets, or still being typed (so "05" stays "05"). Other rows show their set count.
   */
  counts: Record<string, string>;
  busy: boolean;
  error: string | null;
  countError: string | null;
  /** The exercise row on screen, so a remounted editor (e.g. after "Link demo") reopens on it. */
  selectedId: string | null;
  /** Whether a compact card shows its planned-set settings. */
  settingsOpen: boolean;
  /** Whether a manual or completed page shows its name and duration fields. */
  detailsOpen: boolean;
  /** The exercise row whose notes show. */
  notesId: string | null;
  /**
   * Edit mode: each set gets add and remove buttons, and the exercise bar removes, reorders and
   * adds exercises.
   */
  editing: boolean;
  /** Edit mode's open Add exercise: its library search and how many results show. */
  adding: LibrarySearch | null;
  /** The exercise row whose removal awaits confirmation. */
  removingId: string | null;
};
type Store = Pick<
  ReturnType<typeof createExercisePersistence>,
  "getSnapshot" | "updateSession" | "startSession" | "completeSession" | "removeSession"
>;
type Change =
  | { kind: "name"; value: string }
  | { kind: "minutes"; value: string }
  | { kind: "count"; rowId: string; value: string }
  /** Appends an exercise to this log only, with the default planned sets, and shows it. */
  | { kind: "add-exercise"; exercise: ExerciseDefinition }
  /** Removes an exercise row from this log only; templates and the library keep it. */
  | { kind: "remove-exercise"; rowId: string }
  | { kind: "move-exercise"; rowId: string; to: number }
  /** An exercise's notes, in every row of it; the save command also gives them to the library. */
  | { kind: "notes"; rowId: string; value: string }
  | SetChange;
type SetChange =
  /** Adds an empty set after `afterId`, or at the end. */
  | { kind: "add-set"; rowId: string; afterId?: string }
  /**
   * Removes set `setId`, or the row's last set, from this log only; workout templates keep their
   * planned counts.
   */
  | { kind: "remove-set"; rowId: string; setId?: string }
  /** Copies a set line's Previous sets hint into its blank fields (pressing the set's number). */
  | { kind: "fill"; rowId: string; setId: string; side: SetLine["side"] }
  | {
      kind: "set";
      rowId: string;
      setId: string;
      side: SetLine["side"];
      field: SetField;
      value: string;
    };
type Action =
  "retry" | "settings" | "cancel" | "leave" | "start" | "manual" | "complete" | "save" | "discard";
type WorkoutLogControls = {
  /** The back button: leaving the Active workout's page keeps it running; others cancel. */
  back: Extract<Action, "leave" | "cancel">;
  /** The back button's accessible name. */
  backLabel: string;
  /**
   * The main action: Save on a completed log; otherwise End or Log completes it. A compact card's
   * Log opens the manual page (`manual`), which completes it.
   */
  primary: Extract<Action, "save" | "complete" | "manual">;
  primaryLabel: string;
  discard: boolean;
  /** Start from the compact card or the manual page. */
  start: boolean;
  /** Name and duration, on the manual and completed pages. */
  details: boolean;
  /** The workout's name above its exercises; the live page leads with its timer instead. */
  showName: boolean;
  /** "Link demo" under an unlinked exercise; a live workout doesn't leave for the form. */
  linkDemo: boolean;
  /** A failed draft save offers a retry; a completed log saves only through Save. */
  retry: boolean;
  /** The card's or workspace's overline and test ID. */
  overline: string | undefined;
  testID: string;
};
/** A saved log's editable fields. */
function savedFields(session: WorkoutSession): Pick<WorkoutEditState, "fields" | "counts"> {
  return {
    fields: {
      name: session.name,
      exercises: session.exercises,
      minutes: minutesText(session.durationSeconds),
    },
    counts: {},
  };
}
/** What a workout log shows in each mode. */
export const workoutLogControls = {
  compact: {
    back: "cancel",
    backLabel: "Close workout",
    primary: "manual",
    primaryLabel: "Log completed workout",
    discard: false,
    start: true,
    details: false,
    showName: true,
    linkDemo: false,
    retry: true,
    overline: "Planned",
    testID: "planned-workout-card",
  },
  active: {
    back: "leave",
    backLabel: "Back to Exercise",
    primary: "complete",
    primaryLabel: "End workout",
    discard: true,
    start: false,
    details: false,
    showName: false,
    linkDemo: false,
    retry: true,
    overline: undefined,
    testID: "active-workout-workspace",
  },
  manual: {
    back: "cancel",
    backLabel: "Cancel",
    primary: "complete",
    primaryLabel: "Log completed workout",
    discard: true,
    start: true,
    details: true,
    showName: true,
    linkDemo: true,
    retry: true,
    overline: "Log a workout",
    testID: "manual-workout-workspace",
  },
  completed: {
    back: "cancel",
    backLabel: "Cancel",
    primary: "save",
    primaryLabel: "Save changes",
    discard: false,
    start: false,
    details: true,
    showName: true,
    linkDemo: true,
    retry: false,
    overline: "Logged workout",
    testID: "completed-workout-workspace",
  },
} satisfies Record<WorkoutLogMode, WorkoutLogControls>;
/** The edit with the controls its log mode allows. The saved log and row ID stay inside. */
type WorkoutEditSnapshot = Readonly<
  Omit<WorkoutEditState, "session" | "selectedId" | "counts"> &
    WorkoutLogControls & {
      mode: WorkoutLogMode;
      /** Each row's planned count as its field shows it: the typed text, or its set count. */
      counts: Record<string, string>;
      /** The exercise row on screen: the selected one, or the first. */
      selected: SessionExercise | undefined;
      /** The rows Back and Next show. */
      previous: SessionExercise | undefined;
      next: SessionExercise | undefined;
      /** The selected row's Previous sets hints, one per set. */
      hints: SetHint[];
      /** The entered duration as the page shows it. */
      durationCaption: string;
      /** The running set clock as of the ticker's last move. */
      shownClock: ShownClock | null;
      /**
       * Add exercise's results: the library's matches for its search, or the whole library
       * before one, a page at a time.
       */
      addResults: { items: readonly ExerciseDefinition[]; more: boolean } | null;
      /** The row awaiting removal, its name and the confirmation's question. */
      removing: { id: string; label: string; question: string } | null;
    }
>;
type Entry = {
  state: WorkoutEditState;
  /**
   * The last snapshot and the state it shows, rebuilt when the state, the mode or the shown clock
   * changes.
   */
  view: { state: WorkoutEditState; snapshot: WorkoutEditSnapshot } | null;
  revision: number;
  pending: Promise<boolean> | null;
  /** A change's draft save is running; later changes wait in `queued`, latest only. */
  saving: boolean;
  queued: { fields: WorkoutFields; revision: number } | null;
};

const invalidDuration =
  "Enter a nonnegative duration in minutes or leave it blank before leaving the workout. Your sets have been saved.";
/** Seconds for typed minutes: null when blank, undefined when invalid. */
function typedSeconds(minutes: string) {
  try {
    return durationFromMinutes(minutes);
  } catch {
    return undefined;
  }
}
function durationCaption(minutes: string) {
  const seconds = typedSeconds(minutes);
  if (seconds === undefined) return "Invalid duration";
  return seconds === null ? "Duration not set" : formatElapsed(seconds);
}
function localId(kind = "set") {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function countProblem(row: SessionExercise, raw: string): string | null {
  const count = parsePlannedSetCount(raw);
  if (count === null) return plannedSetCountMessage(row.exercise.name);
  const lastEntered = row.sets.reduce((last, set, index) => (isBlankSet(set) ? last : index), -1);
  return count <= lastEntered
    ? `${row.exercise.name} has entered values in later sets. Keep at least ${lastEntered + 1} sets.`
    : null;
}

/** A planned log is a compact card unless the open view logs it manually. */
export function workoutLogMode(session: WorkoutSession, view?: WorkoutView | null): WorkoutLogMode {
  if (session.status !== "planned") return session.status;
  return view?.kind === "session" && view.id === session.id && view.manual ? "manual" : "compact";
}

function addResults(library: readonly ExerciseDefinition[], { query, limit }: LibrarySearch) {
  return resultPage(query.trim() ? matchingExercises(library, query) : library, limit);
}

function removal(exercises: readonly SessionExercise[], id: string | null) {
  const row = exercises.find((value) => value.id === id);
  if (!row) return null;
  const label = exerciseRowLabel(exercises, row);
  const logged = row.sets.some((set) => !isBlankSet(set));
  return {
    id: row.id,
    label,
    question: `Remove ${label} from this workout only? Your library and saved workouts keep it.${logged ? " The sets you entered go with it." : ""}`,
  };
}

function shownCount(row: SessionExercise, counts: Record<string, string>) {
  return counts[row.id] ?? String(row.sets.length);
}
function plannedCountError(fields: WorkoutFields, counts: Record<string, string>) {
  return (
    fields.exercises.map((row) => countProblem(row, shownCount(row, counts))).find(Boolean) ?? null
  );
}
/**
 * Typed counts after a change from `before` to `after`. A row's text goes with the row, and once
 * the row's set count changes, unless the text was invalid or blocked by entered sets.
 */
function keptCounts(before: WorkoutFields, after: WorkoutFields, counts: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(counts).filter(([id, text]) => {
      const was = before.exercises.find((row) => row.id === id);
      const row = after.exercises.find((value) => value.id === id);
      return was && row && (row.sets.length === was.sets.length || countProblem(was, text));
    }),
  );
}

// Fields outlive render mounts. Only durable success or explicit completed Cancel releases an edit.
// The tab view's panel tokens and request generations keep late callbacks local to their origin.
export function createWorkoutEditing(
  store: Store,
  panels: Pick<ExercisePanels, "panel" | "origin" | "leave">,
  /** The tab's view request, which saves the logs it leaves before opening `content`. */
  requestView: (content: WorkoutView) => Promise<boolean>,
  { onCountdownEnd = () => {}, ...time }: SetClocks = {},
) {
  const entries = new Map<string, Entry>(),
    listeners = new Set<() => void>();
  let lastDocument: ExerciseDocument | null = null;
  const emit = () => {
    for (const listener of listeners) listener();
  };
  // One clock per log, whichever page shows; a countdown that ran out logs once its edit is free.
  const clocks = createSetClock({
    ...time,
    onDue(id) {
      const entry = entries.get(id);
      if (!entry || entry.state.busy || !document()?.sessions.some((session) => session.id === id))
        return;
      settleClock(id, entry);
      onCountdownEnd();
    },
  });
  clocks.subscribe(emit);
  /** Publishes a clock change, logging a stopped clock's seconds into its set. */
  function logClock(id: string, stopped: StoppedClock | null) {
    if (stopped && stopped.seconds > 0)
      edit(id).change({
        kind: "set",
        rowId: stopped.rowId,
        setId: stopped.setId,
        side: null,
        field: "seconds",
        value: String(stopped.seconds),
      });
    else emit();
  }
  /** Stops a log's running clock and logs the seconds it ran; nothing while the edit is busy. */
  function settleClock(id: string, entry: Entry) {
    if (!current(id, entry) || entry.state.busy) return;
    const stopped = clocks.settle(id);
    if (stopped) logClock(id, stopped);
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  function document() {
    const state = store.getSnapshot().state;
    return state.kind === "ready" ? state.document : null;
  }
  function publish(entry: Entry, patch: Partial<WorkoutEditState>) {
    entry.state = { ...entry.state, ...patch };
    emit();
  }
  function current(id: string, entry: Entry) {
    return entries.get(id) === entry;
  }
  function modeOf(entry: Entry) {
    return workoutLogMode(entry.state.session, panels.panel()?.content);
  }
  function view(id: string, entry: Entry): WorkoutEditSnapshot {
    const { state } = entry,
      mode = modeOf(entry),
      shownClock = clocks.shown(id);
    if (
      entry.view?.state === state &&
      entry.view.snapshot.mode === mode &&
      entry.view.snapshot.shownClock === shownClock
    )
      return entry.view.snapshot;
    const { session, selectedId, counts, ...shown } = state;
    const { exercises, minutes } = state.fields;
    const { selected, previous, next } = workspaceView(exercises, selectedId);
    // Hints read other logs too; a newer document always replaces the state (see refreshDocument).
    const snapshot: WorkoutEditSnapshot = {
      ...shown,
      mode,
      ...workoutLogControls[mode],
      counts: Object.fromEntries(exercises.map((row) => [row.id, shownCount(row, counts)])),
      selected,
      previous,
      next,
      hints: selected ? setHints(document()?.sessions ?? [], session, selected) : [],
      durationCaption: durationCaption(minutes),
      shownClock,
      addResults: state.adding && addResults(document()?.exercises ?? [], state.adding),
      removing: removal(exercises, state.removingId),
    };
    entry.view = { state, snapshot };
    return snapshot;
  }
  function countsValid(entry: Entry) {
    // Planned set counts belong to the compact card; manual logging edits the sets themselves.
    if (modeOf(entry) !== "compact") return true;
    const problem = plannedCountError(entry.state.fields, entry.state.counts);
    // A folded settings section opens so its error is never hidden.
    publish(entry, problem ? { countError: problem, settingsOpen: true } : { countError: problem });
    return !problem;
  }
  function refreshDocument() {
    const next = document();
    if (!next || next === lastDocument) return;
    lastDocument = next;
    for (const [id, entry] of entries) {
      const session = next.sessions.find((value) => value.id === id);
      if (!session) {
        if (!entry.pending) {
          entries.delete(id);
          clocks.forget(id);
        }
      } else {
        // Untouched fields follow a newer saved log, e.g. from an account refresh; entered fields never do.
        const fields = entry.revision === 0 && !entry.pending ? savedFields(session) : {};
        entry.state = { ...entry.state, ...fields, session };
      }
    }
    // Editors render again with the newer saved log.
    emit();
  }
  function entryFor(id: string) {
    const session = document()?.sessions.find((value) => value.id === id);
    if (!session) throw new Error("This workout is no longer available.");
    let entry = entries.get(id);
    if (!entry) {
      entry = {
        view: null,
        revision: 0,
        pending: null,
        saving: false,
        queued: null,
        state: {
          session,
          ...savedFields(session),
          busy: false,
          error: null,
          countError: null,
          selectedId: null,
          settingsOpen: false,
          detailsOpen: false,
          notesId: null,
          editing: false,
          adding: null,
          removingId: null,
        },
      };
      entries.set(id, entry);
    }
    return entry;
  }
  async function persist(id: string, entry: Entry, fields: WorkoutFields, revision: number) {
    // A planned draft saves its sets and keeps the saved duration while the typed one is invalid.
    const planned = entry.state.session.status === "planned",
      invalidMinutes = planned && typedSeconds(fields.minutes) === undefined;
    const result = await store.updateSession({
      id,
      name: fields.name,
      exercises: fields.exercises,
      durationMinutes: planned && !invalidMinutes ? fields.minutes : undefined,
    });
    if (current(id, entry) && entry.revision === revision)
      publish(entry, {
        error:
          result.kind !== "saved"
            ? writeFailure(
                result,
                "Couldn't save your draft.",
                "Your fields are still here. Retry draft save before leaving the workout.",
              )
            : invalidMinutes
              ? invalidDuration
              : null,
      });
    return result.kind === "saved" && !invalidMinutes;
  }
  /** Takes the queued change unless its edit was released or became completed, which never autosaves. */
  function takeQueued(id: string, entry: Entry) {
    const next = entry.queued;
    entry.queued = null;
    return next && current(id, entry) && entry.state.session.status !== "completed" ? next : null;
  }
  // One change save runs at a time, so a typing burst writes its first and latest values only.
  function autosave(id: string, entry: Entry, fields: WorkoutFields, revision: number) {
    if (entry.saving) {
      entry.queued = { fields, revision };
      return;
    }
    entry.saving = true;
    void persist(id, entry, fields, revision).finally(() => {
      entry.saving = false;
      const next = takeQueued(id, entry);
      // An operation saves the queued change before its own writes when it takes over (see lock).
      if (next && !entry.pending) autosave(id, entry, next.fields, next.revision);
    });
  }
  function lock(id: string, entry: Entry, work: () => Promise<boolean>) {
    // Enqueue the latest change's save ahead of this operation's writes, as every change once was.
    const next = takeQueued(id, entry);
    if (next) void persist(id, entry, next.fields, next.revision);
    // Install the promise before publishing busy state, so listeners cannot re-enter an unowned operation.
    const pending = Promise.resolve()
      .then(work)
      .finally(() => {
        if (entry.pending === pending) {
          entry.pending = null;
          if (current(id, entry)) publish(entry, { busy: false });
        }
      });
    entry.pending = pending;
    publish(entry, { busy: true });
    return pending;
  }
  function flush(id: string, entry: Entry): Promise<boolean> {
    if (entry.state.session.status === "completed") return Promise.resolve(true);
    if (entry.pending) return entry.pending;
    return lock(id, entry, async () => {
      if (!countsValid(entry)) return false;
      return persist(id, entry, entry.state.fields, entry.revision);
    });
  }
  /**
   * Saves the logs that opening `content` leaves: the open log, or on the default view the Active
   * workout or the day's changed cards. True at once when none needs saving.
   */
  function depart(content: WorkoutView): true | Promise<boolean> {
    const panel = panels.panel();
    const active = activeWorkout(document()?.sessions ?? []);
    const departing = (
      panel?.content.kind === "session"
        ? [panel.content.id]
        : panel
          ? []
          : active
            ? [active.id]
            : [...entries]
                .filter(
                  ([, entry]) => entry.state.session.status === "planned" && entry.revision > 0,
                )
                .map(([id]) => id)
    )
      // Opening a workout's own page doesn't leave it.
      .filter((id) => !(content.kind === "session" && content.id === id));
    const saved = (id: string) => document()?.sessions.some((session) => session.id === id);
    if (!departing.some(saved)) return true;
    return (async () => {
      for (const id of departing) {
        if (!saved(id)) continue;
        if (!(await flush(id, entryFor(id)))) return false;
      }
      return true;
    })();
  }
  // A card or page keeps one handle per edit and origin, so its effects don't restart each publish.
  const handles = new WeakMap<Entry, { originToken: number | null; value: EditHandle }>();
  type EditHandle = ReturnType<typeof handle>;
  function edit(id: string) {
    const entry = entryFor(id),
      originToken = panels.panel()?.token ?? null;
    const cached = handles.get(entry);
    if (cached?.originToken === originToken) return cached.value;
    const value = handle(id, entry, originToken);
    handles.set(entry, { originToken, value });
    return value;
  }
  function handle(id: string, entry: Entry, originToken: number | null) {
    /** A row's sets after a set change; the same array when nothing changes. */
    function changedSets(row: SessionExercise, input: SetChange): ExerciseSet[] {
      switch (input.kind) {
        case "add-set": {
          const at =
            input.afterId === undefined
              ? row.sets.length
              : row.sets.findIndex((set) => set.id === input.afterId) + 1;
          if (at === 0 && input.afterId !== undefined) return row.sets;
          const added = createEmptySet(row.exercise.tracking, localId());
          return [...row.sets.slice(0, at), added, ...row.sets.slice(at)];
        }
        case "remove-set": {
          const removed =
            input.setId === undefined
              ? row.sets.at(-1)
              : row.sets.find((set) => set.id === input.setId);
          return removed ? row.sets.filter((set) => set !== removed) : row.sets;
        }
        case "fill": {
          const index = row.sets.findIndex((set) => set.id === input.setId);
          const hint = setHints(document()?.sessions ?? [], entry.state.session, row)[index]?.find(
            (line) => line.side === input.side,
          );
          const set = row.sets[index];
          const filled = set && hint ? withHintValues(set, hint) : set;
          return filled === set
            ? row.sets
            : row.sets.map((value) => (value === set ? filled! : value));
        }
        case "set":
          return row.sets.map((set) =>
            set.id === input.setId ? withSetValue(set, input.side, input.field, input.value) : set,
          );
      }
    }
    function change(input: Change) {
      if (!current(id, entry) || entry.state.busy) return;
      let fields = entry.state.fields;
      let resizeBlocked = false,
        { selectedId, adding, removingId } = entry.state;
      if (input.kind === "name" || input.kind === "minutes")
        fields = { ...fields, [input.kind]: input.value };
      else if (input.kind === "count") {
        const row = fields.exercises.find((value) => value.id === input.rowId);
        if (!row || entry.state.session.status !== "planned") return;
        resizeBlocked = Boolean(countProblem(row, input.value));
        if (!resizeBlocked) {
          const count = parsePlannedSetCount(input.value)!;
          fields = {
            ...fields,
            exercises: fields.exercises.map((value) =>
              value.id !== input.rowId
                ? value
                : {
                    ...value,
                    sets: resizeSets(value.sets, value.exercise.tracking, count, localId),
                  },
            ),
          };
        }
      } else if (input.kind === "add-exercise") {
        const { tracking } = input.exercise;
        const row = {
          id: localId("row"),
          exercise: { ...input.exercise },
          sets: resizeSets([], tracking, defaultPlannedSets, localId),
        };
        fields = { ...fields, exercises: [...fields.exercises, row] };
        selectedId = row.id;
        adding = null;
      } else if (input.kind === "remove-exercise") {
        const exercises = fields.exercises.filter((value) => value.id !== input.rowId);
        if (exercises.length === fields.exercises.length) return;
        fields = { ...fields, exercises };
        removingId = null;
      } else if (input.kind === "notes") {
        const row = fields.exercises.find((value) => value.id === input.rowId);
        if (!row || row.exercise.notes === input.value) return;
        const exerciseId = row.exercise.id;
        fields = {
          ...fields,
          exercises: fields.exercises.map((value) =>
            value.exercise.id === exerciseId
              ? { ...value, exercise: { ...value.exercise, notes: input.value } }
              : value,
          ),
        };
      } else if (input.kind === "move-exercise") {
        const row = fields.exercises.find((value) => value.id === input.rowId);
        const exercises = fields.exercises.filter((value) => value !== row);
        if (
          !row ||
          fields.exercises[input.to] === row ||
          !(input.to >= 0 && input.to <= exercises.length)
        )
          return;
        exercises.splice(input.to, 0, row);
        // The exercise on screen stays on screen, even when it was only shown for being first.
        selectedId = keepShown(fields.exercises, selectedId) ?? null;
        fields = { ...fields, exercises };
      } else {
        const row = fields.exercises.find((value) => value.id === input.rowId);
        if (!row) return;
        const sets = changedSets(row, input);
        if (sets === row.sets) return;
        fields = {
          ...fields,
          exercises: fields.exercises.map((value) => (value === row ? { ...row, sets } : value)),
        };
      }
      let counts = keptCounts(entry.state.fields, fields, entry.state.counts);
      if (input.kind === "count") counts = { ...counts, [input.rowId]: input.value };
      const countError =
        entry.state.session.status === "planned" ? plannedCountError(fields, counts) : null;
      // A removed set's running clock, or its exercise's, goes with it.
      const clock = clocks.shown(id);
      const timed = clock && fields.exercises.find((row) => row.id === clock.rowId);
      if (clock && !timed?.sets.some((set) => set.id === clock.setId)) clocks.forget(id);
      const revision = ++entry.revision;
      // Commit state and enqueue (or queue) this captured revision before observers can enter a newer change.
      entry.state = {
        ...entry.state,
        fields,
        counts,
        countError,
        selectedId,
        adding,
        removingId,
      };
      if (entry.state.session.status !== "completed" && !resizeBlocked)
        autosave(id, entry, fields, revision);
      emit();
    }
    async function run(kind: Action): Promise<boolean> {
      const origin = panels.origin();
      if (!current(id, entry)) return false;
      if (kind === "retry") return flush(id, entry);
      if (kind === "manual") return requestView({ kind: "session", id, manual: true });
      // A save or cancel logs a running clock first, so its time isn't lost.
      if (kind === "complete" || kind === "save" || kind === "cancel") settleClock(id, entry);
      if (kind === "settings") {
        const success = await flush(id, entry);
        // Saved settings fold away; a failure keeps them open beside its feedback.
        if (success && current(id, entry)) publish(entry, { settingsOpen: false });
        return success;
      }
      if (entry.pending) return false;
      // Cancel releases the edit; leaving the Active workout's page keeps it for the next visit.
      if (kind === "cancel" || kind === "leave") {
        const success = await flush(id, entry);
        if (success && current(id, entry)) {
          if (kind === "cancel") {
            entries.delete(id);
            clocks.forget(id);
          }
          panels.leave(originToken, origin);
        }
        return success;
      }
      return lock(id, entry, async () => {
        // Validation publishes feedback only after this action owns the operation.
        if (kind !== "discard" && !countsValid(entry)) return false;
        publish(entry, { error: null });
        const fields = entry.state.fields;
        const [lead, retry] =
          kind === "discard"
            ? ["Couldn't discard this workout.", "Try again."]
            : kind === "start"
              ? ["Couldn't start.", "Try again."]
              : ["Couldn't save.", "Your fields are still here. Try again."];
        let result: ExerciseWrite<true> | null = null;
        const input = { id, name: fields.name, exercises: fields.exercises };
        if (kind === "discard") result = await store.removeSession(id);
        else if (kind === "start") {
          // A failed draft save shows its own feedback.
          if (await persist(id, entry, fields, entry.revision))
            result = await store.startSession(id);
        } else if (kind === "complete")
          result = await store.completeSession({ ...input, durationMinutes: fields.minutes });
        else result = await store.updateSession({ ...input, durationMinutes: fields.minutes });
        const success = result?.kind === "saved";
        if (!current(id, entry)) return success;
        if (success) {
          if (kind === "start") {
            const session = document()?.sessions.find((value) => value.id === id);
            if (session) publish(entry, { session, error: null });
            // A card started from the day opens the Active workout's page; a page stays up.
            if (originToken === null) panels.leave(null, origin, { kind: "session", id });
          } else {
            entries.delete(id);
            clocks.forget(id);
            panels.leave(originToken, origin);
            emit();
          }
        } else
          publish(entry, {
            error:
              (result ? writeFailure(result, lead, retry) : entry.state.error) ??
              `${lead} ${retry}`,
          });
        return success;
      });
    }
    return {
      getSnapshot: () => view(id, entry),
      subscribe,
      change,
      run,
      /**
       * Starts a timed set's clock: a countdown from its seconds, or a stopwatch on a blank set.
       * On the running set it stops and logs the seconds it ran; another running clock stops first.
       */
      toggleClock(rowId: string, setId: string) {
        if (!current(id, entry) || entry.state.busy) return;
        const set = entry.state.fields.exercises
          .find((row) => row.id === rowId)
          ?.sets.find((value) => value.id === setId);
        if (set?.kind === "time") logClock(id, clocks.toggle(id, rowId, setId, timedSeconds(set)));
        else settleClock(id, entry);
      },
      select(rowId: string) {
        if (current(id, entry) && entry.state.selectedId !== rowId)
          publish(entry, { selectedId: rowId });
      },
      showSettings(open: boolean) {
        if (current(id, entry) && entry.state.settingsOpen !== open)
          publish(entry, { settingsOpen: open });
      },
      showDetails(open: boolean) {
        if (current(id, entry) && entry.state.detailsOpen !== open)
          publish(entry, { detailsOpen: open });
      },
      /** Shows a row's notes, or none. */
      showNotes(rowId: string | null) {
        if (current(id, entry) && entry.state.notesId !== rowId) publish(entry, { notesId: rowId });
      },
      /** Turns edit mode on or off. */
      setEditing(on: boolean) {
        if (current(id, entry) && entry.state.editing !== on) publish(entry, { editing: on });
      },
      /** Opens Add exercise on a blank search, or closes it. */
      showAddExercise(open: boolean) {
        if (current(id, entry)) publish(entry, { adding: open ? librarySearch("") : null });
      },
      /** Add exercise's search; a new search starts on its first page. */
      searchLibrary(query: string) {
        if (current(id, entry) && entry.state.adding)
          publish(entry, { adding: librarySearch(query) });
      },
      showMoreExercises() {
        const adding = entry.state.adding;
        if (current(id, entry) && adding) publish(entry, { adding: moreResults(adding) });
      },
      /** Asks to confirm removing a row from this workout, or drops the question. */
      askRemove(rowId: string | null) {
        if (current(id, entry) && entry.state.removingId !== rowId)
          publish(entry, { removingId: rowId });
      },
      /**
       * Opens a new exercise's form. Saving it returns here and adds the exercise to this workout;
       * Cancel just returns.
       */
      createExercise() {
        if (!current(id, entry)) return Promise.resolve(false);
        publish(entry, { adding: null });
        return requestView({
          kind: "exercise",
          addToWorkout: true,
          returnTo: { kind: "session", id, manual: modeOf(entry) === "manual" },
        });
      },
      /**
       * Opens the exercise's form at its KineVault search; its Save or Cancel returns here. Only
       * where the log mode allows it (`linkDemo`).
       */
      linkDemo(exercise: ExerciseDefinition) {
        if (!current(id, entry) || !workoutLogControls[modeOf(entry)].linkDemo)
          return Promise.resolve(false);
        return requestView({
          kind: "exercise",
          exercise,
          linkDemo: true,
          returnTo: { kind: "session", id, manual: modeOf(entry) === "manual" },
        });
      },
    };
  }
  return {
    subscribe,
    refreshDocument,
    edit,
    depart,
    /** Adds library exercise `exerciseId` to workout log `id`; nothing when either is gone. */
    addExercise(id: string, exerciseId: string) {
      const exercise = document()?.exercises.find((value) => value.id === exerciseId);
      if (exercise && document()?.sessions.some((session) => session.id === id))
        edit(id).change({ kind: "add-exercise", exercise });
    },
    /** Set clocks tick while the tab is attached. */
    start: clocks.attach,
    stop: clocks.detach,
  };
}
export type WorkoutEditing = ReturnType<typeof createWorkoutEditing>;
export type WorkoutEdit = ReturnType<WorkoutEditing["edit"]>;

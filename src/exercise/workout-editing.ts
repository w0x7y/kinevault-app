import {
  createEmptySet,
  durationFromMinutes,
  isBlankSet,
  type ExerciseDocument,
  type ExerciseSet,
  type SessionExercise,
  type WorkoutSession,
} from "./model.ts";
import type { createExercisePersistence } from "./persistence.ts";
import type { ExercisePanels, WorkoutView } from "./tab-view.ts";

/**
 * How a workout log presents: a compact planned card, the live workspace, manual logging of a
 * planned log, or an edit of a completed one.
 */
export type WorkoutLogMode = "compact" | "active" | "manual" | "completed";
export type WorkoutFields = { name: string; exercises: SessionExercise[]; minutes: string };
export type WorkoutEditState = {
  session: WorkoutSession;
  fields: WorkoutFields;
  counts: Record<string, string>;
  busy: boolean;
  error: string | null;
  countError: string | null;
  /** The exercise row on screen, so a remounted editor (e.g. after "Link demo") reopens on it. */
  selectedId: string | null;
  /** Whether a compact card shows its planned-set settings. */
  settingsOpen: boolean;
};
type Store = Pick<
  ReturnType<typeof createExercisePersistence>,
  "getSnapshot" | "updateSession" | "startSession" | "completeSession" | "removeSession"
>;
type Change =
  | { kind: "name"; value: string }
  | { kind: "minutes"; value: string }
  | { kind: "count"; rowId: string; value: string }
  | { kind: "add-set"; rowId: string }
  | { kind: "set"; rowId: string; setId: string; build: (set: ExerciseSet) => ExerciseSet };
type Action = "retry" | "settings" | "cancel" | "leave" | "start" | "complete" | "save" | "discard";
type Entry = {
  state: WorkoutEditState;
  revision: number;
  pending: Promise<boolean> | null;
  /** A change's draft save is running; later changes wait in `queued`, latest only. */
  saving: boolean;
  queued: { fields: WorkoutFields; revision: number } | null;
};

const draftFailure =
  "Couldn't save your draft. Your fields are still here. Retry draft save before leaving the workout.";
const invalidDuration =
  "Enter a nonnegative duration in minutes or leave it blank before leaving the workout. Your sets have been saved.";
const saveFailure =
  "Couldn't save. Enter a workout name and positive whole reps for each set; weight and minutes must be nonnegative numbers. Your fields are still here. Try again.";
function localId() {
  return `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function countProblem(row: SessionExercise, raw: string): string | null {
  const text = raw.trim(),
    count = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(count) || count < 0 || count > 100)
    return `Enter a whole planned set count from 0 to 100 for ${row.exercise.name}.`;
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

function plannedCountError(fields: WorkoutFields, counts: Record<string, string>) {
  return (
    fields.exercises
      .map((row) => countProblem(row, counts[row.id] ?? String(row.sets.length)))
      .find(Boolean) ?? null
  );
}

// Fields outlive render mounts. Only durable success or explicit completed Cancel releases an edit.
// The tab view's panel tokens and request generations keep late callbacks local to their origin.
export function createWorkoutEditing(
  store: Store,
  panels: Pick<ExercisePanels, "panel" | "origin" | "leave">,
) {
  const entries = new Map<string, Entry>(),
    listeners = new Set<() => void>();
  let lastDocument: ExerciseDocument | null = null;
  const emit = () => {
    for (const listener of listeners) listener();
  };
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
  function countsValid(entry: Entry) {
    // Planned set counts belong to the compact card; manual logging edits the sets themselves.
    if (workoutLogMode(entry.state.session, panels.panel()?.content) !== "compact") return true;
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
        if (!entry.pending) entries.delete(id);
      } else {
        // A freshly retired editor can render once against an older React provider snapshot.
        // Unchanged fields follow its next durable publication; entered raw fields never do.
        const savedFields =
          entry.revision === 0 && !entry.pending
            ? {
                fields: {
                  name: session.name,
                  exercises: session.exercises,
                  minutes:
                    session.durationSeconds === null ? "" : String(session.durationSeconds / 60),
                },
                counts: Object.fromEntries(
                  session.exercises.map((row) => [row.id, String(row.sets.length)]),
                ),
              }
            : {};
        entry.state = { ...entry.state, ...savedFields, session };
      }
    }
    // Editors render again, so a successful retirement resolves from the saved document.
    emit();
  }
  function entryFor(id: string) {
    const session = document()?.sessions.find((value) => value.id === id);
    if (!session) throw new Error("This workout is no longer available.");
    let entry = entries.get(id);
    if (!entry) {
      entry = {
        revision: 0,
        pending: null,
        saving: false,
        queued: null,
        state: {
          session,
          fields: {
            name: session.name,
            exercises: session.exercises,
            minutes: session.durationSeconds === null ? "" : String(session.durationSeconds / 60),
          },
          counts: Object.fromEntries(
            session.exercises.map((row) => [row.id, String(row.sets.length)]),
          ),
          busy: false,
          error: null,
          countError: null,
          selectedId: null,
          settingsOpen: false,
        },
      };
      entries.set(id, entry);
    }
    return entry;
  }
  async function persist(id: string, entry: Entry, fields: WorkoutFields, revision: number) {
    let durationSeconds: number | null | undefined,
      invalidMinutes = false;
    if (entry.state.session.status === "planned") {
      try {
        durationSeconds = durationFromMinutes(fields.minutes);
      } catch {
        invalidMinutes = true;
      }
    }
    const success = await store.updateSession({
      id,
      name: fields.name,
      exercises: fields.exercises,
      durationSeconds,
    });
    if (current(id, entry) && entry.revision === revision)
      publish(entry, { error: !success ? draftFailure : invalidMinutes ? invalidDuration : null });
    return success && !invalidMinutes;
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
    const active = document()?.sessions.find((session) => session.status === "active");
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
  function edit(id: string) {
    const entry = entryFor(id),
      originToken = panels.panel()?.token ?? null;
    function change(input: Change) {
      if (!current(id, entry) || entry.state.busy) return;
      let fields = entry.state.fields,
        counts = entry.state.counts;
      let resizeBlocked = false;
      if (input.kind === "name" || input.kind === "minutes")
        fields = { ...fields, [input.kind]: input.value };
      else if (input.kind === "count") {
        counts = { ...counts, [input.rowId]: input.value };
        const row = fields.exercises.find((value) => value.id === input.rowId);
        if (!row || entry.state.session.status !== "planned") return;
        resizeBlocked = Boolean(countProblem(row, input.value));
        if (!resizeBlocked) {
          const count = Number(input.value.trim());
          fields = {
            ...fields,
            exercises: fields.exercises.map((value) =>
              value.id !== input.rowId
                ? value
                : {
                    ...value,
                    sets:
                      count <= value.sets.length
                        ? value.sets.slice(0, count)
                        : [
                            ...value.sets,
                            ...Array.from({ length: count - value.sets.length }, () =>
                              createEmptySet(value.exercise.tracking, localId()),
                            ),
                          ],
                  },
            ),
          };
        }
      } else {
        const row = fields.exercises.find((value) => value.id === input.rowId);
        if (
          input.kind === "add-set" &&
          row &&
          !countProblem(row, counts[row.id] ?? String(row.sets.length))
        ) {
          counts = { ...counts, [row.id]: String(row.sets.length + 1) };
        }
        fields = {
          ...fields,
          exercises: fields.exercises.map((row) =>
            row.id !== input.rowId
              ? row
              : {
                  ...row,
                  sets:
                    input.kind === "add-set"
                      ? [...row.sets, createEmptySet(row.exercise.tracking, localId())]
                      : row.sets.map((set) => (set.id === input.setId ? input.build(set) : set)),
                },
          ),
        };
      }
      const countError =
        entry.state.session.status === "planned" ? plannedCountError(fields, counts) : null;
      const revision = ++entry.revision;
      // Commit state and enqueue (or queue) this captured revision before observers can enter a newer change.
      entry.state = { ...entry.state, fields, counts, countError };
      if (entry.state.session.status !== "completed" && !resizeBlocked)
        autosave(id, entry, fields, revision);
      emit();
    }
    async function run(kind: Action): Promise<boolean> {
      const origin = panels.origin();
      if (!current(id, entry)) return false;
      if (kind === "retry") return flush(id, entry);
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
          if (kind === "cancel") entries.delete(id);
          panels.leave(originToken, origin);
        }
        return success;
      }
      return lock(id, entry, async () => {
        // Validation publishes feedback only after this action owns the operation.
        if (kind !== "discard" && !countsValid(entry)) return false;
        publish(entry, { error: null });
        const fields = entry.state.fields;
        let success = false,
          error: string | null = null;
        try {
          if (kind === "discard") success = await store.removeSession(id);
          else if (kind === "start") {
            success = await persist(id, entry, fields, entry.revision);
            if (success) {
              if (!fields.name.trim()) {
                success = false;
                error = "Enter a workout name before starting.";
              } else success = await store.startSession(id);
            }
          } else if (kind === "complete")
            success = await store.completeSession({
              id,
              name: fields.name,
              exercises: fields.exercises,
              durationMinutes: fields.minutes,
            });
          else
            success = await store.updateSession({
              id,
              name: fields.name,
              exercises: fields.exercises,
              durationSeconds: durationFromMinutes(fields.minutes),
            });
        } catch (reason) {
          error =
            reason instanceof Error ? reason.message : "Check your workout values and try again.";
        }
        if (!current(id, entry)) return success;
        if (success) {
          if (kind === "start") {
            const session = document()?.sessions.find((value) => value.id === id);
            if (session) publish(entry, { session, error: null });
            // A card started from the day opens the Active workout's page; a page stays up.
            if (originToken === null) panels.leave(null, origin, { kind: "session", id });
          } else {
            entries.delete(id);
            panels.leave(originToken, origin);
            emit();
          }
        } else
          publish(entry, {
            error:
              error ??
              entry.state.error ??
              (kind === "start"
                ? "Couldn't start. Another workout may already be active. Try again."
                : saveFailure),
          });
        return success;
      });
    }
    return {
      getSnapshot: () => entry.state,
      subscribe,
      change,
      run,
      select(rowId: string) {
        if (current(id, entry) && entry.state.selectedId !== rowId)
          publish(entry, { selectedId: rowId });
      },
      showSettings(open: boolean) {
        if (current(id, entry) && entry.state.settingsOpen !== open)
          publish(entry, { settingsOpen: open });
      },
    };
  }
  return { subscribe, refreshDocument, edit, depart };
}
export type WorkoutEditing = ReturnType<typeof createWorkoutEditing>;
export type WorkoutEdit = ReturnType<WorkoutEditing["edit"]>;

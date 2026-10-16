import { createWorkoutImportFlow, type WorkoutImportFlowSource } from "./import/import-flow.ts";
import type { ExerciseDefinition, WorkoutTemplate } from "./model.ts";
import type { createExercisePersistence } from "./persistence.ts";
import type { WorkoutPanel, WorkoutView } from "./workout-editing.ts";
import { createWorkoutTemplateDraft, type WorkoutTemplateDraft } from "./workout-template-draft.ts";

type ExerciseValues = Omit<ExerciseDefinition, "id">;
/** The panel's pending save or removal and the feedback of its last failure. */
type Attempt = { busy: boolean; error: string | null };
type ExerciseDraftState = Attempt & { values: ExerciseValues };
type TemplateDraftState = Attempt & { draft: WorkoutTemplateDraft };
type SavedWorkoutsState = Attempt;
type Store = Pick<
  ReturnType<typeof createExercisePersistence>,
  | "saveExercise"
  | "removeExercise"
  | "saveWorkout"
  | "removeWorkout"
  | "planWorkout"
  | "removeSession"
  | "importWorkoutPlan"
>;
/** The Exercise tab's panels, which library drafts close or hand over once they succeed. */
type Panels = {
  getSnapshot(): { panel: WorkoutPanel | null };
  subscribe(listener: () => void): () => void;
  closeView(token: number): void;
  replaceView(token: number, content: WorkoutView): void;
};
type Entry =
  | { kind: "exercise"; state: ExerciseDraftState }
  | { kind: "template"; state: TemplateDraftState }
  | { kind: "saved-workouts"; state: SavedWorkoutsState }
  | { kind: "import"; flow: ReturnType<typeof createWorkoutImportFlow> };

const failures = {
  saveExercise: "Couldn't save. Enter an exercise name and try again; your fields are still here.",
  removeExercise: "Couldn't delete this exercise. Try again.",
  saveWorkout: "Couldn't save. Enter a workout name, choose at least one exercise, and try again.",
  removeWorkout: "Couldn't delete this workout. Try again.",
  plan: "Couldn't add this workout. Try again.",
  removeLog: "Couldn't delete this workout. Try again.",
};

/**
 * Owns the unfinished input of the Exercise tab's library panels: an Exercise definition edit, a
 * Workout template draft, the Saved workouts actions and a Workout import. Each belongs to the
 * panel that opened it and outlives its form, so leaving the tab keeps it, and a save that
 * finishes while the form is away still closes that panel. Replacing or closing the panel
 * retires its draft; an older panel's late result cannot close a newer one.
 */
export function createLibraryDrafts({
  store,
  panels,
  importSources,
}: {
  store: Store;
  panels: Panels;
  importSources: readonly WorkoutImportFlowSource[];
}) {
  const entries = new Map<number, Entry>(),
    listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  function publish<State extends Attempt>(entry: { state: State }, patch: Partial<State>) {
    entry.state = { ...entry.state, ...patch };
    for (const listener of listeners) listener();
  }
  // Drafts follow the open panel: once it closes or changes, its draft is gone.
  panels.subscribe(() => {
    const token = panels.getSnapshot().panel?.token;
    for (const [owner, entry] of entries) {
      if (owner === token) continue;
      entries.delete(owner);
      if (entry.kind === "import") entry.flow.stop();
    }
  });
  function entryFor<Kind extends Entry["kind"]>(
    token: number,
    kind: Kind,
    create: () => Extract<Entry, { kind: Kind }>,
  ): Extract<Entry, { kind: Kind }> {
    const existing = entries.get(token);
    if (existing?.kind === kind) return existing as Extract<Entry, { kind: Kind }>;
    const entry = create();
    // Only the open panel keeps a draft.
    if (panels.getSnapshot().panel?.token === token) entries.set(token, entry);
    return entry;
  }
  /** Runs one durable save or removal at a time. Only its success leaves the panel. */
  async function attempt<Value>(
    entry: { state: Attempt },
    work: () => Promise<Value | null | false>,
    failure: string,
    onSuccess: (value: Value) => void,
  ): Promise<boolean> {
    if (entry.state.busy) return false;
    publish(entry, { busy: true, error: null });
    let value: Value | null | false = null;
    try {
      value = await work();
    } catch {
      value = null;
    }
    publish(entry, { busy: false, error: value ? null : failure });
    if (!value) return false;
    onSuccess(value);
    return true;
  }
  return {
    /** Creating or editing an Exercise definition; success leaves for the panel's return view. */
    exercise(token: number, exercise?: ExerciseDefinition) {
      const entry = entryFor(token, "exercise", () => ({
        kind: "exercise",
        state: {
          values: exercise
            ? { ...exercise }
            : { name: "", muscleGroup: "", equipment: "", notes: "", tracking: "single" },
          busy: false,
          error: null,
        },
      }));
      return {
        getSnapshot: () => entry.state,
        subscribe,
        change(update: (values: ExerciseValues) => ExerciseValues) {
          if (!entry.state.busy) publish(entry, { values: update(entry.state.values) });
        },
        save: () =>
          attempt(
            entry,
            () => store.saveExercise({ ...entry.state.values, id: exercise?.id }),
            failures.saveExercise,
            () => panels.closeView(token),
          ),
        remove: () =>
          exercise
            ? attempt(
                entry,
                () => store.removeExercise(exercise.id),
                failures.removeExercise,
                () => panels.closeView(token),
              )
            : Promise.resolve(false),
      };
    },
    /** Creating or editing a Workout template; success closes the panel. */
    template(token: number, workout?: WorkoutTemplate) {
      const entry = entryFor(token, "template", () => ({
        kind: "template",
        state: { draft: createWorkoutTemplateDraft(workout), busy: false, error: null },
      }));
      return {
        getSnapshot: () => entry.state,
        subscribe,
        change(update: (draft: WorkoutTemplateDraft) => WorkoutTemplateDraft) {
          if (!entry.state.busy) publish(entry, { draft: update(entry.state.draft) });
        },
        async save() {
          if (entry.state.busy) return false;
          const preparation = entry.state.draft.prepare();
          if (preparation.kind === "invalid") {
            publish(entry, { error: preparation.message });
            return false;
          }
          return attempt(
            entry,
            () => store.saveWorkout(preparation.input),
            failures.saveWorkout,
            () => panels.closeView(token),
          );
        },
        remove: () =>
          workout
            ? attempt(
                entry,
                () => store.removeWorkout(workout.id),
                failures.removeWorkout,
                () => panels.closeView(token),
              )
            : Promise.resolve(false),
      };
    },
    /** The Saved workouts menu for the day it opened on. */
    savedWorkouts(token: number, date: string) {
      const entry = entryFor(token, "saved-workouts", () => ({
        kind: "saved-workouts",
        state: { busy: false, error: null },
      }));
      return {
        getSnapshot: () => entry.state,
        subscribe,
        /** Adds a Workout log of the template to the menu's day, then opens it. */
        plan: (workoutId: string) =>
          attempt(
            entry,
            () => store.planWorkout({ date, workoutId }),
            failures.plan,
            (id) => panels.replaceView(token, { kind: "session", id }),
          ),
        removeLog: (id: string) =>
          attempt(
            entry,
            () => store.removeSession(id),
            failures.removeLog,
            () => {},
          ),
      };
    },
    /** The import journey, which keeps its step, link and pending save while the tab is away. */
    workoutImport(token: number, initialSource?: string) {
      return entryFor(token, "import", () => ({
        kind: "import",
        flow: createWorkoutImportFlow({
          sources: importSources,
          initialSource,
          importPlan: (plan) => store.importWorkoutPlan(plan),
        }),
      })).flow;
    },
  };
}
export type LibraryDrafts = ReturnType<typeof createLibraryDrafts>;

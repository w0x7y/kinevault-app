import type { CatalogExercise } from "./demo/catalog.ts";
import {
  applyCatalogLink,
  demoPicker,
  initialDemoPicker,
  withoutCatalogLink,
  type DemoPicker,
  type DemoPickerEvent,
} from "./demo/demo-link.ts";
import { createWorkoutImportFlow, type WorkoutImportFlowSource } from "./import/import-flow.ts";
import {
  exerciseResultPage as resultPage,
  matchingExercises,
  type ExerciseDefinition,
  type ExerciseDocument,
  type WorkoutSession,
  type WorkoutTemplate,
} from "./model.ts";
import { writeFailure, type createExercisePersistence, type ExerciseWrite } from "./persistence.ts";
import type { ExercisePanels } from "./tab-view.ts";
import { createWorkoutTemplateDraft, type WorkoutTemplateDraft } from "./workout-template-draft.ts";

type ExerciseValues = Omit<ExerciseDefinition, "id">;
/** The panel's pending save or removal and the feedback of its last failure. */
type Attempt = { busy: boolean; error: string | null };
type ExerciseDraftState = Attempt & { values: ExerciseValues; demo: DemoPicker };
type TemplateDraftState = Attempt & {
  draft: WorkoutTemplateDraft;
  /** The exercise on screen. */
  selectedId: string | undefined;
  /** Whether the name and exercises builder shows. */
  settingsOpen: boolean;
  /** The builder's exercise search. */
  query: string;
  /** How many search results show; a new search starts over. */
  limit: number;
  /** The exercise whose notes show. */
  notesId: string | null;
};
/** The template builder's search: the results on this page, whether more follow, and why none show. */
type TemplateResults = {
  items: ExerciseDefinition[];
  more: boolean;
  message: string | null;
};
type TemplateDraftSnapshot = Readonly<
  TemplateDraftState & {
    /** The exercise row on screen: the selected one, or the first. */
    selected: WorkoutTemplateDraft["rows"][number] | undefined;
    results: TemplateResults;
  }
>;
type SavedWorkoutsState = Attempt;
type SavedWorkoutsSnapshot = Readonly<
  SavedWorkoutsState & {
    /** The library's Workout templates. */
    workouts: readonly WorkoutTemplate[];
    /** The menu day's Workout logs. */
    logs: readonly WorkoutSession[];
  }
>;
type Store = Pick<
  ReturnType<typeof createExercisePersistence>,
  | "saveExercise"
  | "removeExercise"
  | "saveWorkout"
  | "removeWorkout"
  | "planWorkout"
  | "removeSession"
  | "importWorkoutPlan"
  | "getSnapshot"
>;
/** The Exercise tab's panels, which library drafts close or hand over once they succeed. */
type Panels = Pick<ExercisePanels, "panel" | "subscribe" | "closeView" | "replaceView">;
type Entry =
  | { kind: "exercise"; state: ExerciseDraftState }
  | {
      kind: "template";
      state: TemplateDraftState;
      /** The last snapshot, with the state and library it shows. */
      view?: {
        state: TemplateDraftState;
        exercises: readonly ExerciseDefinition[];
        snapshot: TemplateDraftSnapshot;
      };
    }
  | {
      kind: "saved-workouts";
      state: SavedWorkoutsState;
      /** The last snapshot, with the state and document it shows. */
      view?: {
        state: SavedWorkoutsState;
        document: ExerciseDocument | null;
        snapshot: SavedWorkoutsSnapshot;
      };
    }
  | { kind: "import"; flow: ReturnType<typeof createWorkoutImportFlow> };

function templateResults(
  library: readonly ExerciseDefinition[],
  { draft, query, limit }: TemplateDraftState,
): TemplateResults {
  // Exercises already in the template don't show again.
  const available = matchingExercises(library, query).filter(
    (item) => !draft.rows.some((row) => row.id === item.id),
  );
  return {
    items: available.slice(0, limit),
    more: available.length > limit,
    message:
      library.length === 0
        ? "Create an exercise first, then return to build your workout."
        : !query.trim()
          ? "Search by name, muscle group, equipment, or notes to add exercises."
          : available.length === 0
            ? "No available exercises match your search."
            : null,
  };
}

/** Each write's lead, followed by its command's reason or, when storage couldn't take it, a retry. */
const failures = {
  saveExercise: ["Couldn't save.", "Try again; your fields are still here."],
  removeExercise: ["Couldn't delete this exercise.", "Try again."],
  saveWorkout: ["Couldn't save.", "Try again; your fields are still here."],
  removeWorkout: ["Couldn't delete this workout.", "Try again."],
  plan: ["Couldn't add this workout.", "Try again."],
  removeLog: ["Couldn't delete this workout.", "Try again."],
} as const;

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
  const document = () => {
    const state = store.getSnapshot().state;
    return state.kind === "ready" ? state.document : null;
  };
  const library = () => document()?.exercises ?? [];
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
    const token = panels.panel()?.token;
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
    if (panels.panel()?.token === token) entries.set(token, entry);
    return entry;
  }
  /** Runs one durable save or removal at a time. Only its success leaves the panel. */
  async function attempt<Value>(
    entry: { state: Attempt },
    work: () => Promise<ExerciseWrite<Value>>,
    [lead, retry]: readonly [string, string],
    onSuccess: (value: Value) => void,
  ): Promise<boolean> {
    if (entry.state.busy) return false;
    publish(entry, { busy: true, error: null });
    let result: ExerciseWrite<Value>;
    try {
      result = await work();
    } catch {
      result = { kind: "unavailable" };
    }
    publish(entry, {
      busy: false,
      error: result.kind === "saved" ? null : writeFailure(result, lead, retry),
    });
    if (result.kind !== "saved") return false;
    onSuccess(result.value);
    return true;
  }
  return {
    /**
     * Creating or editing an Exercise definition; success leaves for the panel's return view.
     * `linkDemo` (from "Link demo") focuses the KineVault search.
     */
    exercise(token: number, exercise?: ExerciseDefinition, linkDemo = false) {
      const entry = entryFor(token, "exercise", () => ({
        kind: "exercise",
        state: {
          values: exercise
            ? { ...exercise }
            : { name: "", muscleGroup: "", equipment: "", notes: "", tracking: "single" },
          demo: initialDemoPicker(linkDemo),
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
        pickDemo: (event: Exclude<DemoPickerEvent, "linked" | "unlink">) =>
          publish(entry, { demo: demoPicker(entry.state.demo, event) }),
        /** Links a KineVault demo, filling blank fields from it, and shows it with its Change button. */
        linkCatalog(catalog: CatalogExercise) {
          if (entry.state.busy) return;
          publish(entry, {
            values: applyCatalogLink(entry.state.values, catalog),
            demo: demoPicker(entry.state.demo, "linked"),
          });
        },
        /** Removes the linked demo and gives way to the search. */
        unlinkCatalog() {
          if (entry.state.busy) return;
          publish(entry, {
            values: withoutCatalogLink(entry.state.values),
            demo: demoPicker(entry.state.demo, "unlink"),
          });
        },
        save: () =>
          attempt(
            entry,
            () => store.saveExercise({ ...entry.state.values, id: exercise?.id }),
            failures.saveExercise,
            (id) => panels.closeView(token, id),
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
        state: {
          draft: createWorkoutTemplateDraft(workout),
          busy: false,
          error: null,
          // A new template opens on its builder; a saved one on its first exercise.
          selectedId: workout?.exercises[0]?.id,
          settingsOpen: !workout,
          query: "",
          limit: resultPage,
          notesId: null,
        },
      }));
      return {
        // The snapshot is rebuilt when the draft or the library changes, not for each handle.
        getSnapshot(): TemplateDraftSnapshot {
          const { state, view } = entry,
            exercises = library();
          if (view?.state === state && view.exercises === exercises) return view.snapshot;
          const { rows } = state.draft;
          const snapshot = {
            ...state,
            selected: rows.find((row) => row.id === state.selectedId) ?? rows[0],
            results: templateResults(exercises, state),
          };
          entry.view = { state, exercises, snapshot };
          return snapshot;
        },
        subscribe,
        change(update: (draft: WorkoutTemplateDraft) => WorkoutTemplateDraft) {
          if (!entry.state.busy) publish(entry, { draft: update(entry.state.draft) });
        },
        /** Appends a search result to the order and shows it. */
        add(exercise: ExerciseDefinition) {
          if (!entry.state.busy)
            publish(entry, { draft: entry.state.draft.add(exercise), selectedId: exercise.id });
        },
        select: (selectedId: string) => publish(entry, { selectedId }),
        showSettings: (settingsOpen: boolean) => publish(entry, { settingsOpen }),
        search: (query: string) => publish(entry, { query, limit: resultPage }),
        showMore: () => publish(entry, { limit: entry.state.limit + resultPage }),
        showNotes: (notesId: string | null) => publish(entry, { notesId }),
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
        // Rebuilt when the attempt or the saved document changes.
        getSnapshot(): SavedWorkoutsSnapshot {
          const { state, view } = entry,
            saved = document();
          if (view?.state === state && view.document === saved) return view.snapshot;
          const snapshot = {
            ...state,
            workouts: saved?.workouts ?? [],
            logs: saved?.sessions.filter((session) => session.date === date) ?? [],
          };
          entry.view = { state, document: saved, snapshot };
          return snapshot;
        },
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

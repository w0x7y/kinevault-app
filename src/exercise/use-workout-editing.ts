import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { workoutImportSources } from "./import/sources";
import { createLibraryDrafts } from "./library-drafts";
import { useExercises } from "./provider";
import { createWorkoutEditing, type WorkoutEditing } from "./workout-editing";

/** The Exercise tab's panels with their Workout edits and library drafts. */
export function useWorkoutEditing() {
  const store = useExercises(),
    storeRef = useRef(store);
  storeRef.current = store;
  const [{ editing, drafts }] = useState(() => {
    const editing = createWorkoutEditing({
      getSnapshot: () => storeRef.current,
      updateSession: (input) => storeRef.current.updateSession(input),
      startSession: (id) => storeRef.current.startSession(id),
      completeSession: (input) => storeRef.current.completeSession(input),
      removeSession: (id) => storeRef.current.removeSession(id),
    });
    const drafts = createLibraryDrafts({
      store: {
        saveExercise: (input) => storeRef.current.saveExercise(input),
        removeExercise: (id) => storeRef.current.removeExercise(id),
        saveWorkout: (input) => storeRef.current.saveWorkout(input),
        removeWorkout: (id) => storeRef.current.removeWorkout(id),
        planWorkout: (input) => storeRef.current.planWorkout(input),
        removeSession: (id) => storeRef.current.removeSession(id),
        importWorkoutPlan: (plan) => storeRef.current.importWorkoutPlan(plan),
      },
      panels: editing,
      importSources: workoutImportSources,
    });
    return { editing, drafts };
  });
  const state = useSyncExternalStore(editing.subscribe, editing.getSnapshot, editing.getSnapshot);
  const document = store.state.kind === "ready" ? store.state.document : null;
  useLayoutEffect(() => {
    editing.refreshDocument();
  }, [editing, document]);
  useEffect(() => {
    editing.resume();
    return editing.suspend;
  }, [editing]);
  return { editing, drafts, panel: state.panel };
}

export function useWorkoutEdit(editing: WorkoutEditing, id: string) {
  const edit = editing.edit(id);
  const state = useSyncExternalStore(edit.subscribe, edit.getSnapshot, edit.getSnapshot);
  return { edit, ...state };
}

/** Renders a library draft handle's current state. */
export function useLibraryDraft<State>(draft: {
  getSnapshot: () => State;
  subscribe: (listener: () => void) => () => void;
}) {
  return useSyncExternalStore(draft.subscribe, draft.getSnapshot, draft.getSnapshot);
}

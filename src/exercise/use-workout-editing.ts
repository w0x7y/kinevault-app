import { useIsFocused } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { workoutImportSources } from "./import/sources";
import { useExercises } from "./provider";
import { createExerciseTabView } from "./tab-view";
import type { WorkoutEditing } from "./workout-editing";

/** The Exercise tab view for the Selected day, with its Workout edits and Library drafts. */
export function useExerciseTabView(date: string) {
  const store = useExercises(),
    storeRef = useRef(store);
  storeRef.current = store;
  const [tab] = useState(() =>
    createExerciseTabView({
      store: {
        getSnapshot: () => storeRef.current,
        updateSession: (input) => storeRef.current.updateSession(input),
        startSession: (id) => storeRef.current.startSession(id),
        completeSession: (input) => storeRef.current.completeSession(input),
        removeSession: (id) => storeRef.current.removeSession(id),
        saveExercise: (input) => storeRef.current.saveExercise(input),
        removeExercise: (id) => storeRef.current.removeExercise(id),
        saveWorkout: (input) => storeRef.current.saveWorkout(input),
        removeWorkout: (id) => storeRef.current.removeWorkout(id),
        planWorkout: (input) => storeRef.current.planWorkout(input),
        importWorkoutPlan: (plan) => storeRef.current.importWorkoutPlan(plan),
      },
      date,
      importSources: workoutImportSources,
    }),
  );
  const view = useSyncExternalStore(tab.subscribe, tab.getSnapshot, tab.getSnapshot);
  const focused = useIsFocused();
  useLayoutEffect(() => {
    tab.refreshDocument();
  }, [tab, store.state]);
  useLayoutEffect(() => tab.setDay(date), [tab, date]);
  useLayoutEffect(() => tab.setFocused(focused), [tab, focused]);
  useEffect(() => {
    tab.start();
    return tab.stop;
  }, [tab]);
  return { tab, view };
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

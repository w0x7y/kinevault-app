import { useIsFocused } from "expo-router";
import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { workoutImportSources } from "./import/sources";
import { useExercisePersistence } from "./provider";
import { createExerciseTabView } from "./tab-view";
import type { WorkoutEditing } from "./workout-editing";

/** The Exercise tab view for the Selected day, with its Workout edits and Library drafts. */
export function useExerciseTabView(date: string) {
  const store = useExercisePersistence();
  const [tab] = useState(() =>
    createExerciseTabView({ store, date, importSources: workoutImportSources }),
  );
  const view = useSyncExternalStore(tab.subscribe, tab.getSnapshot, tab.getSnapshot);
  const focused = useIsFocused();
  useLayoutEffect(() => {
    tab.start();
    return tab.stop;
  }, [tab]);
  useLayoutEffect(() => tab.setDay(date), [tab, date]);
  useLayoutEffect(() => tab.setFocused(focused), [tab, focused]);
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

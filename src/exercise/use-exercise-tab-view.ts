import { useIsFocused } from "expo-router";
import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { Vibration } from "react-native";
import { workoutImportSources } from "./import/sources";
import { useExercisePersistence } from "./provider";
import { createExerciseTabView } from "./tab-view";

/** The Exercise tab view for the Selected day, with its Workout edits and Library drafts. */
export function useExerciseTabView(date: string) {
  const store = useExercisePersistence();
  const [tab] = useState(() =>
    createExerciseTabView({
      store,
      date,
      importSources: workoutImportSources,
      // A countdown that runs out buzzes, whichever page shows.
      clocks: { onCountdownEnd: () => Vibration.vibrate() },
    }),
  );
  const view = useSnapshot(tab);
  const focused = useIsFocused();
  useLayoutEffect(() => {
    tab.start();
    return tab.stop;
  }, [tab]);
  useLayoutEffect(() => tab.setDay(date), [tab, date]);
  useLayoutEffect(() => tab.setFocused(focused), [tab, focused]);
  return { tab, view };
}

/** Renders the current snapshot of a Workout edit, Library draft or other observable owner. */
export function useSnapshot<State>(owner: {
  getSnapshot: () => State;
  subscribe: (listener: () => void) => () => void;
}) {
  return useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
}

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useExercises } from "./provider";
import { createWorkoutEditing, type WorkoutEditing } from "./workout-editing";

export function useWorkoutEditing() {
  const store = useExercises(),
    storeRef = useRef(store);
  storeRef.current = store;
  const [editing] = useState(() =>
    createWorkoutEditing({
      getSnapshot: () => storeRef.current,
      updateSession: (input) => storeRef.current.updateSession(input),
      startSession: (id) => storeRef.current.startSession(id),
      completeSession: (input) => storeRef.current.completeSession(input),
      removeSession: (id) => storeRef.current.removeSession(id),
    }),
  );
  const state = useSyncExternalStore(editing.subscribe, editing.getSnapshot, editing.getSnapshot);
  const document = store.state.kind === "ready" ? store.state.document : null;
  useLayoutEffect(() => {
    editing.refreshDocument();
  }, [editing, document]);
  useEffect(() => {
    editing.resume();
    return editing.suspend;
  }, [editing]);
  return { editing, panel: state.panel };
}

export function useWorkoutEdit(editing: WorkoutEditing, id: string) {
  const edit = editing.edit(id);
  const state = useSyncExternalStore(edit.subscribe, edit.getSnapshot, edit.getSnapshot);
  return { edit, ...state };
}

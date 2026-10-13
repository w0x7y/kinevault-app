import { useEffect, useState, useSyncExternalStore } from "react";
import { createWaterGoalEdit } from "./goal-editing";
import { useWaterGoalPersistence } from "./goal-provider";

export function useWaterGoalEdit() {
  const goal = useWaterGoalPersistence();
  const [edit] = useState(() => createWaterGoalEdit(goal));
  const snapshot = useSyncExternalStore(edit.subscribe, edit.getSnapshot, edit.getSnapshot);
  useEffect(() => {
    edit.start();
    return edit.stop;
  }, [edit]);
  return { edit, ...snapshot };
}

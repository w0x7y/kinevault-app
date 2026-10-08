import { useEffect, useState, useSyncExternalStore } from "react";
import { useProfilePersistence } from "./provider";
import { createWeightEdit } from "./weight-editing";

export function useWeightEdit() {
  const profile = useProfilePersistence();
  const [edit] = useState(() => createWeightEdit(profile));
  const snapshot = useSyncExternalStore(edit.subscribe, edit.getSnapshot, edit.getSnapshot);
  useEffect(() => {
    edit.start();
    return edit.stop;
  }, [edit]);
  return { edit, ...snapshot };
}

import { useEffect, useState, useSyncExternalStore } from "react";
import { createManualWaterEdit } from "./manual-editing";
import { useWaterLogPersistence } from "./provider";

// The edit keeps the date from its first render; remount it to edit another day.
export function useManualWaterEdit(date: string) {
  const log = useWaterLogPersistence();
  const [edit] = useState(() => createManualWaterEdit({ log, date }));
  const snapshot = useSyncExternalStore(edit.subscribe, edit.getSnapshot, edit.getSnapshot);
  useEffect(() => {
    edit.start();
    return edit.stop;
  }, [edit]);
  return { edit, ...snapshot };
}

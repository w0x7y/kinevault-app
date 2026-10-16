import { useEffect, useState, useSyncExternalStore } from "react";

type Mountable = {
  getSnapshot(): object;
  subscribe(listener: () => void): () => void;
  start(): void;
  stop(): void;
};

// The React adapter for an edit: it lives as long as the component that created it.
// Remount the component (for example with a key) to start another edit.
export function useDocumentEdit<Edit extends Mountable>(create: () => Edit) {
  const [edit] = useState(create);
  const snapshot = useSyncExternalStore(edit.subscribe, edit.getSnapshot, edit.getSnapshot);
  useEffect(() => {
    edit.start();
    return edit.stop;
  }, [edit]);
  return { ...(snapshot as ReturnType<Edit["getSnapshot"]>), edit };
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { createExercisePersistence, type ExerciseSnapshot } from "./persistence";

type ExerciseStore = ReturnType<typeof createExercisePersistence>;
type ExerciseContextValue = ExerciseSnapshot & Omit<ExerciseStore, "getSnapshot" | "subscribe" | "start" | "stop">;
const ExerciseContext = createContext<ExerciseContextValue | null>(null);

export function ExerciseProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => {
    let sequence = 0;
    return createExercisePersistence({ storage: AsyncStorage,
      createId: () => `${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}`, now: Date.now });
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { store.start(); return store.stop; }, [store]);
  const { getSnapshot: _getSnapshot, subscribe: _subscribe, start: _start, stop: _stop, ...commands } = store;
  return <ExerciseContext.Provider value={{ ...snapshot, ...commands }}>{children}</ExerciseContext.Provider>;
}
export function useExercises() {
  const context = useContext(ExerciseContext);
  if (!context) throw new Error("useExercises must be used inside ExerciseProvider");
  return context;
}

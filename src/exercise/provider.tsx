import { useAccountStorage } from "../account/storage-context";
import { useAccount } from "../account/provider";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { createExercisePersistence, type ExerciseSnapshot } from "./persistence";

type ExerciseStore = ReturnType<typeof createExercisePersistence>;
type ExerciseContextValue = ExerciseSnapshot &
  Omit<ExerciseStore, "getSnapshot" | "subscribe" | "start" | "stop" | "seedDevelopmentExamples">;
const ExerciseContext = createContext<ExerciseContextValue | null>(null);

export function ExerciseProvider({ children }: PropsWithChildren) {
  const storage = useAccountStorage();
  const { user } = useAccount();
  const [store] = useState(() => {
    let sequence = 0;
    return createExercisePersistence({
      storage,
      development: __DEV__ && !user,
      createId: () =>
        `${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}`,
      now: Date.now,
    });
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.start();
    return store.stop;
  }, [store]);
  const seedDocument = snapshot.state.kind === "ready" ? snapshot.state.document : null;
  useEffect(() => {
    if (__DEV__ && !user && seedDocument && !seedDocument.developmentExamplesSeeded)
      void store.seedDevelopmentExamples();
  }, [store, seedDocument, user]);
  const {
    getSnapshot: _getSnapshot,
    subscribe: _subscribe,
    start: _start,
    stop: _stop,
    seedDevelopmentExamples: _seedDevelopmentExamples,
    ...commands
  } = store;
  return (
    <ExerciseContext.Provider value={{ ...snapshot, ...commands }}>
      {children}
    </ExerciseContext.Provider>
  );
}
export function useExercises() {
  const context = useContext(ExerciseContext);
  if (!context) throw new Error("useExercises must be used inside ExerciseProvider");
  return context;
}

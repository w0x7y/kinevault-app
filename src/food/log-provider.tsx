import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { foodDatabase } from "./database";
import { createFoodLogPersistence, type FoodLogSnapshot } from "./log-persistence";

type FoodLogStore = ReturnType<typeof createFoodLogPersistence>;
type FoodLogContextValue = FoodLogSnapshot & Pick<FoodLogStore, "add" | "edit" | "remove" | "retryLoad">;
const FoodLogContext = createContext<FoodLogContextValue | null>(null);

export function FoodLogProvider({ children }: PropsWithChildren) {
  const [log] = useState(() => {
    let sequence = 0;
    return createFoodLogPersistence({
      storage: AsyncStorage,
      findFood: foodDatabase.getById,
      createId: () => `${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}`,
    });
  });
  const snapshot = useSyncExternalStore(log.subscribe, log.getSnapshot, log.getSnapshot);
  useEffect(() => { log.start(); return log.stop; }, [log]);
  return <FoodLogContext.Provider value={{ ...snapshot, add: log.add, edit: log.edit, remove: log.remove, retryLoad: log.retryLoad }}>{children}</FoodLogContext.Provider>;
}

export function useFoodLog() {
  const value = useContext(FoodLogContext);
  if (!value) throw new Error("useFoodLog must be used inside FoodLogProvider");
  return value;
}

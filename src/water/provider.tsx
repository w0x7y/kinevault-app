import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { createWaterLogPersistence, type WaterLogSnapshot } from "./persistence";

type WaterLogStore = ReturnType<typeof createWaterLogPersistence>;
type WaterLogContextValue = WaterLogSnapshot & Pick<WaterLogStore, "set" | "retryLoad">;
const WaterLogContext = createContext<WaterLogContextValue | null>(null);

export function WaterLogProvider({ children }: PropsWithChildren) {
  const [log] = useState(() => createWaterLogPersistence({ storage: AsyncStorage }));
  const snapshot = useSyncExternalStore(log.subscribe, log.getSnapshot, log.getSnapshot);
  useEffect(() => { log.start(); return log.stop; }, [log]);
  return <WaterLogContext.Provider value={{ ...snapshot, set: log.set, retryLoad: log.retryLoad }}>{children}</WaterLogContext.Provider>;
}

export function useWaterLog() {
  const value = useContext(WaterLogContext);
  if (!value) throw new Error("useWaterLog must be used inside WaterLogProvider");
  return value;
}

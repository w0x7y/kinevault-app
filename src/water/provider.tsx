import { useAccountStorage } from "../account/storage-context";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { createWaterLogPersistence, type WaterLogSnapshot } from "./persistence";

type WaterLogStore = ReturnType<typeof createWaterLogPersistence>;
type WaterLogContextValue = WaterLogSnapshot & Pick<WaterLogStore, "retryLoad">;
const WaterLogContext = createContext<WaterLogContextValue | null>(null);
const WaterLogPersistenceContext = createContext<WaterLogStore | null>(null);

export function WaterLogProvider({ children }: PropsWithChildren) {
  const storage = useAccountStorage();
  const [log] = useState(() => createWaterLogPersistence({ storage }));
  const snapshot = useSyncExternalStore(log.subscribe, log.getSnapshot, log.getSnapshot);
  useEffect(() => {
    log.start();
    return log.stop;
  }, [log]);
  return (
    <WaterLogPersistenceContext.Provider value={log}>
      <WaterLogContext.Provider value={{ ...snapshot, retryLoad: log.retryLoad }}>
        {children}
      </WaterLogContext.Provider>
    </WaterLogPersistenceContext.Provider>
  );
}

export function useWaterLogPersistence() {
  const value = useContext(WaterLogPersistenceContext);
  if (!value) throw new Error("useWaterLogPersistence must be used inside WaterLogProvider");
  return value;
}

export function useWaterLog() {
  const value = useContext(WaterLogContext);
  if (!value) throw new Error("useWaterLog must be used inside WaterLogProvider");
  return value;
}

import { useAccountStorage } from "../account/storage-context";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { createWaterGoalPersistence, type WaterGoalSnapshot } from "./goal-persistence";

type WaterGoalStore = ReturnType<typeof createWaterGoalPersistence>;
type WaterGoalContextValue = WaterGoalSnapshot & Pick<WaterGoalStore, "setGoal" | "retryLoad">;
const WaterGoalContext = createContext<WaterGoalContextValue | null>(null);

export function WaterGoalProvider({ children }: PropsWithChildren) {
  const storage = useAccountStorage();
  const [goal] = useState(() => createWaterGoalPersistence({ storage }));
  const snapshot = useSyncExternalStore(goal.subscribe, goal.getSnapshot, goal.getSnapshot);
  useEffect(() => { goal.start(); return goal.stop; }, [goal]);
  return <WaterGoalContext.Provider value={{ ...snapshot, setGoal: goal.setGoal, retryLoad: goal.retryLoad }}>{children}</WaterGoalContext.Provider>;
}

export function useWaterGoal() {
  const value = useContext(WaterGoalContext);
  if (!value) throw new Error("useWaterGoal must be used inside WaterGoalProvider");
  return value;
}

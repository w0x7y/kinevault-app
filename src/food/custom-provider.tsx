import { useAccountStorage } from "../account/storage-context";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import data from "../../assets/food/usda-fndds.json";
import { createFoodSelection } from "./catalog-selection.ts";
import { createCustomFoodPersistence, type CustomFoodSnapshot } from "./custom-persistence.ts";

type Store = ReturnType<typeof createCustomFoodPersistence>;
type Value = CustomFoodSnapshot & Pick<Store, "add" | "addMeal" | "updateFood" | "updateMeal" | "remove" | "retryLoad" | "getSnapshot"> & {
  selection: ReturnType<typeof createFoodSelection>;
};
const CustomFoodContext = createContext<Value | null>(null);

export function CustomFoodProvider({ children }: PropsWithChildren) {
  const storage = useAccountStorage();
  const [store] = useState(() => {
    let sequence = 0;
    return createCustomFoodPersistence({ storage,
      createId: () => `${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}` });
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const selection = useMemo(() => createFoodSelection({
    savedFoods: snapshot.state.kind === "ready" ? snapshot.state.document.foods : [],
    savedMeals: snapshot.state.kind === "ready" ? snapshot.state.document.meals : [],
    bundledFoods: data.foods,
  }), [snapshot.state]);
  useEffect(() => { store.start(); return store.stop; }, [store]);
  return <CustomFoodContext.Provider value={{ ...snapshot, selection, add: store.add, addMeal: store.addMeal,
    updateFood: store.updateFood, updateMeal: store.updateMeal, remove: store.remove, retryLoad: store.retryLoad, getSnapshot: store.getSnapshot }}>{children}</CustomFoodContext.Provider>;
}
export function useCustomFoods() {
  const value = useContext(CustomFoodContext);
  if (!value) throw new Error("useCustomFoods must be used inside CustomFoodProvider");
  return value;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import data from "../../assets/food/usda-fndds.json";
import { createFoodCatalog } from "./catalog.ts";
import { createCustomFoodPersistence, type CustomFoodSnapshot } from "./custom-persistence.ts";

type Store = ReturnType<typeof createCustomFoodPersistence>;
type Value = CustomFoodSnapshot & Pick<Store, "add" | "addMeal" | "updateFood" | "updateMeal" | "remove" | "retryLoad"> & {
  catalog: ReturnType<typeof createFoodCatalog>; mealCatalog: ReturnType<typeof createFoodCatalog>;
};
const CustomFoodContext = createContext<Value | null>(null);

export function CustomFoodProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => {
    let sequence = 0;
    return createCustomFoodPersistence({ storage: AsyncStorage,
      createId: () => `${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}` });
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const catalog = useMemo(() => createFoodCatalog([
    ...(snapshot.state.kind === "ready" ? snapshot.state.document.foods : []), ...data.foods,
  ]), [snapshot.state]);
  const mealCatalog = useMemo(() => createFoodCatalog(snapshot.state.kind === "ready" ? snapshot.state.document.meals : []), [snapshot.state]);
  useEffect(() => { store.start(); return store.stop; }, [store]);
  return <CustomFoodContext.Provider value={{ ...snapshot, catalog, mealCatalog, add: store.add, addMeal: store.addMeal,
    updateFood: store.updateFood, updateMeal: store.updateMeal, remove: store.remove, retryLoad: store.retryLoad }}>{children}</CustomFoodContext.Provider>;
}
export function useCustomFoods() {
  const value = useContext(CustomFoodContext);
  if (!value) throw new Error("useCustomFoods must be used inside CustomFoodProvider");
  return value;
}

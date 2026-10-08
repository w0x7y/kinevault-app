import NetInfo from "@react-native-community/netinfo";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { createConnectivityStore, type ConnectivityStore } from "./controller";

const ConnectivityContext = createContext<ConnectivityStore | null>(null);

export function ConnectivityProvider({ children }: PropsWithChildren) {
  const [store] = useState(createConnectivityStore);
  useEffect(() => {
    let active = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (active) store.update(state);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [store]);
  return <ConnectivityContext.Provider value={store}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivityStore() {
  const store = useContext(ConnectivityContext);
  if (!store) throw new Error("useConnectivityStore must be used inside ConnectivityProvider");
  return store;
}

export function useConnectivity() {
  const store = useConnectivityStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => "unknown" as const);
}

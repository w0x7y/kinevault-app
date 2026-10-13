import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { useConnectivity } from "../../connectivity/provider";
import { createDemoCatalogStore, type CatalogFetch, type DemoCatalogState } from "./catalog-store";
import { demoCatalogConfig } from "./config";

type DemoCatalogStore = ReturnType<typeof createDemoCatalogStore>;
const DemoCatalogContext = createContext<DemoCatalogStore | null>(null);

const catalogTimeoutMs = 15_000;
// The timer runs until the body is read; a stalled request would leave demos loading forever.
const fetchWithTimeout: CatalogFetch = async (url, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), catalogTimeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    // The store never reads the body of a failed response.
    if (!response.ok) clearTimeout(timer);
    return {
      ok: response.ok,
      json: async () => {
        try {
          return await response.json();
        } finally {
          clearTimeout(timer);
        }
      },
    };
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
};

export function DemoCatalogProvider({ children }: PropsWithChildren) {
  const connectivity = useConnectivity();
  const [store] = useState(() =>
    createDemoCatalogStore({
      config: demoCatalogConfig,
      fetch: fetchWithTimeout,
      storage: AsyncStorage,
      now: Date.now,
    }),
  );
  useEffect(() => {
    void store.refreshIfStale();
  }, [store]);
  // A returning connection retries a failed first load or a stale copy.
  useEffect(() => {
    if (connectivity === "online") void store.refreshIfStale();
  }, [connectivity, store]);
  return <DemoCatalogContext.Provider value={store}>{children}</DemoCatalogContext.Provider>;
}

export function useDemoCatalog(): {
  state: DemoCatalogState;
  refreshIfStale: () => Promise<void>;
  retry: () => Promise<void>;
} {
  const store = useContext(DemoCatalogContext);
  if (!store) throw new Error("useDemoCatalog must be used inside DemoCatalogProvider");
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { state, refreshIfStale: store.refreshIfStale, retry: store.retry };
}

export type ConnectivityStatus = "unknown" | "offline" | "online";
export type ConnectivityReading = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

export function connectivityStatus(state: ConnectivityReading): ConnectivityStatus {
  if (state.isConnected === false || state.isInternetReachable === false) return "offline";
  if (state.isConnected === true && state.isInternetReachable === true) return "online";
  return "unknown";
}

export function createConnectivityStore() {
  let status: ConnectivityStatus = "unknown";
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(state: ConnectivityReading) {
      const next = connectivityStatus(state);
      if (status === next) return;
      status = next;
      listeners.forEach((listener) => listener());
    },
  };
}

export type ConnectivityStore = ReturnType<typeof createConnectivityStore>;

/** Account-owned listener; hydration and old owners cannot publish new work. */
export function attachReconnectRetry(
  store: ConnectivityStore,
  hydrated: Promise<unknown>,
  retry: () => Promise<unknown>,
) {
  let active = true;
  let ready = false;
  let previous = store.getSnapshot();
  let pending = false;
  const drain = () => {
    if (!active || !ready || !pending || store.getSnapshot() !== "online") return;
    pending = false;
    void retry().catch(() => {});
  };
  const unsubscribe = store.subscribe(() => {
    const status = store.getSnapshot();
    if (status === "online" && previous !== "online") pending = true;
    previous = status;
    drain();
  });
  void hydrated.then(
    () => {
      ready = true;
      drain();
    },
    () => {
      ready = true;
      drain();
    },
  );
  return () => {
    active = false;
    unsubscribe();
  };
}

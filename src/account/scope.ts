import { attachReconnectRetry, type ConnectivityStore } from "../connectivity/controller.ts";
import { profileStorageKey } from "../profile/persistence.ts";
import type { AccountStorage } from "./storage.ts";

export type AccountScopeState = "loading" | "ready" | "error";
export type AccountScopeStorage = Pick<
  AccountStorage,
  "start" | "stop" | "retry" | "getSnapshot" | "getItem"
>;

/**
 * Decides whether an Account's tracking may open. A failed sync blocks entry
 * only when this device holds no Profile for the Account; reconnecting retries
 * the sync and checks again. Each start is one attempt, and stop() keeps an
 * abandoned attempt from publishing late.
 */
export function createAccountScope({
  userId,
  storage,
  connectivity,
}: {
  userId: string | null;
  storage: AccountScopeStorage;
  connectivity: ConnectivityStore;
}) {
  let state: AccountScopeState = "loading";
  let attempt = 0;
  let stopReconnect: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: AccountScopeState) => {
    if (state === next) return;
    state = next;
    listeners.forEach((listener) => listener());
  };
  const scope = {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (stopReconnect) return;
      const ticket = ++attempt;
      const active = () => ticket === attempt;
      const finishLoading = async () => {
        if (!active()) return;
        if (
          userId &&
          storage.getSnapshot().error &&
          (await storage.getItem(profileStorageKey)) === null
        )
          throw new Error("No offline account profile");
        if (active()) publish("ready");
      };
      const hydrated = storage
        .start()
        .then(finishLoading)
        .catch(() => {
          if (active()) publish("error");
        });
      stopReconnect = attachReconnectRetry(connectivity, hydrated, async () => {
        if (!active() || !userId) return;
        await storage.retry();
        // A downloaded profile remains usable even if an unrelated upload failed.
        if (active()) await finishLoading();
      });
    },
    stop() {
      if (!stopReconnect) return;
      ++attempt;
      stopReconnect();
      stopReconnect = null;
      storage.stop();
    },
    /** Restarts storage from scratch, as a fresh attempt. */
    retry() {
      if (!stopReconnect) return;
      publish("loading");
      scope.stop();
      scope.start();
    },
  };
  return scope;
}

export type AccountScope = ReturnType<typeof createAccountScope>;

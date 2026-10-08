import type { Session } from "@supabase/supabase-js";

export type SessionBackend = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  exclusive?<T>(key: string, run: () => Promise<T>): Promise<T>;
  // Web storage can compare and remove synchronously, including replacements
  // written by another context that does not participate in our async queue.
  removeOwner?(key: string, ownerId: string, isCurrent: () => boolean): boolean;
};
type State = {
  queues: Map<string, Promise<unknown>>;
  listeners: Map<string, Set<(raw: string | null) => void>>;
  deletedOwners: Map<string, Set<string>>;
};
const states = new WeakMap<SessionBackend, State>();
export function persistedSession(raw: string | null): Session | null {
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("user" in value) ||
    !value.user ||
    typeof value.user !== "object" ||
    !("id" in value.user) ||
    typeof value.user.id !== "string" ||
    !("access_token" in value) ||
    typeof value.access_token !== "string" ||
    !("refresh_token" in value) ||
    typeof value.refresh_token !== "string"
  )
    throw new Error("Invalid persisted account session");
  return value as Session;
}
/** Every SDK storage mutation and owner-conditional deletion shares this queue. */
export function createOwnedSessionStorage(backend: SessionBackend) {
  let shared = states.get(backend);
  if (!shared)
    states.set(
      backend,
      (shared = { queues: new Map(), listeners: new Map(), deletedOwners: new Map() }),
    );
  const state = shared;
  function serial<T>(key: string, run: () => Promise<T>): Promise<T> {
    const work = (state.queues.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(() => (backend.exclusive ? backend.exclusive(key, run) : run()));
    state.queues.set(key, work);
    void work
      .finally(() => {
        if (state.queues.get(key) === work) state.queues.delete(key);
      })
      .catch(() => {});
    return work;
  }
  function notify(key: string, raw: string | null) {
    for (const listener of state.listeners.get(key) ?? []) listener(raw);
  }
  return {
    getItem: (key: string) => serial(key, () => backend.getItem(key)),
    setItem(key: string, value: string) {
      return serial(key, async () => {
        const retired = state.deletedOwners.get(key);
        if (retired?.size && retired.has(persistedSession(value)?.user.id ?? ""))
          throw new Error("This account has been deleted");
        await backend.setItem(key, value);
        notify(key, value);
      });
    },
    removeItem(key: string) {
      return serial(key, async () => {
        await backend.removeItem(key);
        notify(key, null);
      });
    },
    clearDeletedOwner(key: string, ownerId: string, isCurrent: () => boolean) {
      return serial(key, async () => {
        const retired = state.deletedOwners.get(key) ?? new Set<string>();
        retired.add(ownerId);
        state.deletedOwners.set(key, retired);
        if (!isCurrent()) return false;
        if (backend.removeOwner) {
          // No await between the web compare, physical removal and notification.
          const cleared = backend.removeOwner(key, ownerId, isCurrent);
          if (cleared) notify(key, null);
          else notify(key, await backend.getItem(key));
          return cleared;
        }
        const raw = await backend.getItem(key);
        if (!isCurrent()) return false;
        if (raw !== null && persistedSession(raw)?.user.id !== ownerId) {
          notify(key, raw);
          return false;
        }
        // Cooperative native SDK replacements cannot commit until this completes.
        await backend.removeItem(key);
        notify(key, null);
        return true;
      });
    },
    notifyExternal: notify,
    subscribeSession(key: string, listener: (raw: string | null) => void) {
      const listeners = state.listeners.get(key) ?? new Set();
      state.listeners.set(key, listeners);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) state.listeners.delete(key);
      };
    },
  };
}
export type OwnedSessionStorage = ReturnType<typeof createOwnedSessionStorage>;

/** Synchronous Web Storage compare/remove also protects non-cooperative contexts. */
export function createWebSessionBackend(
  getStorage: () => Pick<Storage, "getItem" | "setItem" | "removeItem"> | null,
  exclusive?: SessionBackend["exclusive"],
): SessionBackend {
  return {
    ...(exclusive ? { exclusive } : {}),
    async getItem(key) {
      return getStorage()?.getItem(key) ?? null;
    },
    async setItem(key, value) {
      getStorage()?.setItem(key, value);
    },
    async removeItem(key) {
      getStorage()?.removeItem(key);
    },
    removeOwner(key, ownerId, isCurrent) {
      if (!isCurrent()) return false;
      const storage = getStorage();
      const raw = storage?.getItem(key) ?? null;
      if (raw !== null && persistedSession(raw)?.user.id !== ownerId) return false;
      if (raw !== null && !exclusive)
        throw new Error(
          "This browser cannot coordinate account login clearing. Clear this site's storage.",
        );
      storage?.removeItem(key);
      return true;
    },
  };
}

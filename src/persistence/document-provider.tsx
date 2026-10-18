import {
  createContext,
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import type { AccountStorage } from "../account/storage";
import { useAccountStorage } from "../account/storage-context";

/** What a saved document's store offers the provider that mounts it. */
export type DocumentStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): object;
  start(): void;
  stop(): void;
  retryLoad(): void;
};
type SnapshotOf<Store extends DocumentStore> = ReturnType<Store["getSnapshot"]>;
type DefaultValue<Store extends DocumentStore> = SnapshotOf<Store> & Pick<Store, "retryLoad">;

type DocumentProvider<Store, Value> = {
  /** Creates the store once from the account scope's storage and runs it while mounted. */
  Provider: (props: PropsWithChildren) => ReactNode;
  /** The document as screens read it; re-renders on every snapshot. */
  useDocument(): Value;
  /** The store itself, for owners that write; never re-renders on its own. */
  useStore(): Store;
};

/**
 * One saved document per account scope. Without `useValue`, screens read the snapshot plus
 * `retryLoad`; `useValue` shapes that value instead and may run the document's own effects.
 */
export function createDocumentProvider<Store extends DocumentStore, Value extends object>(options: {
  name: string;
  create(storage: AccountStorage): Store;
  useValue(snapshot: SnapshotOf<Store>, store: Store): Value;
}): DocumentProvider<Store, Value>;
export function createDocumentProvider<Store extends DocumentStore>(options: {
  name: string;
  create(storage: AccountStorage): Store;
}): DocumentProvider<Store, DefaultValue<Store>>;
export function createDocumentProvider<Store extends DocumentStore, Value extends object>({
  name,
  create,
  useValue = (snapshot, store) => ({ ...snapshot, retryLoad: store.retryLoad }) as Value,
}: {
  name: string;
  create(storage: AccountStorage): Store;
  useValue?(snapshot: SnapshotOf<Store>, store: Store): Value;
}): DocumentProvider<Store, Value> {
  const ValueContext = createContext<Value | null>(null);
  const StoreContext = createContext<Store | null>(null);

  function Provider({ children }: PropsWithChildren) {
    const storage = useAccountStorage();
    const [store] = useState(() => create(storage));
    const snapshot = useSyncExternalStore(
      store.subscribe,
      store.getSnapshot,
      store.getSnapshot,
    ) as SnapshotOf<Store>;
    useEffect(() => {
      store.start();
      return store.stop;
    }, [store]);
    // Layouts above re-render on every navigation; an unchanged value spares every reader.
    const next = useValue(snapshot, store);
    const value = useRef(next);
    if (!sameFields(value.current, next)) value.current = next;
    return (
      <StoreContext.Provider value={store}>
        <ValueContext.Provider value={value.current}>{children}</ValueContext.Provider>
      </StoreContext.Provider>
    );
  }
  Provider.displayName = name;

  return {
    Provider: memo(Provider),
    useDocument() {
      const value = useContext(ValueContext);
      if (value === null) throw new Error(`This hook must be used inside ${name}`);
      return value;
    },
    useStore() {
      const store = useContext(StoreContext);
      if (!store) throw new Error(`This hook must be used inside ${name}`);
      return store;
    },
  };
}

/** Same own fields holding the same values, compared the way React compares props. */
function sameFields(a: object, b: object): boolean {
  const fields = Object.entries(a);
  return (
    fields.length === Object.keys(b).length &&
    fields.every(([key, field]) => Object.hasOwn(b, key) && Object.is(field, Reflect.get(b, key)))
  );
}

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { CatalogDrafts, CatalogDraftSnapshot } from "./catalog-drafts.ts";

type DraftOwner = CatalogDrafts & CatalogDraftSnapshot;
const DraftContext = createContext<DraftOwner | null>(null);
export function FoodDraftProvider({
  owner,
  children,
}: {
  owner: CatalogDrafts;
  children: ReactNode;
}) {
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  return (
    <DraftContext.Provider value={{ ...owner, ...snapshot }}>{children}</DraftContext.Provider>
  );
}
export function useFoodDrafts() {
  const owner = useContext(DraftContext);
  if (!owner) throw new Error("Food drafts require a FoodDraftProvider");
  return owner;
}

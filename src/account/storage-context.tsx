import { createContext, useContext, type PropsWithChildren } from "react";
import type { AccountStorage } from "./storage";

const AccountStorageContext = createContext<AccountStorage | null>(null);

export function AccountStorageProvider({ storage, children }: PropsWithChildren<{ storage: AccountStorage }>) {
  return <AccountStorageContext.Provider value={storage}>{children}</AccountStorageContext.Provider>;
}

export function useAccountStorage(): AccountStorage {
  const storage = useContext(AccountStorageContext);
  if (!storage) throw new Error("useAccountStorage must be used inside AccountStorageProvider");
  return storage;
}

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { router } from "expo-router";
import { mediaFiles } from "../profile/media-files";
import { readExportPhoto, saveAccountExport } from "./export-file";
import { createAccountManagementAttempts } from "./management-attempts";
import { deleteAccountOnServer } from "./management-api";
import type { AccountContextValue } from "./provider";
import type { AccountStorage } from "./storage";

export function useAccountManagementAttempts({
  account,
  storage,
  offline,
}: {
  account: AccountContextValue;
  storage: AccountStorage;
  offline: boolean;
}) {
  const currentOffline = useRef(offline);
  currentOffline.current = offline;
  const ownerId = account.user?.id ?? null;
  const readAccount = account.getSnapshot;
  const deleteAccount = account.deleteAccount;
  const attempts = useMemo(
    () =>
      createAccountManagementAttempts({
        ownerId,
        storage,
        account: () => {
          const snapshot = readAccount();
          return { ownerId: snapshot.user?.id ?? null, busy: snapshot.busy };
        },
        deleteAccount,
        offline: () => currentOffline.current,
        readPhoto: readExportPhoto,
        deliverExport: saveAccountExport,
        deleteOnServer: deleteAccountOnServer,
        removePhoto: mediaFiles.removePhoto,
        onDeleted: () => router.replace("/account"),
      }),
    [storage, deleteAccount, readAccount, ownerId],
  );
  useEffect(() => {
    attempts.start();
    return attempts.stop;
  }, [attempts]);
  const snapshot = useSyncExternalStore(
    attempts.subscribe,
    attempts.getSnapshot,
    attempts.getSnapshot,
  );
  return { ...snapshot, attempts };
}

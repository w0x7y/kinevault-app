import type { createAccountController } from "./controller.ts";
import type { AccountStorage } from "./storage.ts";
import { buildAccountExport, deleteAccountData } from "./management.ts";

type DeletionForm =
  { kind: "closed" } | { kind: "confirm"; password: string; confirmation: string };

export type AccountManagementSnapshot = {
  working: boolean;
  error: string | null;
  notice: string | null;
  deletion: DeletionForm;
};

type AccountManagementPorts = {
  ownerId: string | null;
  storage: AccountStorage;
  account: () => { ownerId: string | null; busy: boolean };
  deleteAccount: ReturnType<typeof createAccountController>["deleteAccount"];
  offline: () => boolean;
  readPhoto: Parameters<typeof buildAccountExport>[0]["readPhoto"];
  deliverExport: (contents: string, isCurrent: () => boolean) => Promise<void>;
  deleteOnServer: (ownerId: string, password: string) => Promise<void>;
  removePhoto: Parameters<typeof deleteAccountData>[0]["removePhoto"];
  onDeleted: () => void;
};

/** A Settings caller's attempts, bound to its immutable storage owner. */
export function createAccountManagementAttempts(ports: AccountManagementPorts) {
  const ownerId = ports.ownerId;
  let snapshot: AccountManagementSnapshot = {
    working: false,
    error: null,
    notice: null,
    deletion: { kind: "closed" },
  };
  const listeners = new Set<() => void>();
  let running = false;
  let generation = 0;
  let pending = false;
  let deletionCompletion: "unconfirmed" | "confirmed" | "retired-with-auth" | "departed" | null =
    null;

  function publish(patch: Partial<AccountManagementSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  }
  function ownsAccount() {
    return (
      ownerId !== null && ports.storage.ownerId === ownerId && ports.account().ownerId === ownerId
    );
  }
  function available() {
    return running && ownsAccount() && !pending && !ports.account().busy;
  }
  function detachedByDeletion() {
    return deletionCompletion === "retired-with-auth";
  }
  function reserve(patch: Partial<AccountManagementSnapshot> = {}) {
    if (!available()) return null;
    // Reserve before publication: a subscriber may submit synchronously.
    pending = true;
    const attemptGeneration = generation;
    const callerPresent = () => running && generation === attemptGeneration;
    const isCurrent = () => callerPresent() && ownsAccount();
    publish({ working: true, error: null, notice: null, ...patch });
    return { callerPresent, isCurrent };
  }
  function release() {
    pending = false;
    deletionCompletion = null;
    // A restarted caller can resume once the abandoned adapter work settles,
    // but never receives that attempt's feedback or form changes.
    if (running && ownsAccount()) publish({ working: false });
  }
  async function updateCloud(action: () => Promise<boolean>) {
    const attempt = reserve();
    if (!attempt) return false;
    try {
      if (!attempt.isCurrent()) return false;
      return (await action()) && attempt.isCurrent();
    } catch {
      if (attempt.isCurrent()) publish({ error: "Couldn't update cloud storage. Try again." });
      return false;
    } finally {
      release();
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (running) return;
      if (deletionCompletion === "retired-with-auth") deletionCompletion = "departed";
      running = true;
      generation++;
      publish({ working: pending });
    },
    stop() {
      if (deletionCompletion === "unconfirmed" || deletionCompletion === "confirmed") {
        // Account's own session retirement rebuilds its navigator before the
        // controller returns. Keep only that confirmed completion's redirect.
        // Leaving earlier, or leaving for another owner, retires it normally.
        deletionCompletion =
          deletionCompletion === "confirmed" && ports.account().ownerId === null
            ? "retired-with-auth"
            : "departed";
      }
      running = false;
      generation++;
      // Passwords belong only to the mounted confirmation field/request.
      publish({ error: null, notice: null, deletion: { kind: "closed" } });
    },
    openDeletion() {
      if (available())
        publish({
          error: null,
          notice: null,
          deletion: { kind: "confirm", password: "", confirmation: "" },
        });
    },
    cancelDeletion() {
      if (available()) publish({ error: null, notice: null, deletion: { kind: "closed" } });
    },
    setPassword(password: string) {
      if (available() && snapshot.deletion.kind === "confirm")
        publish({ deletion: { ...snapshot.deletion, password } });
    },
    setConfirmation(confirmation: string) {
      if (available() && snapshot.deletion.kind === "confirm")
        publish({ deletion: { ...snapshot.deletion, confirmation } });
    },
    retrySync: () => updateCloud(() => ports.storage.retry()),
    resolveConflict: (key: string, copy: "local" | "cloud") =>
      updateCloud(() => ports.storage.resolveConflict(key, copy)),
    async exportData() {
      const includeCloud = !ports.offline();
      const attempt = reserve();
      if (!attempt || ownerId === null) return false;
      try {
        const contents = await buildAccountExport({
          storage: ports.storage,
          ownerId,
          isCurrent: attempt.isCurrent,
          includeCloud,
          readPhoto: ports.readPhoto,
        });
        if (!attempt.isCurrent()) return false;
        await ports.deliverExport(contents, attempt.isCurrent);
        if (!attempt.isCurrent()) return false;
        publish({
          notice: includeCloud
            ? "Export prepared with your device data, cloud copies and photos."
            : "Device copy exported. Cloud changes weren't checked while offline.",
        });
        return true;
      } catch (error) {
        if (attempt.isCurrent())
          publish({
            error: error instanceof Error ? error.message : "Couldn't export your data. Try again.",
          });
        return false;
      } finally {
        release();
      }
    },
    async deleteData() {
      if (ports.offline() || snapshot.deletion.kind !== "confirm") return false;
      const { password, confirmation } = snapshot.deletion;
      const attempt = reserve({
        deletion: { kind: "confirm", password: "", confirmation },
      });
      if (!attempt || ownerId === null) return false;
      try {
        if (!attempt.isCurrent()) return false;
        deletionCompletion = "unconfirmed";
        const success = await ports.deleteAccount(
          ownerId,
          async (isOwner) => {
            const notice = await deleteAccountData({
              storage: ports.storage,
              ownerId,
              isCurrent: () => attempt.isCurrent() && isOwner(),
              password,
              confirmation,
              deleteOnServer: (secret) => ports.deleteOnServer(ownerId, secret),
              removePhoto: ports.removePhoto,
            });
            if (attempt.callerPresent()) deletionCompletion = "confirmed";
            return notice;
          },
          // Rejected attempts belong to their Settings caller. Confirmed
          // deletion and its durable auth notice still belong to Account.
          { isCurrent: attempt.isCurrent, reportError: (error) => publish({ error }) },
        );
        // Auth retirement normally leaves no owner and may already have rebuilt
        // Settings. Earlier departures and replacement identities stay retired.
        const currentOwner = ports.account().ownerId;
        if (
          success &&
          (attempt.callerPresent() || detachedByDeletion()) &&
          (currentOwner === null || currentOwner === ownerId)
        ) {
          ports.onDeleted();
          return true;
        }
        return false;
      } finally {
        release();
      }
    },
  };
}

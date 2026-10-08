import { parseProfile } from "../profile/model.ts";
import { parseProfileMedia, type StoredPhoto } from "../profile/media-model.ts";
import {
  profileMediaOwnershipKey,
  createMediaOwnershipInventory,
  removeOwnedMedia,
} from "../profile/media-ownership.ts";
import { parseExerciseDocument } from "../exercise/model.ts";
import { parseFoodLog } from "../food/log-model.ts";
import { parseCustomFoods } from "../food/custom-model.ts";
import { parseWaterLog } from "../water/model.ts";
import { parseWaterGoal } from "../water/goal-model.ts";
import {
  createPartitionedLocalStorage,
  isHistoryKey,
  readHistoryEnvelopeMetadata,
} from "./history-partitions.ts";

export type AccountLocalStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys?(): Promise<readonly string[]>;
};
export type CloudDocument = {
  document_key: string;
  payload: string | null;
  revision: number;
  updated_at?: string;
};
export type AccountRemote = {
  list(excludeKeys?: readonly string[]): Promise<CloudDocument[]>;
  save(
    key: string,
    payload: string | null,
    expectedRevision: number,
  ): Promise<CloudDocument | null>;
};
export type AccountStorageSnapshot = {
  state: "idle" | "syncing" | "pending" | "error" | "conflict";
  error: string | null;
  conflicts: readonly string[];
};
const documentParsers: Record<string, (raw: string | null) => unknown> = {
  "kinevault-track.profile.v1": parseProfile,
  "kinevault-track.exercise.v1": parseExerciseDocument,
  "kinevault-track.food-log.v1": parseFoodLog,
  "kinevault-track.custom-foods.v1": parseCustomFoods,
  "kinevault-track.water-log.v1": parseWaterLog,
  "kinevault-track.water-goal.v1": parseWaterGoal,
};
export const accountDocumentKeys = Object.keys(documentParsers);
const mediaKey = "kinevault-track.profile-media.v1";
export const localOnlyAccountDocumentKeys = [mediaKey, profileMediaOwnershipKey];
const guestClaimKey = "kinevault-track.account.guest-claim.v1";
const guestImportCompleteKey = "kinevault-track.account.guest-import-complete.v1";
const freshGuestPrefix = "kinevault-track.account.guest-current.";
const freshGuestClaimKey = `${freshGuestPrefix}claim`;
const profileKey = "kinevault-track.profile.v1";
export const recoveredSetupStorageKey = "kinevault-track.recovered-setup.v1";
type Envelope = {
  version: 1;
  payload: string | null;
  revision: number;
  dirty: boolean;
  sequence: number;
};

// Account replacement can leave an uncancelable local write behind. Serialize
// across storage instances too, so the replacement reads that write afterward.
const localQueues = new WeakMap<AccountLocalStorage, Promise<unknown>>();
function locally<T>(storage: AccountLocalStorage, run: () => Promise<T>): Promise<T> {
  const result = (localQueues.get(storage) ?? Promise.resolve()).then(run);
  localQueues.set(
    storage,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}
type OwnerDeletion = {
  phase: "open" | "frozen" | "confirmed";
  lease: symbol | null;
  work: Set<Promise<unknown>>;
  mediaQueue: Promise<unknown>;
  listeners: Set<(resume: boolean) => void>;
};
const ownerDeletions = new WeakMap<AccountLocalStorage, Map<string, OwnerDeletion>>();
function ownerDeletion(local: AccountLocalStorage, owner: string | null): OwnerDeletion {
  let owners = ownerDeletions.get(local);
  if (!owners) ownerDeletions.set(local, (owners = new Map()));
  const key = owner ?? "";
  let state = owners.get(key);
  if (!state)
    owners.set(
      key,
      (state = {
        phase: "open",
        lease: null,
        work: new Set(),
        mediaQueue: Promise.resolve(),
        listeners: new Set(),
      }),
    );
  return state;
}
function canonical(key: string, payload: string | null): string | null {
  if (payload === null) return null;
  const parser = documentParsers[key];
  if (!parser) throw new Error("Unknown account document");
  return JSON.stringify(parser(payload));
}
function dataOrNull(raw: string | null): unknown {
  return raw === null ? null : JSON.parse(raw);
}
function parseEnvelope(raw: string | null): Envelope | null {
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("payload" in value) ||
    (value.payload !== null && typeof value.payload !== "string") ||
    !("revision" in value) ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !("sequence" in value) ||
    typeof value.sequence !== "number" ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 0 ||
    !("dirty" in value) ||
    typeof value.dirty !== "boolean"
  )
    throw new Error("Invalid account cache");
  return {
    version: 1,
    payload: value.payload,
    revision: value.revision,
    sequence: value.sequence,
    dirty: value.dirty,
  };
}
function checkedCloud(row: CloudDocument): CloudDocument {
  if (
    !accountDocumentKeys.includes(row.document_key) ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    (row.payload !== null && typeof row.payload !== "string")
  )
    throw new Error("Invalid cloud document");
  return { ...row, payload: canonical(row.document_key, row.payload) };
}

export function createAccountStorage({
  userId,
  local,
  remote,
}: {
  userId: string | null;
  local: AccountLocalStorage;
  remote: AccountRemote | null;
}) {
  const rawLocal = local;
  local = createPartitionedLocalStorage(local);
  const deletion = ownerDeletion(local, userId);
  const deletionBlocked = () => userId !== null && deletion.phase !== "open";
  const deletedKey = `kinevault-track.account.${encodeURIComponent(userId ?? "")}.deleted.v1`;
  let active = false,
    generation = 0;
  let running: Promise<boolean> | null = null;
  let snapshot: AccountStorageSnapshot = { state: "idle", error: null, conflicts: [] };
  const listeners = new Set<() => void>();
  const itemListeners = new Map<string, Set<() => void>>();
  const cache = new Map<string, Envelope>();
  const conflicts = new Map<string, CloudDocument>();
  const scoped = (key: string) =>
    userId === null ? key : `kinevault-track.account.${encodeURIComponent(userId)}.${key}`;
  async function guestKey(key: string) {
    // The original records remain available for recovery, but are no longer
    // visible from logged-out onboarding once an account has claimed them.
    return (await local.getItem(guestClaimKey)) === null ? key : `${freshGuestPrefix}${key}`;
  }
  const current = (ticket: number) => active && generation === ticket && !deletionBlocked();
  const deletionChanged = (resume: boolean) => {
    ++generation;
    if (resume && active) void sync(true);
  };
  async function checkWritable() {
    if (deletionBlocked()) throw new Error("Account deletion is in progress");
    if (userId && (await rawLocal.getItem(deletedKey)) !== null) {
      if (deletion.phase === "open") deletion.phase = "frozen";
      for (const changed of deletion.listeners) changed(false);
      throw new Error("Account deletion is in progress");
    }
    if (deletionBlocked()) throw new Error("Account deletion is in progress");
  }
  function track<T>(work: Promise<T>): Promise<T> {
    deletion.work.add(work);
    void work.finally(() => deletion.work.delete(work)).catch(() => {});
    return work;
  }

  function publish(state?: AccountStorageSnapshot["state"], error: string | null = null) {
    const next: AccountStorageSnapshot = {
      state: conflicts.size
        ? "conflict"
        : (state ?? ([...cache.values()].some((row) => row.dirty) ? "pending" : "idle")),
      error,
      conflicts: [...conflicts.keys()].sort(),
    };
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  }
  async function read(key: string) {
    const envelope = parseEnvelope(await local.getItem(scoped(key)));
    if (envelope && cache.get(key)?.payload !== envelope.payload)
      envelope.payload = canonical(key, envelope.payload);
    if (envelope) cache.set(key, envelope);
    else cache.delete(key);
    return envelope;
  }
  async function write(key: string, envelope: Envelope) {
    await checkWritable();
    await local.setItem(scoped(key), JSON.stringify(envelope));
    cache.set(key, envelope);
  }
  function changedItem(key: string) {
    for (const listener of [...(itemListeners.get(key) ?? [])]) listener();
  }
  async function hydrate(rows: CloudDocument[], ticket: number) {
    const cloud = new Map(
      rows.map((row) => {
        const checked = checkedCloud(row);
        return [checked.document_key, checked];
      }),
    );
    await locally(local, async () => {
      for (const key of accountDocumentKeys) {
        if (!current(ticket)) return;
        const envelope = await read(key),
          row = cloud.get(key);
        if (!current(ticket)) return;
        if (!row) {
          if (envelope && envelope.revision > 0)
            throw new Error("A saved cloud document is missing");
          continue;
        }
        if (envelope && envelope.revision > row.revision)
          throw new Error("A newer account document was saved while downloading");
        if (envelope?.dirty && envelope.payload !== row.payload) {
          if (envelope.revision !== row.revision) conflicts.set(key, row);
          else conflicts.delete(key);
          continue;
        }
        conflicts.delete(key);
        await write(key, {
          version: 1,
          payload: row.payload,
          revision: row.revision,
          dirty: false,
          sequence: envelope?.sequence ?? 0,
        });
        if ((envelope?.payload ?? null) !== row.payload) changedItem(key);
      }
    });
    return cloud;
  }
  async function importGuest(cloud: Map<string, CloudDocument>, ticket: number) {
    await locally(local, async () => {
      if (!current(ticket)) return;
      const claim = await local.getItem(guestClaimKey);
      if (!current(ticket) || (claim !== null && claim !== userId)) return;
      if ((await local.getItem(guestImportCompleteKey)) === userId || !current(ticket)) return;
      if (claim === null) await local.setItem(guestClaimKey, userId!);
      const guest = new Map<string, string>();
      for (const key of [...accountDocumentKeys, ...localOnlyAccountDocumentKeys]) {
        const raw = await local.getItem(key);
        if (!current(ticket)) return;
        if (raw !== null) guest.set(key, raw);
      }
      // Claim before copying. A failed copy can resume for this user, but no
      // other account can import the same sensitive guest recovery records.
      for (const [key, raw] of guest) {
        if (!current(ticket)) return;
        if (localOnlyAccountDocumentKeys.includes(key)) {
          if ((await local.getItem(scoped(key))) === null && current(ticket))
            await local.setItem(scoped(key), raw);
        } else if (!cloud.has(key) && (await read(key)) === null && current(ticket)) {
          await write(key, {
            version: 1,
            payload: canonical(key, raw),
            revision: 0,
            dirty: true,
            sequence: 1,
          });
          changedItem(key);
        }
      }
      if (current(ticket)) await local.setItem(guestImportCompleteKey, userId!);
    });
  }
  async function importFreshSetup(cloud: Map<string, CloudDocument>, ticket: number) {
    await locally(local, async () => {
      if (!current(ticket)) return;
      const raw = await local.getItem(`${freshGuestPrefix}${profileKey}`);
      if (raw === null || !current(ticket)) return;
      const owner = await local.getItem(freshGuestClaimKey);
      if (!current(ticket) || (owner !== null && owner !== userId)) return;
      const value = canonical(profileKey, raw);
      if (owner === null) await local.setItem(freshGuestClaimKey, userId!);
      const existing = await read(profileKey);
      if (!current(ticket)) return;
      if (!cloud.has(profileKey) && (existing === null || existing.payload === null)) {
        await write(profileKey, {
          version: 1,
          payload: value,
          revision: existing?.revision ?? 0,
          dirty: true,
          sequence: (existing?.sequence ?? 0) + 1,
        });
        if (existing?.payload !== value) changedItem(profileKey);
      } else {
        // Logging in to an existing account must keep its saved profile. Keep
        // newly entered answers as a recovery copy belonging to that account.
        await local.setItem(scoped(recoveredSetupStorageKey), value!);
      }
      if (!current(ticket)) return;
      await local.removeItem(`${freshGuestPrefix}${profileKey}`);
      await local.removeItem(freshGuestClaimKey);
    });
  }
  async function upload(ticket: number) {
    for (const key of accountDocumentKeys) {
      while (current(ticket)) {
        const sent = await locally(local, () => read(key));
        if (!current(ticket) || !sent?.dirty || conflicts.has(key)) break;
        await checkWritable();
        if (!current(ticket)) return;
        const result = await remote!.save(key, sent.payload, sent.revision);
        if (!current(ticket)) return;
        if (result === null) {
          await hydrate(await remote!.list(), ticket);
          const latest = await locally(local, () => read(key));
          if (!conflicts.has(key) && latest?.dirty && current(ticket))
            throw new Error("Cloud changes need another sync attempt");
          break;
        }
        const saved = checkedCloud(result);
        if (
          saved.document_key !== key ||
          saved.payload !== sent.payload ||
          saved.revision <= sent.revision
        )
          throw new Error("Unexpected cloud save result");
        await locally(local, async () => {
          if (!current(ticket)) return;
          const latest = await read(key);
          if (!current(ticket) || !latest) return;
          await write(key, {
            ...latest,
            revision: saved.revision,
            dirty: latest.sequence !== sent.sequence,
          });
        });
      }
    }
  }
  function sync(download: boolean): Promise<boolean> {
    if (!active || deletionBlocked() || userId === null || !remote) return Promise.resolve(false);
    if (running) return running;
    const ticket = generation;
    // Reserve ownership before notifying subscribers. A subscriber may retry
    // or stop synchronously, before this work reaches the remote adapter.
    const work = Promise.resolve().then(async () => {
      try {
        if (!current(ticket)) return false;
        if (download) {
          const cloud = await hydrate(await remote.list(), ticket);
          if (!current(ticket)) return false;
          await importGuest(cloud, ticket);
          if (!current(ticket)) return false;
          await importFreshSetup(cloud, ticket);
        }
        await upload(ticket);
        if (current(ticket)) publish();
        return current(ticket) && snapshot.error === null;
      } catch {
        if (current(ticket))
          publish(
            "error",
            "Your changes are saved on this device. Cloud sync couldn't finish. Try again.",
          );
        return false;
      }
    });
    running = work;
    track(work);
    void work.finally(() => {
      if (running === work) running = null;
      // A later write may target a key this upload pass has already visited.
      // Keep draining until every durable pending value has been considered.
      if (
        current(ticket) &&
        !snapshot.error &&
        [...cache.entries()].some(([key, row]) => row.dirty && !conflicts.has(key))
      )
        void sync(false);
    });
    publish("syncing");
    return work;
  }
  function schedule() {
    if (!active) return;
    publish();
    if (snapshot.error) return;
    void sync(false);
  }
  async function mutate(key: string, payload: string | null) {
    if (deletionBlocked()) throw new Error("Account deletion is in progress");
    if (userId === null) {
      const ticket = generation;
      await locally(local, async () => {
        await checkWritable();
        if (!current(ticket)) throw new Error("This onboarding session has ended");
        const target = await guestKey(key);
        if (!current(ticket)) throw new Error("This onboarding session has ended");
        if (payload === null) await local.removeItem(target);
        else await local.setItem(target, payload);
      });
      return;
    }
    if (!documentParsers[key]) {
      await locally(local, async () => {
        await checkWritable();
        if (payload === null) await local.removeItem(scoped(key));
        else await local.setItem(scoped(key), payload);
      });
      return;
    }
    const value = canonical(key, payload);
    await locally(local, async () => {
      await checkWritable();
      // A validated replacement or reset needs revision metadata, not valid
      // prior answers. Damaged payloads must remain recoverable by replacement.
      let previous: Envelope | null;
      try {
        previous = parseEnvelope(await local.getItem(scoped(key)));
      } catch (error) {
        if (!isHistoryKey(key)) throw error;
        previous = parseEnvelope(await readHistoryEnvelopeMetadata(local, scoped(key)));
      }
      await write(key, {
        version: 1,
        payload: value,
        revision: previous?.revision ?? 0,
        dirty: true,
        sequence: (previous?.sequence ?? 0) + 1,
      });
    });
    schedule();
  }
  async function cleanupDeletedData(removePhoto: (photo: StoredPhoto) => Promise<void>) {
    if (!userId) throw new Error("Account deletion is unavailable");
    if (deletion.phase !== "confirmed" && (await rawLocal.getItem(deletedKey)) !== "1")
      throw new Error("Server deletion has not been confirmed");
    if (!rawLocal.getAllKeys) throw new Error("Local cleanup cannot enumerate account data");
    deletion.phase = "confirmed";
    // Retry a failed confirmation write before removing any recovery records.
    await locally(local, () => rawLocal.setItem(deletedKey, "1"));
    await locally(local, async () => {
      const keys = await rawLocal.getAllKeys!();
      const prefix = `kinevault-track.account.${encodeURIComponent(userId)}.`;
      const targets = new Set(keys.filter((key) => key.startsWith(prefix) && key !== deletedKey));
      if ((await rawLocal.getItem(guestClaimKey)) === userId) {
        for (const key of keys) {
          if (
            [...accountDocumentKeys, ...localOnlyAccountDocumentKeys].some(
              (root) => key === root || key.startsWith(`${root}.partition.v2.`),
            )
          )
            targets.add(key);
        }
        if ((await rawLocal.getItem(guestImportCompleteKey)) === userId)
          targets.add(guestImportCompleteKey);
        // Keep the claim tombstone so any undeleted guest fragments are
        // never imported into another account after a cleanup failure.
      }
      if ((await rawLocal.getItem(freshGuestClaimKey)) === userId) {
        keys.filter((key) => key.startsWith(freshGuestPrefix)).forEach((key) => targets.add(key));
      }
      await removeOwnedMedia({
        local: rawLocal,
        keys,
        targets,
        removePhoto,
      });
      for (const key of targets) await rawLocal.removeItem(key);
      cache.clear();
      conflicts.clear();
      publish();
    });
  }
  return {
    ownerId: userId,
    async exportDocuments(includeCloud: boolean) {
      if (!userId) throw new Error("Log in to export your account");
      // A cloud failure must not be represented as an empty cloud account.
      if (includeCloud && !remote) throw new Error("Cloud export is unavailable");
      const rows = includeCloud ? (await remote!.list()).map(checkedCloud) : null;
      return locally(local, async () => {
        const documents = [];
        for (const key of accountDocumentKeys) {
          const saved = await read(key);
          const cloud =
            rows?.find((row) => row.document_key === key) ??
            (rows === null ? conflicts.get(key) : undefined);
          if (rows !== null && saved && saved.revision > 0 && !cloud)
            throw new Error(
              "A saved cloud document is missing. Export a device copy while offline or retry cloud export.",
            );
          const data = (payload: string | null) => (payload === null ? null : JSON.parse(payload));
          documents.push({
            key,
            local: saved
              ? { data: data(saved.payload), revision: saved.revision, pending: saved.dirty }
              : null,
            cloud: cloud
              ? {
                  data: data(cloud.payload),
                  revision: cloud.revision,
                  updatedAt: cloud.updated_at ?? null,
                  source: rows === null ? "last-observed-conflict" : "cloud-export",
                }
              : null,
            conflict: Boolean(
              saved?.dirty &&
              cloud &&
              saved.payload !== cloud.payload &&
              saved.revision !== cloud.revision,
            ),
          });
        }
        return {
          documents,
          recoveredSetup: dataOrNull(await local.getItem(scoped(recoveredSetupStorageKey))),
          media: parseProfileMedia(await local.getItem(scoped(mediaKey))),
        };
      });
    },
    async freezeForDeletion() {
      if (!userId || deletion.lease || deletion.phase === "confirmed")
        throw new Error("Account deletion is unavailable");
      const lease = Symbol("deletion");
      deletion.lease = lease;
      deletion.phase = "frozen";
      for (const changed of deletion.listeners) changed(false);
      let previousMarker: string | null = null;
      try {
        await Promise.allSettled([...deletion.work]);
        if ((await rawLocal.getItem(guestClaimKey)) === userId)
          await Promise.allSettled([...ownerDeletion(local, null).work]);
        await locally(local, async () => {
          previousMarker = await rawLocal.getItem(deletedKey);
          if (previousMarker === "1") {
            deletion.phase = "confirmed";
            throw new Error("This account has been deleted");
          }
          await rawLocal.setItem(deletedKey, "pending");
        });
      } catch (error) {
        deletion.lease = null;
        if (previousMarker !== "1") {
          deletion.phase = previousMarker === null ? "open" : "frozen";
          if (deletion.phase === "open") for (const changed of deletion.listeners) changed(true);
        }
        throw error;
      }
      return {
        async resume() {
          if (deletion.lease !== lease || deletion.phase === "confirmed") return;
          // A prior interrupted attempt has unknown server status. A later
          // rejection cannot establish that its account survived deletion.
          if (previousMarker !== null) {
            deletion.lease = null;
            throw new Error(
              "An earlier account deletion could not be confirmed. Your local data remains frozen. Clear this app's storage on this device.",
            );
          }
          // Removal failure stays frozen; a restart must not upload uncertain data.
          await locally(local, () => rawLocal.removeItem(deletedKey));
          deletion.lease = null;
          deletion.phase = "open";
          for (const changed of deletion.listeners) changed(true);
        },
        async confirm() {
          if (deletion.lease !== lease) throw new Error("Account deletion is unavailable");
          deletion.phase = "confirmed";
          await locally(local, () => rawLocal.setItem(deletedKey, "1"));
        },
        cleanup: cleanupDeletedData,
      };
    },
    cleanupDeletedData,
    mediaOwnership: createMediaOwnershipInventory({
      local: {
        getItem: (key) => local.getItem(key),
        async setItem(key, value) {
          await checkWritable();
          await local.setItem(key, value);
        },
        async getAllKeys() {
          if (!rawLocal.getAllKeys) throw new Error("Photo ownership cannot be checked");
          return rawLocal.getAllKeys();
        },
      },
      ownerKey: (key) => (userId === null ? guestKey(key) : Promise.resolve(scoped(key))),
      transact: (run) =>
        locally(local, async () => {
          await checkWritable();
          return run();
        }),
    }),
    withMediaOperation<T>(run: () => Promise<T>): Promise<T> {
      if (deletionBlocked()) return Promise.reject(new Error("Account deletion is in progress"));
      // Reserve work synchronously, before the operation can reach an import.
      const work = deletion.mediaQueue
        .catch(() => {})
        .then(async () => {
          await checkWritable();
          return run();
        });
      deletion.mediaQueue = work;
      return track(work);
    },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    // Only cloud replacements/imports invalidate a document. Local writes and
    // upload acknowledgments already belong to the caller's durable store.
    subscribeItem(key: string, listener: () => void) {
      const subscribers = itemListeners.get(key) ?? new Set<() => void>();
      subscribers.add(listener);
      itemListeners.set(key, subscribers);
      return () => {
        subscribers.delete(listener);
        if (!subscribers.size) itemListeners.delete(key);
      };
    },
    async getItem(key: string): Promise<string | null> {
      // A pending write must finish before a consumer reads its durable result.
      // Reads themselves must not join this queue: retryLoad replaces abandoned
      // reads, including a native storage read that never resolves. Domain
      // stores own stale-read publication; these reads never update sync cache.
      const pendingWrites = localQueues.get(local);
      if (pendingWrites) await pendingWrites;
      const target = userId === null ? await guestKey(key) : scoped(key);
      const raw = await local.getItem(target);
      return userId !== null && documentParsers[key] ? (parseEnvelope(raw)?.payload ?? null) : raw;
    },
    setItem: (key: string, value: string) => mutate(key, value),
    removeItem: (key: string) => mutate(key, null),
    async start(): Promise<void> {
      deletion.listeners.add(deletionChanged);
      if (deletionBlocked()) {
        if (deletion.phase === "frozen") active = true;
        return;
      }
      const beforeRead = generation;
      const deleted = userId ? await rawLocal.getItem(deletedKey) : null;
      if (beforeRead !== generation) return;
      if (deleted !== null) {
        deletion.phase = deleted === "1" ? "confirmed" : "frozen";
        for (const changed of deletion.listeners) changed(false);
        publish("error", "This account has been deleted. Log out to continue.");
        return;
      }
      if (active) {
        if (running) await running;
        return;
      }
      active = true;
      ++generation;
      const ticket = generation;
      if (userId === null) return;
      try {
        await locally(local, async () => {
          for (const key of accountDocumentKeys) {
            if (!current(ticket)) return;
            await read(key);
          }
        });
      } catch {
        if (current(ticket))
          publish("error", "Some saved account data couldn't be read on this device.");
        return;
      }
      if (running) await running;
      if (!current(ticket)) return;
      publish();
      await sync(true);
    },
    stop() {
      deletion.listeners.delete(deletionChanged);
      active = false;
      ++generation;
      running = null;
    },
    async retry(): Promise<boolean> {
      if (!active) return false;
      const ticket = generation;
      if (running) await running;
      if (!current(ticket)) return false;
      return sync(true);
    },
    async resolveConflict(key: string, choice: "local" | "cloud"): Promise<boolean> {
      if (!active || !conflicts.has(key)) return false;
      const ticket = generation;
      try {
        if (running) await running;
        const cloud = conflicts.get(key);
        if (!cloud || !current(ticket)) return false;
        await locally(local, async () => {
          const latest = await read(key);
          if (!latest || !current(ticket)) return;
          await write(key, {
            ...latest,
            payload: choice === "cloud" ? cloud.payload : latest.payload,
            revision: cloud.revision,
            dirty: choice === "local",
            sequence: latest.sequence + 1,
          });
          if (choice === "cloud" && latest.payload !== cloud.payload) changedItem(key);
          conflicts.delete(key);
        });
        return sync(false);
      } catch {
        if (current(ticket))
          publish(
            "error",
            "Your saved versions are still available. Try resolving this sync conflict again.",
          );
        return false;
      }
    },
  };
}
export type AccountStorage = ReturnType<typeof createAccountStorage>;

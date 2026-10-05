import { parseProfile } from "../profile/model.ts";
import { parseExerciseDocument } from "../exercise/model.ts";
import { parseFoodLog } from "../food/log-model.ts";
import { parseCustomFoods } from "../food/custom-model.ts";
import { parseWaterLog } from "../water/model.ts";
import { parseWaterGoal } from "../water/goal-model.ts";

export type AccountLocalStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export type CloudDocument = { document_key: string; payload: string | null; revision: number; updated_at?: string };
export type AccountRemote = {
  list(): Promise<CloudDocument[]>;
  save(key: string, payload: string | null, expectedRevision: number): Promise<CloudDocument | null>;
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
const guestClaimKey = "kinevault-track.account.guest-claim.v1";
const guestImportCompleteKey = "kinevault-track.account.guest-import-complete.v1";
const freshGuestPrefix = "kinevault-track.account.guest-current.";
const freshGuestClaimKey = `${freshGuestPrefix}claim`;
const profileKey = "kinevault-track.profile.v1";
export const recoveredSetupStorageKey = "kinevault-track.recovered-setup.v1";
type Envelope = { version: 1; payload: string | null; revision: number; dirty: boolean; sequence: number };

// Account replacement can leave an uncancelable local write behind. Serialize
// across storage instances too, so the replacement reads that write afterward.
const localQueues = new WeakMap<AccountLocalStorage, Promise<unknown>>();
function locally<T>(storage: AccountLocalStorage, run: () => Promise<T>): Promise<T> {
  const result = (localQueues.get(storage) ?? Promise.resolve()).then(run);
  localQueues.set(storage, result.then(() => undefined, () => undefined));
  return result;
}
function canonical(key: string, payload: string | null): string | null {
  if (payload === null) return null;
  const parser = documentParsers[key];
  if (!parser) throw new Error("Unknown account document");
  return JSON.stringify(parser(payload));
}
function parseEnvelope(raw: string | null): Envelope | null {
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1
    || !("payload" in value) || value.payload !== null && typeof value.payload !== "string"
    || !("revision" in value) || typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !("sequence" in value) || typeof value.sequence !== "number" || !Number.isSafeInteger(value.sequence) || value.sequence < 0
    || !("dirty" in value) || typeof value.dirty !== "boolean") throw new Error("Invalid account cache");
  return { version: 1, payload: value.payload, revision: value.revision, sequence: value.sequence, dirty: value.dirty };
}
function checkedCloud(row: CloudDocument): CloudDocument {
  if (!accountDocumentKeys.includes(row.document_key) || !Number.isSafeInteger(row.revision) || row.revision < 1
    || row.payload !== null && typeof row.payload !== "string") throw new Error("Invalid cloud document");
  return { ...row, payload: canonical(row.document_key, row.payload) };
}

export function createAccountStorage({ userId, local, remote }: {
  userId: string | null; local: AccountLocalStorage; remote: AccountRemote | null;
}) {
  let active = false, generation = 0;
  let running: Promise<boolean> | null = null;
  let snapshot: AccountStorageSnapshot = { state: "idle", error: null, conflicts: [] };
  const listeners = new Set<() => void>();
  const itemListeners = new Map<string, Set<() => void>>();
  const cache = new Map<string, Envelope>();
  const conflicts = new Map<string, CloudDocument>();
  const scoped = (key: string) => userId === null ? key : `kinevault-track.account.${encodeURIComponent(userId)}.${key}`;
  async function guestKey(key: string) {
    // The original records remain available for recovery, but are no longer
    // visible from logged-out onboarding once an account has claimed them.
    return await local.getItem(guestClaimKey) === null ? key : `${freshGuestPrefix}${key}`;
  }
  const current = (ticket: number) => active && generation === ticket;

  function publish(state?: AccountStorageSnapshot["state"], error: string | null = null) {
    const next: AccountStorageSnapshot = {
      state: conflicts.size ? "conflict" : state ?? ([...cache.values()].some(row => row.dirty) ? "pending" : "idle"),
      error,
      conflicts: [...conflicts.keys()].sort(),
    };
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  }
  async function read(key: string) {
    const envelope = parseEnvelope(await local.getItem(scoped(key)));
    if (envelope && cache.get(key)?.payload !== envelope.payload) envelope.payload = canonical(key, envelope.payload);
    if (envelope) cache.set(key, envelope);
    else cache.delete(key);
    return envelope;
  }
  async function write(key: string, envelope: Envelope) {
    await local.setItem(scoped(key), JSON.stringify(envelope));
    cache.set(key, envelope);
  }
  function changedItem(key: string) {
    for (const listener of [...itemListeners.get(key) ?? []]) listener();
  }
  async function hydrate(rows: CloudDocument[], ticket: number) {
    const cloud = new Map(rows.map(row => { const checked = checkedCloud(row); return [checked.document_key, checked]; }));
    await locally(local, async () => {
      for (const key of accountDocumentKeys) {
        if (!current(ticket)) return;
        const envelope = await read(key), row = cloud.get(key);
        if (!current(ticket)) return;
        if (!row) {
          if (envelope && envelope.revision > 0) throw new Error("A saved cloud document is missing");
          continue;
        }
        if (envelope && envelope.revision > row.revision) throw new Error("A newer account document was saved while downloading");
        if (envelope?.dirty && envelope.payload !== row.payload) {
          if (envelope.revision !== row.revision) conflicts.set(key, row);
          else conflicts.delete(key);
          continue;
        }
        conflicts.delete(key);
        await write(key, { version: 1, payload: row.payload, revision: row.revision, dirty: false, sequence: envelope?.sequence ?? 0 });
        if ((envelope?.payload ?? null) !== row.payload) changedItem(key);
      }
    });
    return cloud;
  }
  async function importGuest(cloud: Map<string, CloudDocument>, ticket: number) {
    await locally(local, async () => {
      if (!current(ticket)) return;
      const claim = await local.getItem(guestClaimKey);
      if (!current(ticket) || claim !== null && claim !== userId) return;
      if (await local.getItem(guestImportCompleteKey) === userId || !current(ticket)) return;
      if (claim === null) await local.setItem(guestClaimKey, userId!);
      const guest = new Map<string, string>();
      for (const key of [...accountDocumentKeys, mediaKey]) {
        const raw = await local.getItem(key);
        if (!current(ticket)) return;
        if (raw !== null) guest.set(key, raw);
      }
      // Claim before copying. A failed copy can resume for this user, but no
      // other account can import the same sensitive guest recovery records.
      for (const [key, raw] of guest) {
        if (!current(ticket)) return;
        if (key === mediaKey) {
          if (await local.getItem(scoped(key)) === null && current(ticket)) await local.setItem(scoped(key), raw);
        } else if (!cloud.has(key) && await read(key) === null && current(ticket)) {
          await write(key, { version: 1, payload: canonical(key, raw), revision: 0, dirty: true, sequence: 1 });
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
      if (!current(ticket) || owner !== null && owner !== userId) return;
      const value = canonical(profileKey, raw);
      if (owner === null) await local.setItem(freshGuestClaimKey, userId!);
      const existing = await read(profileKey);
      if (!current(ticket)) return;
      if (!cloud.has(profileKey) && (existing === null || existing.payload === null)) {
        await write(profileKey, { version: 1, payload: value, revision: existing?.revision ?? 0, dirty: true, sequence: (existing?.sequence ?? 0) + 1 });
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
        const result = await remote!.save(key, sent.payload, sent.revision);
        if (!current(ticket)) return;
        if (result === null) {
          await hydrate(await remote!.list(), ticket);
          const latest = await locally(local, () => read(key));
          if (!conflicts.has(key) && latest?.dirty && current(ticket)) throw new Error("Cloud changes need another sync attempt");
          break;
        }
        const saved = checkedCloud(result);
        if (saved.document_key !== key || saved.payload !== sent.payload || saved.revision <= sent.revision) throw new Error("Unexpected cloud save result");
        await locally(local, async () => {
          if (!current(ticket)) return;
          const latest = await read(key);
          if (!current(ticket) || !latest) return;
          await write(key, { ...latest, revision: saved.revision, dirty: latest.sequence !== sent.sequence });
        });
      }
    }
  }
  function sync(download: boolean): Promise<boolean> {
    if (!active || userId === null || !remote) return Promise.resolve(false);
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
        if (current(ticket)) publish("error", "Your changes are saved on this device. Cloud sync couldn't finish. Try again.");
        return false;
      }
    });
    running = work;
    void work.finally(() => {
      if (running === work) running = null;
      // A later write may target a key this upload pass has already visited.
      // Keep draining until every durable pending value has been considered.
      if (current(ticket) && !snapshot.error && [...cache.entries()].some(([key, row]) => row.dirty && !conflicts.has(key))) void sync(false);
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
    if (userId === null) {
      const ticket = generation;
      await locally(local, async () => {
        if (!current(ticket)) throw new Error("This onboarding session has ended");
        const target = await guestKey(key);
        if (!current(ticket)) throw new Error("This onboarding session has ended");
        if (payload === null) await local.removeItem(target);
        else await local.setItem(target, payload);
      });
      return;
    }
    if (!documentParsers[key]) {
      await locally(local, () => payload === null ? local.removeItem(scoped(key)) : local.setItem(scoped(key), payload));
      return;
    }
    const value = canonical(key, payload);
    await locally(local, async () => {
      // A validated replacement or reset needs revision metadata, not valid
      // prior answers. Damaged payloads must remain recoverable by replacement.
      const previous = parseEnvelope(await local.getItem(scoped(key)));
      await write(key, { version: 1, payload: value, revision: previous?.revision ?? 0, dirty: true, sequence: (previous?.sequence ?? 0) + 1 });
    });
    schedule();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    // Only cloud replacements/imports invalidate a document. Local writes and
    // upload acknowledgments already belong to the caller's durable store.
    subscribeItem(key: string, listener: () => void) {
      const subscribers = itemListeners.get(key) ?? new Set<() => void>();
      subscribers.add(listener); itemListeners.set(key, subscribers);
      return () => { subscribers.delete(listener); if (!subscribers.size) itemListeners.delete(key); };
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
      return userId !== null && documentParsers[key] ? parseEnvelope(raw)?.payload ?? null : raw;
    },
    setItem: (key: string, value: string) => mutate(key, value),
    removeItem: (key: string) => mutate(key, null),
    async start(): Promise<void> {
      if (active) { if (running) await running; return; }
      active = true; ++generation;
      const ticket = generation;
      if (userId === null) return;
      try {
        await locally(local, async () => { for (const key of accountDocumentKeys) { if (!current(ticket)) return; await read(key); } });
      } catch {
        if (current(ticket)) publish("error", "Some saved account data couldn't be read on this device.");
        return;
      }
      if (running) await running;
      if (!current(ticket)) return;
      publish();
      await sync(true);
    },
    stop() { active = false; ++generation; running = null; },
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
          await write(key, { ...latest, payload: choice === "cloud" ? cloud.payload : latest.payload,
            revision: cloud.revision, dirty: choice === "local", sequence: latest.sequence + 1 });
          if (choice === "cloud" && latest.payload !== cloud.payload) changedItem(key);
          conflicts.delete(key);
        });
        return sync(false);
      } catch {
        if (current(ticket)) publish("error", "Your saved versions are still available. Try resolving this sync conflict again.");
        return false;
      }
    },
  };
}
export type AccountStorage = ReturnType<typeof createAccountStorage>;

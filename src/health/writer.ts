import type { DurableStorage } from "../persistence/durable-write.ts";
import type { DeviceHealth, HealthAccess } from "./device-health.ts";
import {
  healthKind,
  healthRecords,
  healthWrites,
  parseHealthLedger,
  serializeHealthLedger,
  type HealthLedger,
  type HealthSources,
} from "./plan.ts";

// Not an Account tracking document: account storage keeps it on this device, scoped to the
// signed-in account, and never uploads it. Another account on this device keeps its own.
export const healthLedgerKey = "kinevault-track.health-written.v1";
const kinds = ["workout", "weight", "water"] as const;
/** Records per save call, so a first sync of a long history stays within Health Connect's limits. */
const batch = 100;

export type HealthWriterSnapshot = {
  /** The device setting; null until it loads. */
  enabled: boolean | null;
  /** Write access, null until checked. */
  access: HealthAccess | null;
  /** The last sync left something unsaved. It retries on the next change or foreground. */
  failed: boolean;
  /** The setting is saving or access is being asked for. */
  busy: boolean;
  error: string | null;
};

/**
 * Saves completed workouts, Body-weight measurements and water to the phone's health store while
 * the device setting is on. It writes after the app's own saves and never changes them: a failure
 * only sets `failed`, and the next sync tries again.
 */
export function createHealthWriter({
  storage,
  setting,
  device,
  now = Date.now,
}: {
  storage: DurableStorage;
  setting: { load(): Promise<boolean>; save(enabled: boolean): Promise<void> };
  device: DeviceHealth;
  now?: () => number;
}) {
  let snapshot: HealthWriterSnapshot = {
    enabled: null,
    access: null,
    failed: false,
    busy: false,
    error: null,
  };
  const listeners = new Set<() => void>();
  let active = false;
  let sources: HealthSources | null = null;
  let ledger: HealthLedger | null = null;
  let running = false;
  let again = false;

  function publish(patch: Partial<HealthWriterSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  }
  const writing = () => active && snapshot.enabled === true && snapshot.access === "granted";

  /** Runs one sync at a time; a change during a sync runs another after it. */
  function sync() {
    if (running) {
      again = true;
      return;
    }
    if (!writing() || !sources) return;
    running = true;
    // Nothing escapes as an unhandled rejection, which crash reporting would pick up.
    void write(sources)
      .catch(() => publish({ failed: true }))
      .finally(() => {
        running = false;
        if (again) {
          again = false;
          sync();
        }
      });
  }

  async function write(current: HealthSources) {
    if (!ledger) {
      let raw: string | null;
      try {
        raw = await storage.getItem(healthLedgerKey);
      } catch {
        publish({ failed: true });
        return;
      }
      try {
        ledger = parseHealthLedger(raw);
      } catch {
        // Saves are upserts, so starting over only forgets removals of records it listed.
        ledger = {};
      }
    }
    const at = now();
    const { save, remove } = healthWrites(healthRecords(current, at), ledger, at);
    if (save.length === 0 && remove.length === 0) {
      if (snapshot.failed) publish({ failed: false });
      return;
    }
    let failed = false;
    for (const kind of kinds) {
      const records = save.filter((record) => record.kind === kind);
      for (let index = 0; index < records.length && writing(); index += batch) {
        const part = records.slice(index, index + batch);
        try {
          await device.save(part);
          for (const { id, version, source } of part) ledger[id] = { version, source };
        } catch {
          failed = true;
          break;
        }
      }
      const ids = remove.filter((id) => healthKind(id) === kind);
      if (ids.length === 0 || !writing()) continue;
      try {
        await device.remove(kind, ids);
        for (const id of ids) delete ledger[id];
      } catch {
        failed = true;
      }
    }
    try {
      await storage.setItem(healthLedgerKey, serializeHealthLedger(ledger));
    } catch {
      failed = true;
    }
    if (active) publish({ failed });
  }

  async function checkAccess(ask: boolean) {
    const access = await (ask ? device.request() : device.access()).catch(
      (): HealthAccess => "unavailable",
    );
    if (active) publish({ access });
  }

  /** Rechecks access, e.g. back from the system settings, and syncs what changed meanwhile. */
  async function refresh() {
    if (!snapshot.enabled) return;
    await checkAccess(false);
    sync();
  }

  return {
    name: device.name,
    openSettings: () => device.openSettings(),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    start() {
      if (active) return;
      active = true;
      void setting
        .load()
        .catch(() => false)
        .then((enabled) => {
          if (!active) return;
          publish({ enabled });
          void refresh();
        });
    },
    stop() {
      active = false;
    },
    retryLoad: () => void refresh(),
    refresh,
    /** The latest saved documents, or null while any of them isn't loaded. */
    setSources(next: HealthSources | null) {
      sources = next;
      sync();
    },
    /** Turning it on asks for write access the first time. */
    async setEnabled(enabled: boolean) {
      if (snapshot.busy || snapshot.enabled === null) return;
      publish({ busy: true, error: null });
      try {
        await setting.save(enabled);
      } catch {
        publish({ busy: false, error: "Couldn't save this setting. Try again." });
        return;
      }
      publish({ enabled, failed: false });
      if (enabled) {
        await checkAccess(false);
        if (snapshot.access === "undetermined") await checkAccess(true);
      }
      publish({ busy: false });
      sync();
    },
    async connect() {
      if (snapshot.busy) return;
      publish({ busy: true });
      await checkAccess(true);
      publish({ busy: false });
      sync();
    },
  };
}

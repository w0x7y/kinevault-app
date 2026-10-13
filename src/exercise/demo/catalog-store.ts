import { catalogColumns, parseCatalogRows, type CatalogExercise } from "./catalog.ts";
import type { DemoCatalogConfig } from "./config.ts";

export type DemoCatalogState =
  | { kind: "loading" }
  | { kind: "failed" }
  | {
      kind: "ready";
      entries: CatalogExercise[];
      byId: ReadonlyMap<string, CatalogExercise>;
      fetchedAt: number;
    };
export type CatalogFetch = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
export type CatalogStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

// A device cache of public data, kept across sign-out.
export const demoCatalogStorageKey = "kinevault-track.demo-catalog.v1";
export const demoCatalogMaxAgeMs = 24 * 60 * 60 * 1000;
const pageSize = 500;
const rowLimit = 5000;

function readyState(rows: unknown[], fetchedAt: number): DemoCatalogState {
  const entries = parseCatalogRows(rows);
  return {
    kind: "ready",
    entries,
    byId: new Map(entries.map((entry) => [entry.id, entry])),
    fetchedAt,
  };
}

function parseCache(raw: string | null): { rows: unknown[]; fetchedAt: number } | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { version, fetchedAt, rows } = value as Record<string, unknown>;
    if (version !== 1 || typeof fetchedAt !== "number" || !Number.isFinite(fetchedAt)) return null;
    return Array.isArray(rows) ? { rows, fetchedAt } : null;
  } catch {
    return null;
  }
}

export function createDemoCatalogStore({
  config,
  fetch,
  storage,
  now,
}: {
  config: DemoCatalogConfig | null;
  fetch: CatalogFetch;
  storage: CatalogStorage;
  now: () => number;
}) {
  let state: DemoCatalogState = { kind: "loading" };
  let started: Promise<void> | null = null;
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  function set(next: DemoCatalogState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  async function download(): Promise<unknown[]> {
    if (!config) throw new Error("Demos aren't configured for this build");
    const rows: unknown[] = [];
    for (let offset = 0; offset < rowLimit; offset += pageSize) {
      const response = await fetch(
        `${config.url}/rest/v1/catalog_exercises?select=${catalogColumns}&order=id.asc&limit=${pageSize}&offset=${offset}`,
        { headers: { apikey: config.key, Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("Catalog request failed");
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error("Invalid catalog response");
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }

  function start(): Promise<void> {
    started ??= (async () => {
      try {
        const saved = parseCache(await storage.getItem(demoCatalogStorageKey));
        if (saved && state.kind === "loading") set(readyState(saved.rows, saved.fetchedAt));
      } catch {
        // An unreadable cache is replaced by the next download.
      }
    })();
    return started;
  }

  function refresh(): Promise<void> {
    inFlight ??= (async () => {
      try {
        await start();
        const rows = await download();
        const fetchedAt = now();
        set(readyState(rows, fetchedAt));
        try {
          await storage.setItem(
            demoCatalogStorageKey,
            JSON.stringify({ version: 1, fetchedAt, rows }),
          );
        } catch {
          // The in-memory copy still works; the next launch downloads again.
        }
      } catch {
        if (state.kind !== "ready") set({ kind: "failed" });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function refreshIfStale(): Promise<void> {
    await start();
    if (state.kind === "ready") {
      const age = now() - state.fetchedAt;
      if (age >= 0 && age < demoCatalogMaxAgeMs) return;
    }
    return refresh();
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    refreshIfStale,
    retry: refresh,
  };
}

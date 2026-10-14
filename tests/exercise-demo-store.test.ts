import assert from "node:assert/strict";
import test from "node:test";
import {
  createDemoCatalogStore,
  demoCatalogMaxAgeMs,
  demoCatalogMaxCacheChars,
  demoCatalogStorageKey,
  type CatalogFetch,
} from "../src/exercise/demo/catalog-store.ts";

const config = { url: "https://abc.supabase.co", key: "publishable" };
function row(index: number) {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  return {
    id,
    slug: `exercise-${index}`,
    name: `Exercise ${index}`,
    aliases: [],
    muscle_group: "",
    equipment: "",
    status: "published",
    video_path: `${id}/0123456789abcdef.mp4`,
    poster_path: `${id}/fedcba9876543210.webp`,
    credit: "Demonstration: KineVault.",
  };
}
function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
function fakeFetch(pages: unknown[][] | "fail") {
  const urls: string[] = [];
  const headers: Record<string, string>[] = [];
  const fetch: CatalogFetch = async (url, init) => {
    urls.push(url);
    headers.push(init.headers);
    if (pages === "fail") return { ok: false, json: async () => ({}) };
    const page = pages[urls.length - 1] ?? [];
    return { ok: true, json: async () => page };
  };
  return { fetch, urls, headers };
}
function store({
  pages = [[row(1)]] as unknown[][] | "fail",
  storage = memoryStorage(),
  now = 1_000_000,
  configured = true,
  maxCacheChars,
}: {
  pages?: unknown[][] | "fail";
  storage?: ReturnType<typeof memoryStorage>;
  now?: number;
  configured?: boolean;
  maxCacheChars?: number;
} = {}) {
  const transport = fakeFetch(pages);
  const clock = { now };
  const catalog = createDemoCatalogStore({
    config: configured ? config : null,
    fetch: transport.fetch,
    storage,
    now: () => clock.now,
    ...(maxCacheChars === undefined ? {} : { maxCacheChars }),
  });
  return { catalog, transport, storage, clock };
}

test("the first refresh downloads, caches and exposes the catalog", async () => {
  const { catalog, transport, storage } = store();
  assert.equal(catalog.getSnapshot().kind, "loading");
  await catalog.refreshIfStale();
  const state = catalog.getSnapshot();
  assert.equal(state.kind, "ready");
  assert.equal(state.kind === "ready" && state.byId.get(row(1).id)?.name, "Exercise 1");
  assert.equal(
    transport.urls[0],
    "https://abc.supabase.co/rest/v1/catalog_exercises?select=id,slug,name,aliases,muscle_group,equipment,status,video_path,poster_path,credit&order=id.asc&limit=500&offset=0",
  );
  assert.deepEqual(transport.headers[0], { apikey: "publishable", Accept: "application/json" });
  const saved = JSON.parse(storage.values.get(demoCatalogStorageKey)!);
  assert.deepEqual(saved, { version: 1, fetchedAt: 1_000_000, rows: [row(1)] });
});

test("a fresh cached copy is used without a request; a stale one is refreshed", async () => {
  const cached = JSON.stringify({ version: 1, fetchedAt: 1_000_000, rows: [row(2)] });
  const fresh = store({ storage: memoryStorage({ [demoCatalogStorageKey]: cached }) });
  await fresh.catalog.refreshIfStale();
  assert.equal(fresh.transport.urls.length, 0);
  assert.equal(fresh.catalog.getSnapshot().kind, "ready");
  const stale = store({
    storage: memoryStorage({ [demoCatalogStorageKey]: cached }),
    now: 1_000_000 + demoCatalogMaxAgeMs,
  });
  await stale.catalog.refreshIfStale();
  assert.equal(stale.transport.urls.length, 1);
});

test("a cached copy from the future counts as stale", async () => {
  const cached = JSON.stringify({ version: 1, fetchedAt: 9_000_000, rows: [row(2)] });
  const { catalog, transport } = store({
    storage: memoryStorage({ [demoCatalogStorageKey]: cached }),
  });
  await catalog.refreshIfStale();
  assert.equal(transport.urls.length, 1);
});

test("full pages are followed by the next page, up to 5,000 rows", async () => {
  const full = Array.from({ length: 500 }, (_, index) => row(index + 1));
  const paged = store({ pages: [full, [row(501)]] });
  await paged.catalog.refreshIfStale();
  assert.equal(paged.transport.urls.length, 2);
  assert.match(paged.transport.urls[1]!, /offset=500$/);
  const endless = store({ pages: Array.from({ length: 20 }, () => full) });
  await endless.catalog.refreshIfStale();
  assert.equal(endless.transport.urls.length, 10);
});

test("a failed first load is reported; a failed refresh keeps the saved copy", async () => {
  const failed = store({ pages: "fail" });
  await failed.catalog.refreshIfStale();
  assert.equal(failed.catalog.getSnapshot().kind, "failed");
  const cached = JSON.stringify({ version: 1, fetchedAt: 0, rows: [row(3)] });
  const kept = store({
    pages: "fail",
    storage: memoryStorage({ [demoCatalogStorageKey]: cached }),
    now: demoCatalogMaxAgeMs + 1,
  });
  await kept.catalog.refreshIfStale();
  assert.equal(kept.transport.urls.length, 1);
  const state = kept.catalog.getSnapshot();
  assert.equal(state.kind === "ready" && state.entries[0]?.name, "Exercise 3");
});

test("concurrent refreshes share one request", async () => {
  const { catalog, transport } = store();
  await Promise.all([catalog.refreshIfStale(), catalog.refreshIfStale(), catalog.retry()]);
  assert.equal(transport.urls.length, 1);
});

test("an unconfigured build fails without a request; a corrupt cache is ignored", async () => {
  const unconfigured = store({ configured: false });
  await unconfigured.catalog.refreshIfStale();
  assert.equal(unconfigured.catalog.getSnapshot().kind, "failed");
  assert.equal(unconfigured.transport.urls.length, 0);
  const corrupt = store({ storage: memoryStorage({ [demoCatalogStorageKey]: "{not json" }) });
  await corrupt.catalog.refreshIfStale();
  assert.equal(corrupt.transport.urls.length, 1);
  assert.equal(corrupt.catalog.getSnapshot().kind, "ready");
});

test("subscribers hear state changes", async () => {
  const { catalog } = store();
  const kinds: string[] = [];
  const unsubscribe = catalog.subscribe(() => kinds.push(catalog.getSnapshot().kind));
  await catalog.refreshIfStale();
  unsubscribe();
  assert.deepEqual(kinds, ["ready"]);
});

test("a row returned twice appears once, keeping its first occurrence and position", async () => {
  const changed = { ...row(1), name: "Changed" };
  const { catalog } = store({ pages: [[row(1), row(2), changed, row(3), row(2)]] });
  await catalog.refreshIfStale();
  const state = catalog.getSnapshot();
  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") return;
  assert.deepEqual(
    state.entries.map((entry) => entry.name),
    ["Exercise 1", "Exercise 2", "Exercise 3"],
  );
  assert.equal(state.byId.size, 3);
  assert.equal(state.byId.get(row(1).id), state.entries[0]);
});

test("a row repeated across pages appears once", async () => {
  const full = Array.from({ length: 500 }, (_, index) => row(index + 1));
  const { catalog } = store({ pages: [full, [row(500), row(501)]] });
  await catalog.refreshIfStale();
  const state = catalog.getSnapshot();
  assert.equal(state.kind === "ready" && state.entries.length, 501);
  assert.equal(state.kind === "ready" && new Set(state.entries.map((entry) => entry.id)).size, 501);
});

test("a repeated row in the saved copy appears once", async () => {
  const cached = JSON.stringify({ version: 1, fetchedAt: 1_000_000, rows: [row(2), row(2)] });
  const { catalog } = store({ storage: memoryStorage({ [demoCatalogStorageKey]: cached }) });
  await catalog.start();
  const state = catalog.getSnapshot();
  assert.equal(state.kind === "ready" && state.entries.length, 1);
});

test("a cache over the size limit stays in memory only", async () => {
  assert.equal(demoCatalogMaxCacheChars, 2_000_000);
  const pages = [[row(1), row(2)]];
  const serialized = JSON.stringify({ version: 1, fetchedAt: 1_000_000, rows: pages[0] });
  const exact = store({ pages, maxCacheChars: serialized.length });
  await exact.catalog.refreshIfStale();
  assert.equal(exact.storage.values.get(demoCatalogStorageKey), serialized);
  const over = store({ pages, maxCacheChars: serialized.length - 1 });
  await over.catalog.refreshIfStale();
  const state = over.catalog.getSnapshot();
  assert.equal(state.kind === "ready" && state.entries.length, 2);
  assert.equal(over.storage.values.has(demoCatalogStorageKey), false);
});

test("the default size limit skips a cache of about two million characters", async () => {
  const alias = "a".repeat(400);
  const heavy = (index: number) => ({ ...row(index), aliases: Array(50).fill(alias) });
  const rows = Array.from({ length: 101 }, (_, index) => heavy(index + 1));
  assert.ok(JSON.stringify({ version: 1, fetchedAt: 1_000_000, rows }).length > 2_000_000);
  const { catalog, storage } = store({ pages: [rows] });
  await catalog.refreshIfStale();
  assert.equal(catalog.getSnapshot().kind, "ready");
  assert.equal(storage.values.has(demoCatalogStorageKey), false);
  const small = store({ pages: [rows.slice(0, 50)] });
  await small.catalog.refreshIfStale();
  assert.equal(small.storage.values.has(demoCatalogStorageKey), true);
});

test("an oversized refresh leaves the earlier saved copy in place", async () => {
  const cached = JSON.stringify({ version: 1, fetchedAt: 0, rows: [row(3)] });
  const storage = memoryStorage({ [demoCatalogStorageKey]: cached });
  const { catalog } = store({
    pages: [[row(1)]],
    storage,
    now: demoCatalogMaxAgeMs + 1,
    maxCacheChars: 10,
  });
  await catalog.refreshIfStale();
  const state = catalog.getSnapshot();
  assert.equal(state.kind === "ready" && state.entries[0]?.name, "Exercise 1");
  assert.equal(storage.values.get(demoCatalogStorageKey), cached);
});

test("a refresh that fails while already failed does not notify again", async () => {
  const { catalog } = store({ pages: "fail" });
  let calls = 0;
  catalog.subscribe(() => calls++);
  await catalog.refreshIfStale();
  const failed = catalog.getSnapshot();
  assert.equal(failed.kind, "failed");
  assert.equal(calls, 1);
  await catalog.retry();
  await catalog.retry();
  assert.equal(calls, 1);
  assert.equal(catalog.getSnapshot(), failed);
});

test("a retry that succeeds after a failure still notifies", async () => {
  let failing = true;
  const catalog = createDemoCatalogStore({
    config,
    fetch: async () =>
      failing ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => [row(1)] },
    storage: memoryStorage(),
    now: () => 1_000_000,
  });
  const kinds: string[] = [];
  catalog.subscribe(() => kinds.push(catalog.getSnapshot().kind));
  await catalog.refreshIfStale();
  failing = false;
  await catalog.retry();
  assert.deepEqual(kinds, ["failed", "ready"]);
});

test("an empty saved catalog is refreshed even when it is recent", async () => {
  // A list saved before the first publish must not hide newly published demos for a day.
  const cached = JSON.stringify({ version: 1, fetchedAt: 1_000_000, rows: [] });
  const { catalog, transport } = store({
    storage: memoryStorage({ [demoCatalogStorageKey]: cached }),
  });
  await catalog.refreshIfStale();
  assert.equal(transport.urls.length, 1);
  const state = catalog.getSnapshot();
  assert.equal(state.kind === "ready" && state.entries.length, 1);
});

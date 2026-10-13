import assert from "node:assert/strict";
import test from "node:test";
import {
  createDemoCatalogStore,
  demoCatalogMaxAgeMs,
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
} = {}) {
  const transport = fakeFetch(pages);
  const clock = { now };
  const catalog = createDemoCatalogStore({
    config: configured ? config : null,
    fetch: transport.fetch,
    storage,
    now: () => clock.now,
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

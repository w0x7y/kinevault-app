import assert from "node:assert/strict";
import test from "node:test";
import { createDurableWrite, type DurableStorage } from "../src/persistence/durable-write.ts";

type Document = { count: number };
const encode = (count: number) => JSON.stringify({ count });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function parse(raw: string | null): Document {
  const value: unknown = raw === null ? { count: 0 } : JSON.parse(raw);
  if (typeof value !== "object" || value === null || !("count" in value)
    || typeof value.count !== "number" || !Number.isSafeInteger(value.count) || value.count < 0)
    throw new Error("Invalid count");
  return { count: value.count };
}
function fixture(initial: string | null = null) {
  let raw = initial;
  const calls: string[] = [];
  const storage: DurableStorage = {
    async getItem(key) { assert.equal(key, "test-document"); calls.push("read"); return raw; },
    async setItem(key, value) { assert.equal(key, "test-document"); calls.push("write"); raw = value; },
  };
  const store = createDurableWrite({ storage, key: "test-document", parse });
  const set = (count: number) => store.update(() => ({ document: { count }, value: true }), "Save failed");
  return { store, storage, calls, set, raw: () => raw };
}
async function ready(initial: string | null = null) {
  const f = fixture(initial);
  f.store.start(); await flush();
  assert.equal(f.store.getSnapshot().state.kind, "ready");
  return f;
}
function documentOf(store: ReturnType<typeof fixture>["store"]) {
  const state = store.getSnapshot().state;
  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") throw new Error("Document unavailable");
  return state.document;
}

test("construction and subscription are inert; snapshots are stable until publication", async () => {
  const { store, calls, set } = fixture();
  const initial = store.getSnapshot();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { ++notifications; });
  assert.equal(store.getSnapshot(), initial);
  store.retryLoad();
  assert.equal(await set(1), null);
  assert.deepEqual(calls, []);
  assert.equal(notifications, 0);
  store.start(); store.start(); await flush();
  assert.deepEqual(calls, ["read"]);
  assert.equal(notifications, 2);
  const loaded = store.getSnapshot();
  assert.equal(store.getSnapshot(), loaded);
  unsubscribe(); unsubscribe();
  await set(1);
  assert.equal(notifications, 2);
});

test("one write owns exclusion and publishes only a canonical durable success", async () => {
  const { store, storage, calls, set, raw } = await ready(encode(3));
  const gate = deferred<void>();
  const write = storage.setItem;
  storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const item = { id: "saved-item" };
  const input = { count: 4, ignoredByParser: true };
  const pending = store.update(() => ({ document: input, value: item }), "Save failed");
  input.count = 9;
  assert.equal(store.getSnapshot().saving, true);
  assert.deepEqual(documentOf(store), { count: 3 });
  assert.equal(raw(), encode(3));
  let competingBuilds = 0;
  assert.equal(await store.update(() => { ++competingBuilds; return { document: { count: 5 }, value: true }; }, "Failed"), null);
  assert.equal(await set(6), null);
  assert.equal(competingBuilds, 0);
  store.retryLoad(); store.start();
  assert.deepEqual(calls, ["read"]);
  gate.resolve();
  assert.equal(await pending, item);
  assert.deepEqual(documentOf(store), { count: 4 });
  assert.equal(raw(), JSON.stringify({ count: 4, ignoredByParser: true }));
  assert.equal(store.getSnapshot().saving, false);
  assert.equal(store.getSnapshot().error, null);
});

test("failed writes retain the saved document and clear their message on a successful retry", async () => {
  const { store, storage, set, raw } = await ready(encode(3));
  const previous = documentOf(store);
  const write = storage.setItem;
  storage.setItem = async () => { throw new Error("Disk full"); };
  assert.equal(await set(4), null);
  assert.equal(documentOf(store), previous);
  assert.equal(raw(), encode(3));
  assert.equal(store.getSnapshot().error, "Save failed");
  assert.equal(store.getSnapshot().saving, false);
  storage.setItem = write;
  assert.equal(await set(4), true);
  assert.equal(store.getSnapshot().error, null);
  assert.deepEqual(documentOf(store), { count: 4 });
});

test("build, serialization and canonical validation failures never write", async () => {
  const { store, calls, set, raw } = await ready(encode(3));
  const cyclic: Document & { self?: Document } = { count: 4 };
  cyclic.self = cyclic;
  const builds = [
    () => { throw new Error("Invalid mutation"); },
    () => ({ document: cyclic, value: true }),
    () => ({ document: { count: -1 }, value: true }),
  ];
  for (const build of builds) {
    assert.equal(await store.update(build, "Invalid change"), null);
    assert.equal(store.getSnapshot().error, "Invalid change");
    assert.equal(store.getSnapshot().saving, false);
    assert.deepEqual(documentOf(store), { count: 3 });
  }
  assert.deepEqual(calls, ["read"]);
  assert.equal(raw(), encode(3));
  assert.equal(await set(4), true);
});

test("domain rejections choose silent or visible feedback and successful values remain typed", async () => {
  const { store, calls } = await ready();
  assert.equal(await store.update(() => ({ error: "Check this draft" }), "Failed"), null);
  assert.equal(store.getSnapshot().error, "Check this draft");
  assert.equal(await store.update(() => ({ error: null }), "Failed"), null);
  assert.equal(store.getSnapshot().error, null);
  assert.equal(store.getSnapshot().saving, false);
  assert.deepEqual(calls, ["read"]);
  assert.equal(await store.update(() => ({ document: { count: 1 }, value: false }), "Failed"), false);
});

for (const outcome of ["success", "parse error", "read error"] as const) {
  for (const stopBeforeOlderOutcome of [false, true]) {
    test(`older load ${outcome} cannot replace a newer load${stopBeforeOlderOutcome ? " after stopping" : ""} without an intervening write`, async () => {
      const { store, storage, calls } = fixture();
      const older = deferred<string | null>();
      const newer = deferred<string | null>();
      let reads = 0;
      storage.getItem = () => {
        calls.push("read");
        return [older, newer][reads++]!.promise;
      };
      store.start(); store.retryLoad();
      assert.deepEqual(calls, ["read", "read"]);
      newer.resolve(encode(2)); await flush();
      assert.deepEqual(documentOf(store), { count: 2 });
      const loaded = store.getSnapshot();
      if (stopBeforeOlderOutcome) store.stop();
      if (outcome === "read error") older.reject(new Error("Unavailable"));
      else older.resolve(outcome === "parse error" ? "broken" : encode(1));
      await flush();
      assert.equal(store.getSnapshot(), loaded);
      assert.deepEqual(documentOf(store), { count: 2 });
      assert.deepEqual(calls, ["read", "read"]);
    });
  }

  test(`stale read ${outcome} cannot replace a later write`, async () => {
    const { store, storage, set } = fixture();
    const first = deferred<string | null>();
    const second = deferred<string | null>();
    let reads = 0;
    storage.getItem = () => [first, second][reads++]!.promise;
    store.start(); store.retryLoad();
    assert.equal(await set(1), null);
    second.resolve(encode(2)); await flush();
    assert.equal(await set(3), true);
    const saved = store.getSnapshot();
    if (outcome === "read error") first.reject(new Error("Unavailable"));
    else first.resolve(outcome === "parse error" ? "broken" : encode(1));
    await flush();
    assert.equal(store.getSnapshot(), saved);
    assert.deepEqual(documentOf(store), { count: 3 });
  });

  test(`read ${outcome} after stop is ignored and restart reloads`, async () => {
    const { store, storage, set } = fixture();
    const gate = deferred<string | null>();
    const read = storage.getItem;
    storage.getItem = () => gate.promise;
    store.start();
    const loading = store.getSnapshot();
    store.stop(); store.retryLoad();
    if (outcome === "read error") gate.reject(new Error("Unavailable"));
    else gate.resolve(outcome === "parse error" ? "broken" : encode(1));
    await flush();
    assert.equal(store.getSnapshot(), loading);
    assert.equal(await set(2), null);
    storage.getItem = read;
    store.start(); await flush();
    assert.deepEqual(documentOf(store), { count: 0 });
  });
}

for (const corruption of [true, false]) {
  test(`${corruption ? "corruption" : "read failure"} blocks writes until retry succeeds`, async () => {
    const { store, storage, set, calls } = fixture("broken");
    if (!corruption) storage.getItem = async () => { throw new Error("Unavailable"); };
    store.start(); await flush();
    assert.equal(store.getSnapshot().state.kind, "error");
    assert.equal(await set(1), null);
    assert.ok(!calls.includes("write"));
    storage.getItem = async () => encode(2);
    store.retryLoad(); await flush();
    assert.deepEqual(documentOf(store), { count: 2 });
    assert.equal(await set(3), true);
  });
}

for (const succeeds of [true, false]) {
  for (const restartBeforeCompletion of [true, false]) {
    test(`delayed write ${succeeds ? "success" : "failure"} ${restartBeforeCompletion ? "across restart" : "while stopped"} reloads durable data`, async () => {
      const { store, storage, calls, set } = await ready(encode(3));
      const gate = deferred<void>();
      const write = storage.setItem;
      storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
      const pending = set(4);
      store.stop();
      if (restartBeforeCompletion) { store.start(); store.stop(); store.start(); }
      const stoppedOrRestarted = store.getSnapshot();
      assert.equal(await set(5), null);
      store.retryLoad();
      assert.deepEqual(calls, ["read"]);
      if (succeeds) gate.resolve(); else gate.reject(new Error("Disk full"));
      assert.equal(await pending, null);
      await flush();
      if (!restartBeforeCompletion) {
        assert.equal(store.getSnapshot(), stoppedOrRestarted);
        assert.deepEqual(calls, succeeds ? ["read", "write"] : ["read"]);
        store.start(); await flush();
      }
      assert.deepEqual(documentOf(store), { count: succeeds ? 4 : 3 });
      assert.deepEqual(calls, succeeds ? ["read", "write", "read"] : ["read", "read"]);
      assert.equal(store.getSnapshot().saving, false);
      assert.equal(store.getSnapshot().error, null);
      storage.setItem = write;
      assert.equal(await set(5), true);
    });
  }
}

test("a subscriber can unsubscribe another listener during publication", async () => {
  const { store } = fixture();
  let notifications = 0;
  const unsubscribeFirst = store.subscribe(() => { unsubscribeSecond(); });
  const unsubscribeSecond = store.subscribe(() => { ++notifications; });
  store.start(); await flush();
  assert.equal(notifications, 0);
  unsubscribeFirst();
});

test("a subscriber replacing a load prevents the abandoned read from starting", async () => {
  const { store, calls } = fixture();
  let replaced = false;
  store.subscribe(() => {
    if (!replaced && store.getSnapshot().state.kind === "loading") {
      replaced = true;
      store.stop(); store.start();
    }
  });
  store.start(); await flush();
  assert.deepEqual(calls, ["read"]);
  assert.deepEqual(documentOf(store), { count: 0 });
});

test("a subscriber stopping at write start prevents storage work and releases exclusion", async () => {
  const { store, calls, set } = await ready();
  const unsubscribe = store.subscribe(() => { if (store.getSnapshot().saving) store.stop(); });
  assert.equal(await set(1), null);
  assert.deepEqual(calls, ["read"]);
  unsubscribe();
  store.start(); await flush();
  assert.equal(await set(2), true);
});

test("a subscriber restarting during durable publication makes the old result stale and reloads", async () => {
  const { store, calls, set } = await ready();
  let restarted = false;
  store.subscribe(() => {
    const { state } = store.getSnapshot();
    if (!restarted && state.kind === "ready" && state.document.count === 1) {
      restarted = true;
      store.stop(); store.start();
    }
  });
  assert.equal(await set(1), null);
  await flush();
  assert.deepEqual(documentOf(store), { count: 1 });
  assert.deepEqual(calls, ["read", "write", "read"]);
  assert.equal(await set(2), true);
});

test("a subscriber restarting during failure publication recovers without the stale error", async () => {
  const { store, storage, set } = await ready(encode(3));
  storage.setItem = async () => { throw new Error("Disk full"); };
  let restarted = false;
  store.subscribe(() => {
    if (!restarted && store.getSnapshot().error !== null) {
      restarted = true;
      store.stop(); store.start();
    }
  });
  assert.equal(await set(4), null);
  await flush();
  assert.deepEqual(documentOf(store), { count: 3 });
  assert.equal(store.getSnapshot().error, null);
  assert.equal(store.getSnapshot().saving, false);
});

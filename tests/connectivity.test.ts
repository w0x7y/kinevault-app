import assert from "node:assert/strict";
import test from "node:test";
import {
  connectivityStatus,
  createConnectivityStore,
  attachReconnectRetry,
} from "../src/connectivity/controller.ts";
import { createAccountStorage, type CloudDocument } from "../src/account/storage.ts";

test("unknown reachability never claims offline or online", () => {
  assert.equal(connectivityStatus({ isConnected: null, isInternetReachable: null }), "unknown");
  assert.equal(connectivityStatus({ isConnected: true, isInternetReachable: null }), "unknown");
  assert.equal(connectivityStatus({ isConnected: false, isInternetReachable: null }), "offline");
  assert.equal(connectivityStatus({ isConnected: true, isInternetReachable: false }), "offline");
  assert.equal(connectivityStatus({ isConnected: true, isInternetReachable: true }), "online");
});

test("reconnect retries once, waits for hydration, and cannot retry a stopped account owner", async () => {
  const store = createConnectivityStore();
  let attempts = 0;
  let finishHydration!: () => void;
  const hydrated = new Promise<void>((resolve) => {
    finishHydration = resolve;
  });
  const stop = attachReconnectRetry(store, hydrated, async () => {
    attempts++;
  });
  store.update({ isConnected: false, isInternetReachable: false });
  store.update({ isConnected: true, isInternetReachable: true });
  store.update({ isConnected: true, isInternetReachable: true });
  assert.equal(attempts, 0);
  finishHydration();
  await hydrated;
  await Promise.resolve();
  assert.equal(attempts, 1);
  store.update({ isConnected: false, isInternetReachable: false });
  stop();
  store.update({ isConnected: true, isInternetReachable: true });
  assert.equal(attempts, 1);
});

test("stopping during hydration and receiving stale native notifications are harmless", async () => {
  const store = createConnectivityStore();
  let attempts = 0;
  let finish!: () => void;
  const hydrated = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const stop = attachReconnectRetry(store, hydrated, async () => {
    attempts++;
  });
  store.update({ isConnected: true, isInternetReachable: true });
  stop();
  finish();
  await hydrated;
  await Promise.resolve();
  assert.equal(attempts, 0);
});

test("a rejected reconnect retry is contained and a later reconnect can retry again", async () => {
  const store = createConnectivityStore();
  let attempts = 0;
  const stop = attachReconnectRetry(store, Promise.resolve(), async () => {
    attempts++;
    throw new Error("unavailable");
  });
  await Promise.resolve();
  store.update({ isConnected: true, isInternetReachable: true });
  await Promise.resolve();
  store.update({ isConnected: false, isInternetReachable: false });
  store.update({ isConnected: true, isInternetReachable: true });
  await Promise.resolve();
  assert.equal(attempts, 2);
  stop();
});

test("a saved offline edit reaches cloud automatically after confirmed reconnection", async () => {
  const local = new Map<string, string>();
  const cloud = new Map<string, CloudDocument>();
  let online = false;
  let finished!: () => void;
  const synced = new Promise<void>((resolve) => {
    finished = resolve;
  });
  const storage = createAccountStorage({
    userId: "account-a",
    local: {
      async getItem(key) {
        return local.get(key) ?? null;
      },
      async setItem(key, value) {
        local.set(key, value);
      },
      async removeItem(key) {
        local.delete(key);
      },
    },
    remote: {
      async list() {
        if (!online) throw new Error("offline");
        return [...cloud.values()];
      },
      async save(key, payload, revision) {
        if (!online) throw new Error("offline");
        const row = { document_key: key, payload, revision: revision + 1 };
        cloud.set(key, row);
        return row;
      },
    },
  });
  const network = createConnectivityStore();
  network.update({ isConnected: false, isInternetReachable: false });
  const hydrated = storage.start();
  const stop = attachReconnectRetry(network, hydrated, async () => {
    await storage.retry();
    finished();
  });
  await hydrated;
  const key = "kinevault-track.water-goal.v1";
  const saved = JSON.stringify({ version: 1, dailyMl: 2500 });
  await storage.setItem(key, saved);
  assert.equal(await storage.getItem(key), saved);
  assert.equal(cloud.size, 0);
  online = true;
  network.update({ isConnected: true, isInternetReachable: true });
  await synced;
  assert.equal(cloud.get(key)?.payload, saved);
  assert.equal(storage.getSnapshot().state, "idle");
  stop();
  storage.stop();
});

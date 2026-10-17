import assert from "node:assert/strict";
import test from "node:test";
import {
  connectivityStatus,
  createConnectivityStore,
  attachReconnectRetry,
} from "../src/connectivity/controller.ts";

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

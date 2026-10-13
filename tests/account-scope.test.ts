import assert from "node:assert/strict";
import test from "node:test";
import { createAccountScope } from "../src/account/scope.ts";
import {
  createAccountStorage,
  type AccountLocalStorage,
  type AccountRemote,
  type CloudDocument,
} from "../src/account/storage.ts";
import { createConnectivityStore } from "../src/connectivity/controller.ts";
import { parseProfile } from "../src/profile/model.ts";
import { profileStorageKey } from "../src/profile/persistence.ts";

const profile = (name: string) => {
  const document = parseProfile(null);
  return JSON.stringify({ ...document, answers: { ...document.answers, name } });
};
const settle = async () => {
  for (let index = 0; index < 10; index++) await new Promise((resolve) => setImmediate(resolve));
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function memory() {
  const values = new Map<string, string>();
  const storage: AccountLocalStorage = {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
  return { storage, values };
}
function server(initial: CloudDocument[] = []) {
  const rows = new Map(initial.map((row) => [row.document_key, row]));
  let online = true;
  let lists = 0;
  const remote: AccountRemote = {
    async list() {
      lists++;
      if (!online) throw new Error("Offline");
      return [...rows.values()].map((row) => ({ ...row }));
    },
    async save(key, payload, revision) {
      if (!online) throw new Error("Offline");
      if ((rows.get(key)?.revision ?? 0) !== revision) return null;
      const row = { document_key: key, payload, revision: revision + 1 };
      rows.set(key, row);
      return { ...row };
    },
  };
  return {
    remote,
    lists: () => lists,
    offline: () => {
      online = false;
    },
    online: () => {
      online = true;
    },
  };
}
function harness(userId: string | null, local: AccountLocalStorage, remote: AccountRemote | null) {
  const calls: string[] = [];
  const storage = createAccountStorage({ userId, local, remote });
  const connectivity = createConnectivityStore();
  const scope = createAccountScope({
    userId,
    connectivity,
    storage: {
      getSnapshot: storage.getSnapshot,
      getItem: storage.getItem,
      start() {
        calls.push("start");
        return storage.start();
      },
      stop() {
        calls.push("stop");
        storage.stop();
      },
      retry() {
        calls.push("retry");
        return storage.retry();
      },
    },
  });
  const states: string[] = [];
  scope.subscribe(() => states.push(scope.getSnapshot()));
  const reconnect = () => {
    connectivity.update({ isConnected: false, isInternetReachable: false });
    connectivity.update({ isConnected: true, isInternetReachable: true });
  };
  return { scope, storage, calls, states, reconnect };
}

test("a signed-in Account with a Profile on this device opens offline after sync fails", async () => {
  const local = memory();
  const cloud = server();
  const earlier = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await earlier.start();
  await earlier.setItem(profileStorageKey, profile("Offline"));
  earlier.stop();
  cloud.offline();
  const { scope, storage, states } = harness("a", local.storage, cloud.remote);
  scope.start();
  await settle();
  assert.notEqual(storage.getSnapshot().error, null);
  assert.equal(scope.getSnapshot(), "ready");
  assert.deepEqual(states, ["ready"]);
  scope.stop();
});

test("without a Profile on this device a failed sync blocks entry until reconnecting succeeds", async () => {
  const local = memory();
  const cloud = server([
    { document_key: profileStorageKey, payload: profile("Cloud"), revision: 1 },
  ]);
  cloud.offline();
  const { scope, states, calls, reconnect } = harness("a", local.storage, cloud.remote);
  scope.start();
  await settle();
  assert.equal(scope.getSnapshot(), "error");
  reconnect();
  await settle();
  assert.equal(scope.getSnapshot(), "error");
  cloud.online();
  reconnect();
  await settle();
  assert.equal(scope.getSnapshot(), "ready");
  assert.deepEqual(states, ["error", "ready"]);
  assert.deepEqual(calls, ["start", "retry", "retry"]);
  scope.stop();
});

test("a guest opens without cloud calls or reconnect retries", async () => {
  const local = memory();
  const { scope, calls, reconnect } = harness(null, local.storage, {
    list() {
      throw new Error("Guest cloud access");
    },
    save() {
      throw new Error("Guest cloud access");
    },
  });
  scope.start();
  await settle();
  assert.equal(scope.getSnapshot(), "ready");
  reconnect();
  await settle();
  assert.deepEqual(calls, ["start"]);
  scope.stop();
});

test("stopping during start leaves no late state change and ignores reconnects", async () => {
  const local = memory();
  const listed = deferred<CloudDocument[]>();
  let lists = 0;
  const { scope, states, calls, reconnect } = harness("a", local.storage, {
    list() {
      lists++;
      return listed.promise;
    },
    async save() {
      throw new Error("Offline");
    },
  });
  scope.start();
  await settle();
  assert.equal(lists, 1);
  scope.stop();
  listed.reject(new Error("Offline"));
  await settle();
  reconnect();
  await settle();
  assert.equal(scope.getSnapshot(), "loading");
  assert.deepEqual(states, []);
  assert.deepEqual(calls, ["start", "stop"]);
  assert.equal(lists, 1);
});

test("Try again stops storage, then starts a fresh attempt", async () => {
  const local = memory();
  const cloud = server();
  cloud.offline();
  const { scope, states, calls } = harness("a", local.storage, cloud.remote);
  scope.start();
  await settle();
  assert.equal(scope.getSnapshot(), "error");
  cloud.online();
  scope.retry();
  assert.equal(scope.getSnapshot(), "loading");
  assert.deepEqual(calls, ["start", "stop", "start"]);
  await settle();
  assert.equal(scope.getSnapshot(), "ready");
  assert.deepEqual(states, ["error", "loading", "ready"]);
  assert.equal(cloud.lists(), 2);
  scope.stop();
  scope.retry();
  assert.deepEqual(calls, ["start", "stop", "start", "stop"]);
});

test("a stale attempt cannot publish after Try again starts a newer one", async () => {
  const local = memory();
  const first = deferred<CloudDocument[]>();
  let lists = 0;
  const { scope, states } = harness("a", local.storage, {
    list() {
      return ++lists === 1 ? first.promise : Promise.reject(new Error("Offline"));
    },
    async save() {
      throw new Error("Offline");
    },
  });
  scope.start();
  await settle();
  scope.retry();
  await settle();
  assert.equal(scope.getSnapshot(), "error");
  first.resolve([]);
  await settle();
  assert.equal(scope.getSnapshot(), "error");
  assert.deepEqual(states, ["error"]);
  scope.stop();
});

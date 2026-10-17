import assert from "node:assert/strict";
import test from "node:test";
import {
  createProfilePersistence,
  profileStorageKey,
  type ProfileStorage,
} from "../src/profile/persistence.ts";
import { parseProfile, type ProfileDocument } from "../src/profile/model.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function draft(name: string): ProfileDocument {
  const document = parseProfile(null);
  return { ...document, answers: { ...document.answers, name } };
}
function memory(initial: string | null = null) {
  let raw = initial;
  const calls: string[] = [];
  const storage: ProfileStorage = {
    async getItem(key) {
      assert.equal(key, profileStorageKey);
      calls.push("read");
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, profileStorageKey);
      calls.push("write");
      raw = value;
    },
    async removeItem(key) {
      assert.equal(key, profileStorageKey);
      calls.push("remove");
      raw = null;
    },
  };
  return { storage, calls, raw: () => raw };
}
async function ready(initial: string | null = null) {
  const store = memory(initial);
  const profile = createProfilePersistence(store.storage);
  profile.start();
  await flush();
  assert.equal(profile.getSnapshot().state.kind, "ready");
  return { ...store, profile };
}
function documentOf(profile: ReturnType<typeof createProfilePersistence>) {
  const state = profile.getSnapshot().state;
  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") throw new Error("Expected ready Profile");
  return state.document;
}

test("save, reset, and retry cannot overlap an active write", async () => {
  const { profile, storage, calls } = await ready();
  const gate = deferred<void>();
  const write = storage.setItem;
  storage.setItem = async (key, value) => {
    await gate.promise;
    await write(key, value);
  };
  const result = profile.save(draft("First"));
  assert.equal(await profile.save(draft("Second")), false);
  await profile.reset();
  profile.retryLoad();
  assert.deepEqual(calls, ["read"]);
  gate.resolve();
  assert.equal(await result, true);
  assert.deepEqual(calls, ["read", "write"]);
  assert.equal(documentOf(profile).answers.name, "First");
});

test("failed reset preserves saved data; successful reset clears storage before publishing", async () => {
  const { profile, storage, raw } = await ready(JSON.stringify(draft("Original")));
  const remove = storage.removeItem;
  storage.removeItem = async () => {
    throw new Error("unavailable");
  };
  await profile.reset();
  assert.equal(documentOf(profile).answers.name, "Original");
  assert.equal(parseProfile(raw()).answers.name, "Original");
  assert.match(profile.getSnapshot().error ?? "", /reset/);
  const gate = deferred<void>();
  storage.removeItem = async (key) => {
    await gate.promise;
    await remove(key);
  };
  const result = profile.reset();
  assert.equal(documentOf(profile).answers.name, "Original");
  gate.resolve();
  await result;
  assert.equal(raw(), null);
  assert.deepEqual(documentOf(profile), parseProfile(null));
  assert.equal(profile.getSnapshot().error, null);
});

test("reset recovers a corrupt Profile and supersedes an in-flight read", async () => {
  const corrupt = memory("broken");
  const recovery = createProfilePersistence(corrupt.storage);
  recovery.start();
  await flush();
  await recovery.reset();
  assert.deepEqual(documentOf(recovery), parseProfile(null));
  const store = memory(JSON.stringify(draft("Old")));
  const read = deferred<string | null>();
  store.storage.getItem = () => read.promise;
  const profile = createProfilePersistence(store.storage);
  profile.start();
  await profile.reset();
  read.resolve(JSON.stringify(draft("Old")));
  await flush();
  assert.deepEqual(documentOf(profile), parseProfile(null));
  assert.equal(store.raw(), null);
});

test("a failed reset while loading leaves recoverable error instead of a stuck spinner", async () => {
  const store = memory();
  const read = deferred<string | null>();
  store.storage.getItem = () => read.promise;
  store.storage.removeItem = async () => {
    throw new Error("unavailable");
  };
  const profile = createProfilePersistence(store.storage);
  profile.start();
  await profile.reset();
  assert.equal(profile.getSnapshot().state.kind, "error");
  read.resolve(null);
  await flush();
  assert.equal(profile.getSnapshot().state.kind, "error");
  store.storage.getItem = async () => null;
  profile.retryLoad();
  await flush();
  assert.equal(documentOf(profile).kind, "draft");
});

for (const command of ["save", "reset"] as const) {
  test(`stopping during ${command} feedback prevents a stale profile mutation`, async () => {
    const { profile, calls, raw } = await ready(JSON.stringify(draft("Original")));
    const unsubscribe = profile.subscribe(() => {
      if (profile.getSnapshot().saving) profile.stop();
    });
    if (command === "save") assert.equal(await profile.save(draft("Abandoned")), false);
    else await profile.reset();
    assert.deepEqual(calls, ["read"]);
    assert.equal(parseProfile(raw()).answers.name, "Original");
    unsubscribe();
    profile.start();
    await flush();
    assert.equal(await profile.save(draft("New lifecycle")), true);
  });
}

test("reset spanning stop/restart excludes new writes and reloads its durable removal", async () => {
  const { profile, storage, calls, raw } = await ready(JSON.stringify(draft("Original")));
  const gate = deferred<void>();
  const remove = storage.removeItem;
  storage.removeItem = async (key) => {
    await gate.promise;
    await remove(key);
  };
  const resetting = profile.reset();
  profile.stop();
  profile.start();
  assert.equal(await profile.save(draft("Competing")), false);
  profile.retryLoad();
  assert.deepEqual(calls, ["read"]);
  gate.resolve();
  await resetting;
  await flush();
  assert.equal(raw(), null);
  assert.deepEqual(documentOf(profile), parseProfile(null));
  assert.deepEqual(calls, ["read", "remove", "read"]);
  assert.equal(profile.getSnapshot().saving, false);
  assert.equal(await profile.save(draft("New lifecycle")), true);
});

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

test("construction is inert, snapshots are stable, and loading reads the versioned record", async () => {
  const store = memory(JSON.stringify(draft("Saved")));
  const profile = createProfilePersistence(store.storage);
  assert.deepEqual(store.calls, []);
  assert.equal(profile.getSnapshot(), profile.getSnapshot());
  let notifications = 0;
  const unsubscribe = profile.subscribe(() => notifications++);
  profile.start();
  profile.start();
  await flush();
  assert.deepEqual(store.calls, ["read"]);
  assert.equal(documentOf(profile).answers.name, "Saved");
  assert.ok(notifications > 0);
  unsubscribe();
  profile.stop();
});

test("unreadable and malformed storage require recovery; retry can restore the saved Profile", async () => {
  for (const raw of ["broken", JSON.stringify({ version: 2 })]) {
    const store = memory(raw);
    const profile = createProfilePersistence(store.storage);
    profile.start();
    await flush();
    assert.equal(profile.getSnapshot().state.kind, "error");
    await store.storage.setItem(profileStorageKey, JSON.stringify(draft("Recovered")));
    profile.retryLoad();
    await flush();
    assert.equal(documentOf(profile).answers.name, "Recovered");
  }
  const store = memory();
  const read = store.storage.getItem;
  store.storage.getItem = async () => {
    throw new Error("unavailable");
  };
  const profile = createProfilePersistence(store.storage);
  profile.start();
  await flush();
  assert.equal(profile.getSnapshot().state.kind, "error");
  store.storage.getItem = read;
  profile.retryLoad();
  await flush();
  assert.equal(documentOf(profile).kind, "draft");
});

test("save publishes only after durable success and captures a canonical copy", async () => {
  const { profile, storage, raw } = await ready();
  const write = storage.setItem;
  const gate = deferred<void>();
  storage.setItem = async (key, value) => {
    await gate.promise;
    await write(key, value);
  };
  const previous = documentOf(profile);
  const submitted = draft("Submitted");
  const result = profile.save(submitted);
  submitted.answers.name = "Changed while saving";
  assert.equal(profile.getSnapshot().saving, true);
  assert.equal(documentOf(profile), previous);
  assert.equal(raw(), null);
  gate.resolve();
  assert.equal(await result, true);
  assert.equal(profile.getSnapshot().saving, false);
  assert.equal(documentOf(profile).answers.name, "Submitted");
  assert.deepEqual(documentOf(profile), parseProfile(raw()));
});

test("a failed save preserves the Profile and permits retry; invalid documents never write", async () => {
  const { profile, storage, raw, calls } = await ready(JSON.stringify(draft("Original")));
  const write = storage.setItem;
  storage.setItem = async () => {
    throw new Error("disk full");
  };
  assert.equal(await profile.save(draft("New")), false);
  assert.equal(documentOf(profile).answers.name, "Original");
  assert.equal(parseProfile(raw()).answers.name, "Original");
  assert.match(profile.getSnapshot().error ?? "", /save/);
  assert.equal(profile.getSnapshot().saving, false);
  storage.setItem = write;
  assert.equal(await profile.save(draft("New")), true);
  assert.equal(profile.getSnapshot().error, null);
  const invalid = draft("x".repeat(41));
  const writes = calls.filter((call) => call === "write").length;
  assert.equal(await profile.save(invalid), false);
  assert.equal(calls.filter((call) => call === "write").length, writes);
  assert.equal(documentOf(profile).answers.name, "New");
});

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

test("newer loads win over stale successes and failures", async () => {
  const store = memory();
  const old = deferred<string | null>();
  const latest = deferred<string | null>();
  store.storage.getItem = () => old.promise;
  const profile = createProfilePersistence(store.storage);
  profile.start();
  store.storage.getItem = () => latest.promise;
  profile.retryLoad();
  latest.resolve(JSON.stringify(draft("Latest")));
  await flush();
  old.reject(new Error("stale"));
  await flush();
  assert.equal(documentOf(profile).answers.name, "Latest");
});

test("stop cancels publication and restart reads again while keeping subscriptions", async () => {
  const store = memory();
  const old = deferred<string | null>();
  store.storage.getItem = () => old.promise;
  const profile = createProfilePersistence(store.storage);
  let changes = 0;
  profile.subscribe(() => changes++);
  profile.start();
  profile.stop();
  const stoppedChanges = changes;
  old.resolve(JSON.stringify(draft("Old")));
  await flush();
  assert.equal(changes, stoppedChanges);
  assert.equal(await profile.save(draft("Inactive")), false);
  store.storage.getItem = async () => JSON.stringify(draft("Restarted"));
  profile.start();
  await flush();
  assert.equal(documentOf(profile).answers.name, "Restarted");
  assert.ok(changes > stoppedChanges);
});

test("a write spanning stop/restart cannot publish or allow a competing write; restart reloads it", async () => {
  const { profile, storage, raw } = await ready();
  const gate = deferred<void>();
  const write = storage.setItem;
  storage.setItem = async (key, value) => {
    await gate.promise;
    await write(key, value);
  };
  const result = profile.save(draft("Persisted"));
  profile.stop();
  profile.start();
  assert.equal(await profile.save(draft("Competing")), false);
  gate.resolve();
  assert.equal(await result, false);
  await flush();
  assert.equal(documentOf(profile).answers.name, "Persisted");
  assert.equal(parseProfile(raw()).answers.name, "Persisted");
  assert.equal(profile.getSnapshot().saving, false);
});

test("stopping during loading feedback prevents the abandoned profile read", async () => {
  const { storage, calls } = memory();
  const profile = createProfilePersistence(storage);
  const unsubscribe = profile.subscribe(() => {
    if (profile.getSnapshot().state.kind === "loading") profile.stop();
  });
  profile.start();
  await flush();
  assert.deepEqual(calls, []);
  unsubscribe();
  profile.start();
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

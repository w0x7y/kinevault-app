import assert from "node:assert/strict";
import test from "node:test";
import {
  createAccountStorage,
  type AccountLocalStorage,
  type AccountRemote,
  type CloudDocument,
} from "../src/account/storage.ts";
import { parseProfile } from "../src/profile/model.ts";

const goalKey = "kinevault-track.water-goal.v1";
const exerciseKey = "kinevault-track.exercise.v1";
const mediaKey = "kinevault-track.profile-media.v1";
const profileKey = "kinevault-track.profile.v1";
const recoveryKey = "kinevault-track.recovered-setup.v1";
const goal = (dailyMl: number) => JSON.stringify({ version: 1, dailyMl });
const profile = (name: string) => {
  const document = parseProfile(null);
  return JSON.stringify({ ...document, answers: { ...document.answers, name } });
};
const flush = async () => {
  for (let index = 0; index < 40; index++) await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
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
  const remote: AccountRemote = {
    async list() {
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
    rows,
    offline: () => {
      online = false;
    },
    online: () => {
      online = true;
    },
  };
}

test("guest reads and writes legacy data without cloud calls", async () => {
  const local = memory({ [goalKey]: goal(1800) });
  const store = createAccountStorage({
    userId: null,
    local: local.storage,
    remote: {
      list() {
        throw new Error("Guest cloud access");
      },
      save() {
        throw new Error("Guest cloud access");
      },
    },
  });
  await store.start();
  assert.equal(await store.getItem(goalKey), goal(1800));
  await store.setItem(goalKey, goal(2000));
  assert.equal(local.values.get(goalKey), goal(2000));
  await store.removeItem(goalKey);
  assert.equal(await store.getItem(goalKey), null);
});

test("authenticated users have isolated local data and media remains local", async () => {
  const local = memory(),
    cloudA = server(),
    cloudB = server();
  const a = createAccountStorage({ userId: "a", local: local.storage, remote: cloudA.remote });
  const b = createAccountStorage({ userId: "b", local: local.storage, remote: cloudB.remote });
  await a.start();
  await a.setItem(goalKey, goal(2400));
  await a.setItem(mediaKey, '{"version":1,"avatar":null,"photos":[]}');
  await a.retry();
  a.stop();
  await b.start();
  assert.equal(await b.getItem(goalKey), null);
  assert.equal(await b.getItem(mediaKey), null);
  assert.equal(cloudA.rows.get(goalKey)?.payload, goal(2400));
  assert.equal(cloudA.rows.has(mediaKey), false);
  assert.equal(local.values.has(goalKey), false);
});

test("cloud data hydrates all stats sources without overwriting existing remote profile", async () => {
  const local = memory({ [goalKey]: goal(2000) });
  const cloud = server([{ document_key: goalKey, payload: goal(3000), revision: 4 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  assert.equal(await store.getItem(goalKey), goal(3000));
  assert.equal(cloud.rows.get(goalKey)?.revision, 4);
  assert.equal(local.values.get(goalKey), goal(2000));
});

test("valid cached legacy profile shapes are normalized before saving and comparing cloud results", async () => {
  const legacy = JSON.parse(profile("Legacy cached user"));
  delete legacy.answers.customCarbs;
  delete legacy.answers.customProtein;
  delete legacy.answers.customFat;
  const raw = JSON.stringify(legacy);
  const local = memory({
    [`kinevault-track.account.a.${profileKey}`]: JSON.stringify({
      version: 1,
      payload: raw,
      revision: 0,
      dirty: true,
      sequence: 1,
    }),
  });
  const cloud = server(),
    store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  assert.equal(store.getSnapshot().state, "idle");
  assert.equal(cloud.rows.get(profileKey)?.payload, JSON.stringify(parseProfile(raw)));
  assert.equal(await store.retry(), true);
  assert.deepEqual(store.getSnapshot().conflicts, []);
});

test("reset can replace an uncached damaged profile payload while preserving its cloud revision", async () => {
  for (const damaged of ["{broken", JSON.stringify({ version: 2 })]) {
    const local = memory({
      [`kinevault-track.account.a.${profileKey}`]: JSON.stringify({
        version: 1,
        payload: damaged,
        revision: 2,
        dirty: false,
        sequence: 7,
      }),
    });
    const cloud = server([
      { document_key: profileKey, payload: profile("Saved user"), revision: 2 },
    ]);
    const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
    await store.start();
    assert.equal(store.getSnapshot().state, "error");
    await store.removeItem(profileKey);
    assert.equal(await store.retry(), true);
    assert.equal(await store.getItem(profileKey), null);
    assert.equal(cloud.rows.get(profileKey)?.payload, null);
    assert.equal(cloud.rows.get(profileKey)?.revision, 3);
  }
});

test("guest import is claimed once and recovery copies remain available", async () => {
  const local = memory({ [goalKey]: goal(1800) }),
    cloudA = server(),
    cloudB = server();
  const a = createAccountStorage({ userId: "a", local: local.storage, remote: cloudA.remote });
  await a.start();
  assert.equal(cloudA.rows.get(goalKey)?.payload, goal(1800));
  a.stop();
  const b = createAccountStorage({ userId: "b", local: local.storage, remote: cloudB.remote });
  await b.start();
  assert.equal(await b.getItem(goalKey), null);
  assert.equal(cloudB.rows.size, 0);
  assert.equal(local.values.get(goalKey), goal(1800));
});

test("offline local writes survive restart and sync after connectivity returns", async () => {
  const local = memory(),
    cloud = server();
  const first = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await first.start();
  cloud.offline();
  await first.setItem(goalKey, goal(2300));
  await first.retry();
  first.stop();
  const second = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await second.start();
  assert.equal(await second.getItem(goalKey), goal(2300));
  assert.equal(second.getSnapshot().state, "error");
  cloud.online();
  await second.retry();
  assert.equal(cloud.rows.get(goalKey)?.payload, goal(2300));
  assert.equal(second.getSnapshot().state, "idle");
});

test("deletion tombstones survive offline restart and prevent cloud resurrection", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(2000), revision: 1 }]);
  const first = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await first.start();
  cloud.offline();
  await first.removeItem(goalKey);
  await first.retry();
  first.stop();
  const second = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  cloud.online();
  await second.start();
  assert.equal(await second.getItem(goalKey), null);
  assert.equal(cloud.rows.get(goalKey)?.payload, null);
  const third = createAccountStorage({
    userId: "a",
    local: memory().storage,
    remote: cloud.remote,
  });
  await third.start();
  assert.equal(await third.getItem(goalKey), null);
});

test("conflicts preserve both versions until the user chooses cloud", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(1800), revision: 1 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  cloud.offline();
  await store.setItem(goalKey, goal(2100));
  await store.retry();
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2500), revision: 2 });
  cloud.online();
  await store.retry();
  assert.equal(await store.getItem(goalKey), goal(2100));
  assert.equal(cloud.rows.get(goalKey)?.payload, goal(2500));
  assert.deepEqual(store.getSnapshot().conflicts, [goalKey]);
  await store.resolveConflict(goalKey, "cloud");
  assert.equal(await store.getItem(goalKey), goal(2500));
  assert.equal(store.getSnapshot().state, "idle");
});

test("choosing local resolves a conflict against the current server revision", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(1800), revision: 1 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  cloud.offline();
  await store.setItem(goalKey, goal(2100));
  await store.retry();
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2500), revision: 2 });
  cloud.online();
  await store.retry();
  await store.resolveConflict(goalKey, "local");
  assert.equal(cloud.rows.get(goalKey)?.payload, goal(2100));
  assert.equal(cloud.rows.get(goalKey)?.revision, 3);
});

test("a local edit while an upload is pending remains dirty and reaches the cloud", async () => {
  const local = memory(),
    cloud = server(),
    gate = deferred<void>(),
    started = deferred<void>();
  const save = cloud.remote.save;
  let gated = true;
  cloud.remote.save = async (...args) => {
    if (gated) {
      gated = false;
      started.resolve();
      await gate.promise;
    }
    return save(...args);
  };
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  await store.setItem(goalKey, goal(1800));
  await started.promise;
  await store.setItem(goalKey, goal(2400));
  gate.resolve();
  await store.retry();
  assert.equal(await store.getItem(goalKey), goal(2400));
  assert.equal(cloud.rows.get(goalKey)?.payload, goal(2400));
});

test("stopping during download prevents late hydration and future cloud writes", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(2800), revision: 1 }]);
  const gate = deferred<CloudDocument[]>();
  cloud.remote.list = () => gate.promise;
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  const starting = store.start();
  await flush();
  store.stop();
  gate.resolve([...cloud.rows.values()]);
  await starting;
  assert.equal(await store.getItem(goalKey), null);
  await store.setItem(goalKey, goal(2100));
  await flush();
  assert.equal(cloud.rows.get(goalKey)?.payload, goal(2800));
});

test("a remote save conflict is detected even if the preceding download was current", async () => {
  const local = memory(),
    cloud = server();
  const save = cloud.remote.save;
  cloud.remote.save = async (key, payload, revision) => {
    cloud.rows.set(key, { document_key: key, payload: goal(3000), revision: 1 });
    return save(key, payload, revision);
  };
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  await store.setItem(goalKey, goal(2100));
  await store.retry();
  assert.equal(await store.getItem(goalKey), goal(2100));
  assert.equal(cloud.rows.get(goalKey)?.payload, goal(3000));
  assert.deepEqual(store.getSnapshot().conflicts, [goalKey]);
});

test("malformed cloud documents cannot replace a valid cache", async () => {
  const local = memory(),
    cloud = server([
      {
        document_key: exerciseKey,
        payload: '{"version":1,"exercises":[],"workouts":[],"sessions":[]}',
        revision: 1,
      },
    ]);
  const first = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await first.start();
  first.stop();
  cloud.rows.set(exerciseKey, { document_key: exerciseKey, payload: "broken", revision: 2 });
  const second = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await second.start();
  assert.equal(
    await second.getItem(exerciseKey),
    '{"version":1,"exercises":[],"workouts":[],"sessions":[]}',
  );
  assert.equal(second.getSnapshot().state, "error");
});

test("an older download cannot roll back a newer cache committed while it was pending", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(1800), revision: 1 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  const gate = deferred<void>(),
    entered = deferred<void>(),
    list = cloud.remote.list;
  cloud.remote.list = async () => {
    const rows = await list();
    entered.resolve();
    await gate.promise;
    return rows;
  };
  const syncing = store.retry();
  await entered.promise;
  // Another browser tab shares the durable cache, but can finish a newer
  // upload while this tab still holds the earlier download snapshot.
  local.values.set(
    `kinevault-track.account.a.${goalKey}`,
    JSON.stringify({ version: 1, payload: goal(2600), revision: 2, dirty: false, sequence: 1 }),
  );
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2600), revision: 2 });
  gate.resolve();
  assert.equal(await syncing, false);
  assert.equal(await store.getItem(goalKey), goal(2600));
  cloud.remote.list = list;
  assert.equal(await store.retry(), true);
  assert.equal(await store.getItem(goalKey), goal(2600));
});

test("an edit to an already uploaded document is automatically synced after a later upload", async () => {
  const local = memory(),
    cloud = server(),
    gate = deferred<void>(),
    entered = deferred<void>();
  const save = cloud.remote.save;
  cloud.remote.save = async (...args) => {
    if (args[0] === goalKey) {
      entered.resolve();
      await gate.promise;
    }
    return save(...args);
  };
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  await store.setItem(exerciseKey, '{"version":1,"exercises":[],"workouts":[],"sessions":[]}');
  await store.setItem(goalKey, goal(2100));
  await entered.promise;
  await store.setItem(
    exerciseKey,
    '{"version":1,"exercises":[{"id":"press","name":"Press","muscleGroup":"","equipment":"","notes":"","tracking":"single"}],"workouts":[],"sessions":[]}',
  );
  gate.resolve();
  for (let index = 0; index < 30; index++) await flush();
  assert.equal(JSON.parse(cloud.rows.get(exerciseKey)!.payload!).exercises[0]?.name, "Press");
});

test("restarting an instance during an old download starts a fresh lifecycle", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(2200), revision: 1 }]);
  const gate = deferred<CloudDocument[]>(),
    entered = deferred<void>(),
    list = cloud.remote.list;
  let first = true;
  cloud.remote.list = () => {
    if (first) {
      first = false;
      entered.resolve();
      return gate.promise;
    }
    return list();
  };
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  const initial = store.start();
  await entered.promise;
  store.stop();
  const restarting = store.start();
  await flush();
  gate.resolve([]);
  await initial;
  await restarting;
  assert.equal(await store.getItem(goalKey), goal(2200));
});

test("a restarted lifecycle finishes without waiting for an abandoned download", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(2200), revision: 1 }]);
  const gate = deferred<CloudDocument[]>(),
    entered = deferred<void>(),
    list = cloud.remote.list;
  let first = true;
  cloud.remote.list = () => {
    if (first) {
      first = false;
      entered.resolve();
      return gate.promise;
    }
    return list();
  };
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  const initial = store.start();
  await entered.promise;
  store.stop();
  let restarted = false;
  const restarting = store.start().then(() => {
    restarted = true;
  });
  try {
    for (let index = 0; index < 8; index++) await flush();
    assert.equal(restarted, true);
    assert.equal(await store.getItem(goalKey), goal(2200));
  } finally {
    gate.resolve([]);
    await initial;
    await restarting;
  }
  assert.equal(await store.getItem(goalKey), goal(2200));
});

test("a retry requested by a sync subscriber cannot start a concurrent download", async () => {
  const local = memory(),
    cloud = server(),
    gate = deferred<void>(),
    entered = deferred<void>();
  let inFlight = 0,
    maximum = 0,
    calls = 0;
  cloud.remote.list = async () => {
    inFlight++;
    maximum = Math.max(maximum, inFlight);
    calls++;
    entered.resolve();
    try {
      await gate.promise;
      return [];
    } finally {
      inFlight--;
    }
  };
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  let retried = false,
    retrying: Promise<boolean> | undefined;
  store.subscribe(() => {
    if (!retried && store.getSnapshot().state === "syncing") {
      retried = true;
      retrying = store.retry();
    }
  });
  const starting = store.start();
  await entered.promise;
  try {
    await flush();
    assert.equal(calls, 1);
  } finally {
    gate.resolve();
    await starting;
    await retrying;
  }
  assert.equal(maximum, 1);
});

test("a sync subscriber can stop before any remote work begins", async () => {
  const local = memory(),
    cloud = server();
  let calls = 0;
  cloud.remote.list = async () => {
    calls++;
    return [];
  };
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  store.subscribe(() => {
    if (store.getSnapshot().state === "syncing") store.stop();
  });
  await store.start();
  assert.equal(calls, 0);
});

test("sync outcomes distinguish failure and changes that require reloading saved data", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(1800), revision: 1 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  let changes = 0;
  store.subscribeItem(goalKey, () => {
    changes++;
  });
  assert.equal(await store.retry(), true);
  assert.equal(changes, 0);
  await store.setItem(goalKey, goal(2100));
  assert.equal(await store.retry(), true);
  assert.equal(changes, 0, "acknowledging this device's save needs no reload");
  cloud.offline();
  assert.equal(await store.retry(), false);
  assert.equal(changes, 0);
  cloud.online();
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2600), revision: 3 });
  assert.equal(await store.retry(), true);
  assert.equal(changes, 1);
  assert.equal(await store.getItem(goalKey), goal(2600));
});

test("document invalidation stays keyed and subscribers can read the committed replacement", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(1800), revision: 1 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  const observed: Promise<string | null>[] = [];
  let unrelated = 0;
  const unsubscribe = store.subscribeItem(goalKey, () => {
    observed.push(store.getItem(goalKey));
  });
  store.subscribeItem(exerciseKey, () => {
    unrelated++;
  });
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2500), revision: 2 });
  await store.retry();
  assert.deepEqual(await Promise.all(observed), [goal(2500)]);
  assert.equal(unrelated, 0);
  unsubscribe();
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2700), revision: 3 });
  await store.retry();
  assert.equal(observed.length, 1);
  assert.equal(await store.getItem(goalKey), goal(2700));
});

test("choosing cloud invalidates its saved document but keeping this device does not", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(1800), revision: 1 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  let changes = 0;
  store.subscribeItem(goalKey, () => {
    changes++;
  });
  cloud.offline();
  await store.setItem(goalKey, goal(2100));
  await store.retry();
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2500), revision: 2 });
  cloud.online();
  await store.retry();
  assert.equal(await store.resolveConflict(goalKey, "local"), true);
  assert.equal(changes, 0);
  cloud.offline();
  await store.setItem(goalKey, goal(2200));
  await store.retry();
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2700), revision: 4 });
  cloud.online();
  await store.retry();
  assert.equal(await store.resolveConflict(goalKey, "cloud"), true);
  assert.equal(changes, 1);
  assert.equal(await store.getItem(goalKey), goal(2700));
});

test("cloud changes remain observable when an unrelated upload fails afterward", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(1800), revision: 1 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  let changes = 0;
  store.subscribeItem(goalKey, () => {
    changes++;
  });
  cloud.offline();
  await store.setItem(
    exerciseKey,
    JSON.stringify({ version: 1, exercises: [], workouts: [], sessions: [] }),
  );
  await store.retry();
  cloud.online();
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2500), revision: 2 });
  const save = cloud.remote.save;
  cloud.remote.save = async () => {
    throw new Error("Upload unavailable");
  };
  assert.equal(await store.retry(), false);
  assert.equal(await store.getItem(goalKey), goal(2500));
  assert.equal(changes, 1);
  assert.equal(store.getSnapshot().state, "error");
  cloud.remote.save = save;
  assert.equal(await store.retry(), true);
  assert.equal(changes, 1, "recovery must not invalidate an already downloaded value again");
});

test("keeping cloud invalidates its document even when another pending upload fails", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(1800), revision: 1 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  let changes = 0;
  store.subscribeItem(goalKey, () => {
    changes++;
  });
  cloud.offline();
  await store.setItem(goalKey, goal(2100));
  await store.retry();
  cloud.online();
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2500), revision: 2 });
  await store.retry();
  cloud.offline();
  await store.setItem(
    exerciseKey,
    JSON.stringify({ version: 1, exercises: [], workouts: [], sessions: [] }),
  );
  await store.retry();
  assert.equal(await store.resolveConflict(goalKey, "cloud"), false);
  assert.equal(await store.getItem(goalKey), goal(2500));
  assert.equal(changes, 1);
  assert.deepEqual(store.getSnapshot().conflicts, []);
  assert.equal(store.getSnapshot().state, "error");
});

test("guest recovery is imported once even after local-only imported media is deleted", async () => {
  const local = memory({ [mediaKey]: '{"version":1,"avatar":null,"photos":[]}' }),
    cloud = server();
  const first = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await first.start();
  await first.removeItem(mediaKey);
  first.stop();
  local.values.set(goalKey, goal(3100));
  const second = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await second.start();
  assert.equal(await second.getItem(mediaKey), null);
  assert.equal(await second.getItem(goalKey), null);
});

test("the first signed-in user claims legacy recovery before another account can import it", async () => {
  const local = memory(),
    firstCloud = server(),
    secondCloud = server();
  const first = createAccountStorage({
    userId: "a",
    local: local.storage,
    remote: firstCloud.remote,
  });
  await first.start();
  first.stop();
  local.values.set(goalKey, goal(1700));
  const second = createAccountStorage({
    userId: "b",
    local: local.storage,
    remote: secondCloud.remote,
  });
  await second.start();
  assert.equal(await second.getItem(goalKey), null);
});

test("a concurrent identical cloud save acknowledges the pending local value", async () => {
  const local = memory(),
    cloud = server(),
    save = cloud.remote.save;
  cloud.remote.save = async (key, payload, revision) => {
    cloud.rows.set(key, { document_key: key, payload, revision: revision + 1 });
    return save(key, payload, revision);
  };
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  await store.setItem(goalKey, goal(2400));
  for (let index = 0; index < 8; index++) await flush();
  assert.equal(store.getSnapshot().state, "idle");
  assert.equal(store.getSnapshot().error, null);
});

test("a conflict on one document does not stop unrelated automatic uploads", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(1800), revision: 1 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  cloud.offline();
  await store.setItem(goalKey, goal(2100));
  await store.retry();
  cloud.rows.set(goalKey, { document_key: goalKey, payload: goal(2500), revision: 2 });
  cloud.online();
  await store.retry();
  await store.setItem(exerciseKey, '{"version":1,"exercises":[],"workouts":[],"sessions":[]}');
  for (let index = 0; index < 4; index++) await flush();
  assert.equal(cloud.rows.get(exerciseKey)?.revision, 1);
  assert.deepEqual(store.getSnapshot().conflicts, [goalKey]);
});

test("logging out hides claimed legacy recovery from every guest-visible category", async () => {
  const local = memory({
    [profileKey]: profile("Original user"),
    [goalKey]: goal(2100),
    [mediaKey]: '{"version":1,"avatar":null,"photos":[]}',
  });
  const account = createAccountStorage({
    userId: "a",
    local: local.storage,
    remote: server().remote,
  });
  await account.start();
  account.stop();
  const guest = createAccountStorage({ userId: null, local: local.storage, remote: null });
  await guest.start();
  assert.equal(await guest.getItem(profileKey), null);
  assert.equal(await guest.getItem(goalKey), null);
  assert.equal(await guest.getItem(mediaKey), null);
  assert.equal(local.values.get(profileKey), profile("Original user"));
  await guest.setItem(profileKey, profile("Next user"));
  assert.equal(JSON.parse((await guest.getItem(profileKey))!).answers.name, "Next user");
  assert.equal(local.values.get(profileKey), profile("Original user"));
});

test("fresh onboarding after logout imports only its profile into a new account", async () => {
  const local = memory({ [profileKey]: profile("Original user") });
  const first = createAccountStorage({
    userId: "a",
    local: local.storage,
    remote: server().remote,
  });
  await first.start();
  first.stop();
  const guest = createAccountStorage({ userId: null, local: local.storage, remote: null });
  await guest.start();
  await guest.setItem(profileKey, profile("Next user"));
  await guest.setItem(goalKey, goal(3000));
  guest.stop();
  const cloud = server(),
    next = createAccountStorage({ userId: "b", local: local.storage, remote: cloud.remote });
  await next.start();
  assert.equal(JSON.parse((await next.getItem(profileKey))!).answers.name, "Next user");
  assert.equal(cloud.rows.has(goalKey), false);
  const signedOut = createAccountStorage({ userId: null, local: local.storage, remote: null });
  await signedOut.start();
  assert.equal(await signedOut.getItem(profileKey), null);
  const other = createAccountStorage({
    userId: "c",
    local: local.storage,
    remote: server().remote,
  });
  await other.start();
  assert.equal(await other.getItem(profileKey), null);
});

test("fresh setup never replaces an existing account profile and stays recoverable for that account", async () => {
  const local = memory(),
    first = createAccountStorage({ userId: "a", local: local.storage, remote: server().remote });
  await first.start();
  first.stop();
  const guest = createAccountStorage({ userId: null, local: local.storage, remote: null });
  await guest.start();
  await guest.setItem(profileKey, profile("Fresh answers"));
  guest.stop();
  const cloud = server([
    { document_key: profileKey, payload: profile("Existing account"), revision: 1 },
  ]);
  const next = createAccountStorage({ userId: "b", local: local.storage, remote: cloud.remote });
  await next.start();
  assert.equal(JSON.parse((await next.getItem(profileKey))!).answers.name, "Existing account");
  assert.equal(JSON.parse((await next.getItem(recoveryKey))!).answers.name, "Fresh answers");
  const other = createAccountStorage({
    userId: "c",
    local: local.storage,
    remote: server().remote,
  });
  await other.start();
  assert.equal(await other.getItem(recoveryKey), null);
  assert.equal(await other.getItem(profileKey), null);
});

test("a stale guest write queued before account replacement cannot recreate consumed setup", async () => {
  const local = memory(),
    first = createAccountStorage({ userId: "a", local: local.storage, remote: server().remote });
  await first.start();
  first.stop();
  const guest = createAccountStorage({ userId: null, local: local.storage, remote: null });
  await guest.start();
  await guest.setItem(profileKey, profile("New setup"));
  const gate = deferred<void>(),
    entered = deferred<void>(),
    read = local.storage.getItem;
  let delay = true;
  local.storage.getItem = async (key) => {
    if (delay) {
      delay = false;
      entered.resolve();
      await gate.promise;
    }
    return read(key);
  };
  const blockedWrite = guest.setItem(goalKey, goal(1900));
  const firstRejected = assert.rejects(blockedWrite);
  await entered.promise;
  const lateWrite = guest.setItem(profileKey, profile("Old callback"));
  const rejected = assert.rejects(lateWrite);
  guest.stop();
  const next = createAccountStorage({ userId: "b", local: local.storage, remote: server().remote });
  const ready = next.start();
  gate.resolve();
  await firstRejected;
  await rejected;
  await ready;
  assert.equal(JSON.parse((await next.getItem(profileKey))!).answers.name, "New setup");
  const after = createAccountStorage({ userId: null, local: local.storage, remote: null });
  await after.start();
  assert.equal(await after.getItem(profileKey), null);
});

test("retry reads can replace an unresolved underlying read without waiting for it", async () => {
  const local = memory(),
    cloud = server([{ document_key: goalKey, payload: goal(1800), revision: 1 }]);
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  const gate = deferred<string | null>(),
    entered = deferred<void>(),
    read = local.storage.getItem;
  let delay = true;
  local.storage.getItem = (key) => {
    if (key.endsWith(goalKey) && delay) {
      delay = false;
      entered.resolve();
      return gate.promise;
    }
    return read(key);
  };
  const first = store.getItem(goalKey);
  await entered.promise;
  let replacement: string | null | undefined;
  const second = store.getItem(goalKey).then((value) => {
    replacement = value;
  });
  try {
    await flush();
    assert.equal(replacement, goal(1800));
  } finally {
    gate.resolve(
      JSON.stringify({ version: 1, payload: goal(2100), revision: 1, dirty: false, sequence: 0 }),
    );
    await first;
    await second;
  }
  assert.equal(await store.getItem(goalKey), goal(1800));
});

test("consumer reads wait for pending local mutations without joining the mutation queue", async () => {
  const local = memory(),
    cloud = server(),
    gate = deferred<void>(),
    entered = deferred<void>();
  const store = createAccountStorage({ userId: "a", local: local.storage, remote: cloud.remote });
  await store.start();
  const write = local.storage.setItem;
  local.storage.setItem = async (key, value) => {
    if (key.endsWith(mediaKey)) {
      entered.resolve();
      await gate.promise;
    }
    return write(key, value);
  };
  const pending = store.setItem(mediaKey, "new media metadata");
  await entered.promise;
  let replacement: string | null | undefined;
  const reading = store.getItem(mediaKey).then((value) => {
    replacement = value;
  });
  await flush();
  assert.equal(replacement, undefined);
  gate.resolve();
  await pending;
  await reading;
  assert.equal(replacement, "new media metadata");
});

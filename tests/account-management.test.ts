import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountExport, deleteAccountData } from "../src/account/management.ts";
import {
  createAccountStorage,
  type AccountLocalStorage,
  type AccountRemote,
} from "../src/account/storage.ts";
import {
  createDeleteAccountHandler,
  type DeletionPort,
} from "../supabase/functions/delete-account/handler.ts";

const goalKey = "kinevault-track.water-goal.v1";
const mediaKey = "kinevault-track.profile-media.v1";
const scoped = (owner: string, key: string) =>
  `kinevault-track.account.${encodeURIComponent(owner)}.${key}`;
const goal = (dailyMl: number) => JSON.stringify({ version: 1, dailyMl });
const image = { id: "photo-a", width: 1, height: 1 };
const media = JSON.stringify({ version: 1, avatar: image, photos: [] });
const jpeg = btoa("\xff\xd8\xff\xe0\x00\xff\xd9");
function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const local: AccountLocalStorage = {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
    async getAllKeys() {
      return [...values.keys()];
    },
  };
  return { values, local };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function offlineStore(initial: Record<string, string> = {}) {
  const db = memory(initial);
  const storage = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await storage.start();
  return { ...db, storage };
}

test("export includes pending logical documents, conflict copies and actual photo bytes without credentials", async () => {
  const db = memory({
    [scoped("a", goalKey)]: JSON.stringify({
      version: 1,
      revision: 1,
      sequence: 2,
      dirty: true,
      payload: goal(1900),
    }),
    [scoped("a", mediaKey)]: media,
    [scoped("b", goalKey)]: "other-owner-secret",
    "kinevault-track.auth.v1": "credential-secret",
  });
  const remote: AccountRemote = {
    async list() {
      return [{ document_key: goalKey, revision: 2, payload: goal(2500) }];
    },
    async save() {
      throw new Error("Export must not upload");
    },
  };
  const storage = createAccountStorage({ userId: "a", local: db.local, remote });
  const result = await buildAccountExport({
    storage,
    ownerId: "a",
    isCurrent: () => true,
    includeCloud: true,
    readPhoto: async () => jpeg,
  });
  const exported = JSON.parse(result);
  const row = exported.documents.find((entry: { key: string }) => entry.key === goalKey);
  assert.equal(row.local.data.dailyMl, 1900);
  assert.equal(row.local.pending, true);
  assert.equal(row.cloud.data.dailyMl, 2500);
  assert.equal(row.conflict, true);
  assert.equal(exported.photos[0].contents, jpeg);
  assert.equal(exported.photos[0].id, image.id);
  assert.equal(result.includes("credential-secret"), false);
  assert.equal(result.includes("other-owner-secret"), false);
});

test("offline export is explicitly a device copy and reconstructs history instead of exporting partition manifests", async () => {
  const { storage } = await offlineStore();
  await storage.setItem(
    "kinevault-track.food-log.v1",
    JSON.stringify({ version: 1, days: { "2026-10-08": [] } }),
  );
  const contents = await buildAccountExport({
    storage,
    ownerId: "a",
    isCurrent: () => true,
    includeCloud: false,
    readPhoto: async () => jpeg,
  });
  const exported = JSON.parse(contents);
  assert.equal(exported.cloudStatus, "not-requested-device-copy-only");
  assert.deepEqual(
    exported.documents.find((row: { key: string }) => row.key === "kinevault-track.food-log.v1")
      .local.data.days,
    { "2026-10-08": [] },
  );
  assert.equal(contents.includes("historyFormat"), false);
  assert.equal(contents.includes("partition.v2"), false);
});

test("offline device export retains the last observed cloud conflict without claiming a fresh cloud fetch", async () => {
  const db = memory({
    [scoped("a", goalKey)]: JSON.stringify({
      version: 1,
      revision: 1,
      sequence: 2,
      dirty: true,
      payload: goal(1900),
    }),
  });
  const storage = createAccountStorage({
    userId: "a",
    local: db.local,
    remote: {
      async list() {
        return [{ document_key: goalKey, revision: 2, payload: goal(2500) }];
      },
      async save() {
        throw new Error("Conflicts must not upload");
      },
    },
  });
  await storage.start();
  assert.equal(storage.getSnapshot().state, "conflict");
  const exported = JSON.parse(
    await buildAccountExport({
      storage,
      ownerId: "a",
      isCurrent: () => true,
      includeCloud: false,
      readPhoto: async () => jpeg,
    }),
  );
  const row = exported.documents.find((entry: { key: string }) => entry.key === goalKey);
  assert.equal(exported.cloudStatus, "not-requested-device-copy-only");
  assert.equal(row.conflict, true);
  assert.equal(row.cloud.source, "last-observed-conflict");
  assert.equal(row.cloud.data.dailyMl, 2500);
});

test("local key-removal failure after server success is explicit and never erases another owner", async () => {
  const { storage, local, values } = await offlineStore({ [scoped("b", mediaKey)]: media });
  await storage.setItem(goalKey, goal(2000));
  local.removeItem = async () => {
    throw new Error("Storage locked");
  };
  const notice = await deleteAccountData({
    storage,
    ownerId: "a",
    isCurrent: () => true,
    password: "password",
    confirmation: "DELETE",
    deleteOnServer: async () => {},
    removePhoto: async () => {},
  });
  assert.match(notice!, /Some data remains/);
  assert.equal(values.get(scoped("a", "deleted.v1")), "1");
  assert.equal(values.get(scoped("b", mediaKey)), media);
  assert.equal(values.has(scoped("a", goalKey)), true);
});

test("cloud, corrupt local data and missing photo failures never create a successful empty export", async () => {
  const db = memory();
  const remote: AccountRemote = {
    async list() {
      throw new Error("Offline");
    },
    async save() {
      throw new Error("No");
    },
  };
  const storage = createAccountStorage({ userId: "a", local: db.local, remote });
  const options = {
    storage,
    ownerId: "a",
    isCurrent: () => true,
    includeCloud: true,
    readPhoto: async () => jpeg,
  };
  await assert.rejects(buildAccountExport(options), /Offline/);
  db.values.set(scoped("a", goalKey), "broken");
  await assert.rejects(buildAccountExport({ ...options, includeCloud: false }));
  db.values.delete(scoped("a", goalKey));
  db.values.set(scoped("a", mediaKey), media);
  await assert.rejects(
    buildAccountExport({
      ...options,
      includeCloud: false,
      readPhoto: async () => {
        throw new Error("Missing photo");
      },
    }),
    /Missing photo/,
  );
  await assert.rejects(
    buildAccountExport({
      ...options,
      includeCloud: false,
      readPhoto: async () => btoa("not a photo"),
    }),
    /could not be exported/,
  );
});

test("delayed photo export aborts after the active owner changes", async () => {
  const { storage } = await offlineStore({ [scoped("a", mediaKey)]: media });
  let current = true;
  const read = deferred<string>();
  const pending = buildAccountExport({
    storage,
    ownerId: "a",
    isCurrent: () => current,
    includeCloud: false,
    readPhoto: () => read.promise,
  });
  await new Promise((resolve) => setImmediate(resolve));
  current = false;
  read.resolve(jpeg);
  await assert.rejects(pending, /account changed/);
});

test("failed server deletion keeps local records and resumes writes", async () => {
  const { storage, values } = await offlineStore();
  await storage.setItem(goalKey, goal(1700));
  await assert.rejects(
    deleteAccountData({
      storage,
      ownerId: "a",
      isCurrent: () => true,
      password: "password",
      confirmation: "DELETE",
      deleteOnServer: async () => {
        throw new Error("Rejected");
      },
      removePhoto: async () => {
        throw new Error("Must not remove");
      },
    }),
    /Rejected/,
  );
  assert.equal(values.has(scoped("a", goalKey)), true);
  await storage.setItem(goalKey, goal(2200));
  assert.equal(JSON.parse((await storage.getItem(goalKey))!).dailyMl, 2200);
});

test("deletion waits for pending sync, blocks writes and cleans only the confirmed owner's data and fragments", async () => {
  const db = memory({
    [scoped("a", mediaKey)]: media,
    [scoped("b", mediaKey)]: JSON.stringify({
      version: 1,
      avatar: { ...image, id: "photo-b" },
      photos: [],
    }),
    [scoped("b", goalKey)]: "keep-b",
    theme: "keep-theme",
  });
  const saved = deferred<{ document_key: string; payload: string; revision: number }>();
  let saving = false;
  const remote: AccountRemote = {
    async list() {
      return [];
    },
    async save(key, payload) {
      saving = true;
      return saved.promise;
    },
  };
  const storage = createAccountStorage({ userId: "a", local: db.local, remote });
  await storage.start();
  await storage.setItem(goalKey, goal(1700));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saving, true);
  let serverCalled = false;
  let current = true;
  const server = deferred<void>();
  const removed: string[] = [];
  const pending = deleteAccountData({
    storage,
    ownerId: "a",
    isCurrent: () => current,
    password: "password",
    confirmation: "DELETE",
    deleteOnServer: async () => {
      serverCalled = true;
      await server.promise;
    },
    removePhoto: async (photo) => {
      removed.push(photo.id);
    },
  });
  await assert.rejects(storage.setItem(goalKey, goal(3000)), /deletion/);
  assert.equal(serverCalled, false);
  saved.resolve({ document_key: goalKey, payload: goal(1700), revision: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(serverCalled, true);
  db.values.set(
    `${scoped("a", "kinevault-track.food-log.v1")}.partition.v2.orphan`,
    "private-fragment",
  );
  current = false;
  storage.stop();
  server.resolve();
  assert.equal(await pending, null);
  assert.deepEqual(removed, ["photo-a"]);
  assert.equal(db.values.get(scoped("b", goalKey)), "keep-b");
  assert.equal(db.values.get("theme"), "keep-theme");
  assert.deepEqual(
    [...db.values.keys()].filter((key) => key.startsWith("kinevault-track.account.a.")),
    [scoped("a", "deleted.v1")],
  );
});

test("failed photo cleanup preserves metadata, reports server success honestly, and tombstone prevents restart uploads", async () => {
  const { storage, local, values } = await offlineStore({ [scoped("a", mediaKey)]: media });
  await storage.setItem(goalKey, goal(1700));
  const notice = await deleteAccountData({
    storage,
    ownerId: "a",
    isCurrent: () => true,
    password: "password",
    confirmation: "DELETE",
    deleteOnServer: async () => {},
    removePhoto: async () => {
      throw new Error("Disk locked");
    },
  });
  assert.match(notice!, /Some data remains/);
  assert.equal(values.get(scoped("a", mediaKey)), media);
  let remoteCalls = 0;
  const restarted = createAccountStorage({
    userId: "a",
    local,
    remote: {
      async list() {
        remoteCalls++;
        return [];
      },
      async save() {
        remoteCalls++;
        return null;
      },
    },
  });
  await restarted.start();
  assert.equal(remoteCalls, 0);
  await assert.rejects(restarted.setItem(goalKey, goal(2000)), /deletion/);
});

test("shared photo IDs referenced by another owner are protected during deletion", async () => {
  const { storage } = await offlineStore({
    [scoped("a", mediaKey)]: media,
    [scoped("b", mediaKey)]: media,
  });
  const removed: string[] = [];
  await deleteAccountData({
    storage,
    ownerId: "a",
    isCurrent: () => true,
    password: "password",
    confirmation: "DELETE",
    deleteOnServer: async () => {},
    removePhoto: async (photo) => {
      removed.push(photo.id);
    },
  });
  assert.deepEqual(removed, []);
});

function serverHarness(overrides: Partial<DeletionPort> = {}) {
  const actions: string[] = [];
  const port: DeletionPort = {
    async authenticate(token) {
      actions.push(`authenticate:${token}`);
      return { id: "a", email: "verified@example.com" };
    },
    async reauthenticate(email) {
      actions.push(`reauthenticate:${email}`);
      return { id: "a", accessToken: "fresh-token" };
    },
    async revokeSessions(token) {
      actions.push(`revoke:${token}`);
    },
    async deleteUser(id) {
      actions.push(`delete:${id}`);
    },
    ...overrides,
  };
  const handler = createDeleteAccountHandler(port);
  const request = (body: Record<string, unknown>, authorization = "Bearer caller-token") =>
    handler(
      new Request("https://local/delete-account", {
        method: "POST",
        headers: { Authorization: authorization },
        body: JSON.stringify(body),
      }),
    );
  return { actions, request };
}

test("server derives deletion identity from validated JWT and server password verification, revoking globally before deletion", async () => {
  const h = serverHarness();
  assert.equal((await h.request({ password: "secret", confirmation: "DELETE" })).status, 200);
  assert.deepEqual(h.actions, [
    "authenticate:caller-token",
    "reauthenticate:verified@example.com",
    "revoke:fresh-token",
    "delete:a",
  ]);
});

test("server rejects victim IDs, missing auth, wrong passwords, identity mismatch and missing destructive confirmation", async () => {
  const h = serverHarness();
  const body = { password: "secret", confirmation: "DELETE" };
  assert.equal((await h.request({ ...body, userId: "victim" })).status, 400);
  assert.equal((await h.request(body, "")).status, 401);
  assert.equal((await h.request({ password: "secret", confirmation: "yes" })).status, 400);
  assert.deepEqual(h.actions, []);
  for (const result of [null, { id: "victim", accessToken: "wrong" }]) {
    const rejected = serverHarness({
      async reauthenticate() {
        return result;
      },
    });
    assert.equal((await rejected.request(body)).status, 403);
    assert.equal(
      rejected.actions.some((action) => action.startsWith("delete:")),
      false,
    );
  }
});

test("revocation and admin deletion failures cannot return deletion success", async () => {
  const body = { password: "secret", confirmation: "DELETE" };
  const revoke = serverHarness({
    async revokeSessions() {
      throw new Error("Failure");
    },
  });
  assert.equal((await revoke.request(body)).status, 503);
  assert.equal(
    revoke.actions.some((action) => action.startsWith("delete:")),
    false,
  );
  const remove = serverHarness({
    async deleteUser() {
      throw new Error("Failure");
    },
  });
  const response = await remove.request(body);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).deleted, undefined);
});

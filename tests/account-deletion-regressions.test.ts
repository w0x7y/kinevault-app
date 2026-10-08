import assert from "node:assert/strict";
import test from "node:test";
import { createAccountStorage, type AccountLocalStorage } from "../src/account/storage.ts";
import { deleteAccountData } from "../src/account/management.ts";
import { createProfileMediaPersistence } from "../src/profile/media-persistence.ts";
import type { MediaFiles } from "../src/profile/media-model.ts";

const mediaKey = "kinevault-track.profile-media.v1";
const goalKey = "kinevault-track.water-goal.v1";
const goal = JSON.stringify({ version: 1, dailyMl: 2000 });
const scoped = (owner: string, key: string) => `kinevault-track.account.${owner}.${key}`;
const photo = { id: "a-photo", width: 100, height: 100 };
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
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deletion(
  storage: ReturnType<typeof createAccountStorage>,
  removePhoto: MediaFiles["removePhoto"] = async () => {},
) {
  return deleteAccountData({
    storage,
    ownerId: "a",
    isCurrent: () => true,
    password: "password",
    confirmation: "DELETE",
    deleteOnServer: async () => {},
    removePhoto,
  });
}

test("deletion freezes every live A instance through A→B→A and remounts, while B stays writable", async () => {
  const db = memory();
  const oldA = createAccountStorage({ userId: "a", local: db.local, remote: null });
  const newA = createAccountStorage({ userId: "a", local: db.local, remote: null });
  const b = createAccountStorage({ userId: "b", local: db.local, remote: null });
  await oldA.start();
  oldA.stop();
  await b.start();
  await newA.start();
  const frozen = await oldA.freezeForDeletion();
  await assert.rejects(newA.setItem(goalKey, goal), /delet/);
  await b.setItem(goalKey, goal);
  await frozen.confirm();
  await frozen.cleanup(async () => {});
  for (const store of [oldA, newA]) {
    store.stop();
    await store.start();
    await assert.rejects(store.setItem(goalKey, goal), /delet/);
  }
  assert.equal(db.values.has(scoped("a", goalKey)), false);
  assert.equal(await b.getItem(goalKey), goal);
});

test("already active A cannot recreate records after another A confirms deletion", async () => {
  const db = memory();
  const a1 = createAccountStorage({ userId: "a", local: db.local, remote: null });
  const a2 = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await a1.start();
  await a2.start();
  await deletion(a1);
  await assert.rejects(a2.setItem(mediaKey, "private"), /delet/);
  assert.equal(db.values.has(scoped("a", mediaKey)), false);
});

test("failed physical avatar removal remains owner discoverable after metadata removal and restart", async () => {
  const db = memory({
    [scoped("a", mediaKey)]: JSON.stringify({ version: 1, avatar: photo, photos: [] }),
  });
  const physical = new Set([photo.id, "b-photo"]);
  const bPhoto = { ...photo, id: "b-photo" };
  db.values.set(scoped("b", mediaKey), JSON.stringify({ version: 1, avatar: bPhoto, photos: [] }));
  const a = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await a.start();
  const media = createProfileMediaPersistence({
    storage: a,
    createId: () => "new-photo",
    files: {
      async importPhoto(source, id) {
        physical.add(id);
        return { ...source, id };
      },
      async resolvePhoto(image) {
        return image.id;
      },
      async removePhoto() {
        throw new Error("Disk locked");
      },
      releaseUri() {},
    },
  });
  media.start();
  await tick();
  assert.equal(await media.saveAvatar(null), true);
  assert.equal(JSON.parse((await a.getItem(mediaKey))!).avatar, null);
  assert.equal(physical.has(photo.id), true);
  media.stop();
  a.stop();
  const restarted = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await restarted.start();
  assert.equal(
    await deletion(restarted, async (image) => {
      physical.delete(image.id);
    }),
    null,
  );
  assert.equal(physical.has(photo.id), false);
  assert.equal(physical.has("b-photo"), true);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const ownershipKey = `${mediaKey}.ownership.v1`;
function remountedBackend(db: ReturnType<typeof memory>): AccountLocalStorage {
  // A fresh adapter identity models loss of all in-memory coordination on restart.
  return { ...db.local };
}

test("persistent deletion marker is checked at the actual write boundary on an already active store", async () => {
  const db = memory();
  const a = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await a.start();
  const entered = deferred<void>(),
    read = deferred<void>();
  const get = db.local.getItem;
  db.local.getItem = async (key) => {
    const value = await get(key);
    if (key === scoped("a", goalKey)) {
      entered.resolve();
      await read.promise;
    }
    return value;
  };
  const writing = a.setItem(goalKey, goal);
  await entered.promise;
  db.values.set(scoped("a", "deleted.v1"), "1");
  read.resolve();
  await assert.rejects(writing, /delet/);
  assert.equal(db.values.has(scoped("a", goalKey)), false);
});

test("confirmation write failure leaves a durable pending barrier across restart and permits confirmed cleanup retry", async () => {
  const db = memory();
  const a = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await a.start();
  await a.setItem(goalKey, goal);
  const set = db.local.setItem;
  db.local.setItem = async (key, value) => {
    if (key === scoped("a", "deleted.v1") && value === "1") throw new Error("Disk locked");
    await set(key, value);
  };
  assert.match((await deletion(a))!, /Some data remains/);
  assert.equal(db.values.get(scoped("a", "deleted.v1")), "pending");
  let uploads = 0;
  const restart = createAccountStorage({
    userId: "a",
    local: remountedBackend(db),
    remote: {
      async list() {
        uploads++;
        return [];
      },
      async save() {
        uploads++;
        return null;
      },
    },
  });
  await restart.start();
  await assert.rejects(restart.setItem(goalKey, goal), /delet/);
  assert.equal(uploads, 0);
  await assert.rejects(
    restart.cleanupDeletedData(async () => {}),
    /not been confirmed/,
  );
  db.local.setItem = set;
  await a.cleanupDeletedData(async () => {});
  assert.equal(db.values.has(scoped("a", goalKey)), false);
  assert.equal(db.values.get(scoped("a", "deleted.v1")), "1");
});

test("failed server request unfreezes both A mounts and never restarts a stopped A lifecycle", async () => {
  const db = memory();
  let oldCalls = 0;
  const old = createAccountStorage({
    userId: "a",
    local: db.local,
    remote: {
      async list() {
        oldCalls++;
        return [];
      },
      async save() {
        oldCalls++;
        return null;
      },
    },
  });
  const current = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await old.start();
  await current.start();
  const frozen = await old.freezeForDeletion();
  old.stop();
  await assert.rejects(current.setItem(goalKey, goal), /delet/);
  await frozen.resume();
  await current.setItem(goalKey, goal);
  await tick();
  assert.equal(oldCalls, 1);
  assert.equal(db.values.has(scoped("a", "deleted.v1")), false);
  await old.setItem(goalKey, goal);
});

test("freeze drains a different A instance's upload even after that instance stops", async () => {
  const db = memory();
  const entered = deferred<void>(),
    saved = deferred<{ document_key: string; revision: number; payload: string }>();
  const uploading = createAccountStorage({
    userId: "a",
    local: db.local,
    remote: {
      async list() {
        return [];
      },
      async save(key, payload) {
        entered.resolve();
        return saved.promise;
      },
    },
  });
  const deleting = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await uploading.start();
  await deleting.start();
  await uploading.setItem(goalKey, goal);
  await entered.promise;
  uploading.stop();
  let frozen = false;
  const freeze = deleting.freezeForDeletion().then((result) => {
    frozen = true;
    return result;
  });
  await tick();
  assert.equal(frozen, false);
  saved.resolve({ document_key: goalKey, revision: 1, payload: goal });
  const lease = await freeze;
  await lease.confirm();
  await lease.cleanup(async () => {});
  await assert.rejects(uploading.setItem(goalKey, goal), /delet/);
  assert.equal(await uploading.retry(), false);
});

function mediaFixture(db = memory()) {
  const physical = new Set<string>();
  const storage = createAccountStorage({ userId: "a", local: db.local, remote: null });
  let sequence = 0;
  const files: MediaFiles = {
    async importPhoto(source, id) {
      physical.add(id);
      return { id, width: source.width, height: source.height };
    },
    async resolvePhoto(image) {
      return image.id;
    },
    async removePhoto(image) {
      physical.delete(image.id);
    },
    releaseUri() {},
  };
  const media = createProfileMediaPersistence({
    storage,
    files,
    createId: () => `import-${++sequence}`,
  });
  return { db, physical, storage, files, media };
}
const source = { uri: "file:///selected.jpg", width: 100, height: 100 };
async function readyMedia(f: ReturnType<typeof mediaFixture>) {
  await f.storage.start();
  f.media.start();
  await tick();
}

test("failed metadata commit plus failed import cleanup retains an orphan through deletion failure and restart retry", async () => {
  const f = mediaFixture();
  await readyMedia(f);
  const set = f.db.local.setItem;
  f.db.local.setItem = async (key, value) => {
    if (key === scoped("a", mediaKey)) throw new Error("Metadata write failed");
    await set(key, value);
  };
  f.files.removePhoto = async () => {
    throw new Error("Physical delete failed");
  };
  assert.equal(await f.media.saveAvatar(source), false);
  assert.equal(f.physical.has("import-1"), true);
  assert.equal(f.db.values.has(scoped("a", mediaKey)), false);
  assert.match(f.db.values.get(scoped("a", ownershipKey))!, /import-1/);
  f.db.local.setItem = set;
  assert.match((await deletion(f.storage, f.files.removePhoto))!, /Some data remains/);
  f.media.stop();
  f.storage.stop();
  const restart = createAccountStorage({
    userId: "a",
    local: remountedBackend(f.db),
    remote: null,
  });
  await restart.start();
  await restart.cleanupDeletedData(async (image) => {
    f.physical.delete(image.id);
  });
  assert.equal(f.physical.has("import-1"), false);
  assert.equal(f.db.values.has(scoped("a", ownershipKey)), false);
});

test("partial import failure retains ownership evidence when physical rollback also fails", async () => {
  const f = mediaFixture();
  await readyMedia(f);
  f.files.importPhoto = async (_source, id) => {
    f.physical.add(id);
    throw new Error("Thumbnail copy failed");
  };
  f.files.removePhoto = async () => {
    throw new Error("Disk locked");
  };
  assert.equal(await f.media.saveAvatar(source), false);
  assert.equal(f.physical.has("import-1"), true);
  assert.match(f.db.values.get(scoped("a", ownershipKey))!, /import-1/);
  assert.equal(
    await deletion(f.storage, async (image) => {
      f.physical.delete(image.id);
    }),
    null,
  );
  assert.equal(f.physical.has("import-1"), false);
});

test("inventory write failure prevents import and preserves unrelated physical photos", async () => {
  const f = mediaFixture();
  await readyMedia(f);
  f.physical.add("import-1");
  const set = f.db.local.setItem;
  f.db.local.setItem = async (key, value) => {
    if (key === scoped("a", ownershipKey)) throw new Error("Inventory unavailable");
    await set(key, value);
  };
  let imports = 0;
  f.files.importPhoto = async () => {
    imports++;
    throw new Error("Must not import");
  };
  assert.equal(await f.media.saveAvatar(source), false);
  assert.equal(imports, 0);
  assert.equal(f.physical.has("import-1"), true);
});

test("deletion drains a pending media import and its rollback before physical cleanup, and blocks fresh imports", async () => {
  const f = mediaFixture();
  await readyMedia(f);
  const entered = deferred<void>(),
    imported = deferred<void>();
  f.files.importPhoto = async (selected, id) => {
    entered.resolve();
    await imported.promise;
    f.physical.add(id);
    return { id, width: selected.width, height: selected.height };
  };
  f.files.removePhoto = async () => {
    throw new Error("Rollback locked");
  };
  const saving = f.media.saveAvatar(source);
  await entered.promise;
  let finished = false;
  const deleting = deletion(f.storage, async (image) => {
    f.physical.delete(image.id);
  }).then((value) => {
    finished = true;
    return value;
  });
  await tick();
  assert.equal(finished, false);
  imported.resolve();
  assert.equal(await saving, false);
  assert.equal(await deleting, null);
  assert.equal(f.physical.size, 0);
  assert.equal(await f.media.saveAvatar(source), false);
});

test("another owner's orphan ledger protects a shared ID even without active photo metadata", async () => {
  const db = memory({
    [scoped("a", mediaKey)]: JSON.stringify({ version: 1, avatar: photo, photos: [] }),
    [scoped("b", ownershipKey)]: JSON.stringify({ version: 1, images: [photo] }),
  });
  const a = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await a.start();
  const removed: string[] = [];
  assert.equal(
    await deletion(a, async (image) => {
      removed.push(image.id);
    }),
    null,
  );
  assert.deepEqual(removed, []);
  assert.equal(db.values.has(scoped("b", ownershipKey)), true);
});

test("new import IDs cannot claim or remove another owner's current or orphaned photo", async () => {
  for (const evidence of [mediaKey, ownershipKey]) {
    const db = memory({
      [scoped("b", evidence)]:
        evidence === mediaKey
          ? JSON.stringify({ version: 1, avatar: { ...photo, id: "import-1" }, photos: [] })
          : JSON.stringify({ version: 1, images: [{ ...photo, id: "import-1" }] }),
    });
    const f = mediaFixture(db);
    f.physical.add("import-1");
    await readyMedia(f);
    assert.equal(await f.media.saveAvatar(source), false);
    assert.equal(f.physical.has("import-1"), true);
    assert.equal(f.db.values.has(scoped("a", ownershipKey)), false);
    await deletion(f.storage, async (image) => {
      f.physical.delete(image.id);
    });
    assert.equal(f.physical.has("import-1"), true);
  }
});

test("unclaimed physical legacy files have no ownership evidence and are left alone", async () => {
  const f = mediaFixture();
  f.physical.add("legacy-unowned");
  await readyMedia(f);
  await deletion(f.storage, async (image) => {
    f.physical.delete(image.id);
  });
  assert.equal(f.physical.has("legacy-unowned"), true);
});

test("a new deletion cannot downgrade an already confirmed persistent tombstone before start", async () => {
  const db = memory({ [scoped("a", "deleted.v1")]: "1" });
  const a = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await assert.rejects(a.freezeForDeletion(), /deleted/);
  assert.equal(db.values.get(scoped("a", "deleted.v1")), "1");
  await assert.rejects(a.setItem(goalKey, goal), /delet/);
});

test("a rejected retry cannot reopen data from an earlier interrupted deletion", async () => {
  const db = memory({ [scoped("a", "deleted.v1")]: "pending" });
  const a = createAccountStorage({ userId: "a", local: db.local, remote: null });
  await a.start();
  await assert.rejects(
    deleteAccountData({
      storage: a,
      ownerId: "a",
      isCurrent: () => true,
      password: "password",
      confirmation: "DELETE",
      deleteOnServer: async () => {
        throw new Error("Account already absent");
      },
      removePhoto: async () => {},
    }),
    /earlier account deletion/,
  );
  assert.equal(db.values.get(scoped("a", "deleted.v1")), "pending");
  await assert.rejects(a.setItem(goalKey, goal), /delet/);
});

test("deletion drains an unfinished guest media import claimed by A before removing its ownership inventory", async () => {
  const db = memory();
  const guest = createAccountStorage({ userId: null, local: db.local, remote: null });
  await guest.start();
  const entered = deferred<void>(),
    imported = deferred<void>();
  const physical = new Set<string>();
  const media = createProfileMediaPersistence({
    storage: guest,
    createId: () => "guest-photo",
    files: {
      async importPhoto(selected, id) {
        entered.resolve();
        await imported.promise;
        physical.add(id);
        return { id, width: selected.width, height: selected.height };
      },
      async resolvePhoto(image) {
        return image.id;
      },
      async removePhoto() {
        throw new Error("Rollback failed");
      },
      releaseUri() {},
    },
  });
  media.start();
  await tick();
  const saving = media.saveAvatar(source);
  await entered.promise;
  media.stop();
  guest.stop();
  const a = createAccountStorage({
    userId: "a",
    local: db.local,
    remote: {
      async list() {
        return [];
      },
      async save() {
        return null;
      },
    },
  });
  await a.start();
  assert.match(db.values.get(scoped("a", ownershipKey))!, /guest-photo/);
  let finished = false;
  const deleting = deletion(a, async (image) => {
    physical.delete(image.id);
  }).then((value) => {
    finished = true;
    return value;
  });
  await tick();
  assert.equal(finished, false);
  imported.resolve();
  assert.equal(await saving, false);
  assert.equal(await deleting, null);
  assert.equal(physical.size, 0);
  assert.equal(db.values.has(ownershipKey), false);
});

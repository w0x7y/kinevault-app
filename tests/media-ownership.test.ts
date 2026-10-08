import assert from "node:assert/strict";
import test from "node:test";
import { createAccountStorage, type AccountLocalStorage } from "../src/account/storage.ts";
import {
  MediaIdentityCollisionError,
  parseProfileMedia,
  type MediaFiles,
  type ProfileMediaDocument,
  type StoredPhoto,
} from "../src/profile/media-model.ts";
import {
  createProfileMediaOwnership,
  encodeMediaOwnership,
  parseMediaOwnership,
  profileMediaOwnershipKey,
  profileMediaStorageKey,
} from "../src/profile/media-ownership.ts";

const scoped = (owner: string, key: string) => `kinevault-track.account.${owner}.${key}`;
const source = { uri: "file:///selected.jpg", width: 800, height: 600 };
const photo = (id: string): StoredPhoto => ({ id, width: 800, height: 600 });
const empty: ProfileMediaDocument = { version: 1, avatar: null, photos: [] };
function fixture(initial: Record<string, string> = {}) {
  const rows = new Map(Object.entries(initial));
  const local: AccountLocalStorage = {
    async getItem(key) {
      return rows.get(key) ?? null;
    },
    async setItem(key, value) {
      rows.set(key, value);
    },
    async removeItem(key) {
      rows.delete(key);
    },
    async getAllKeys() {
      return [...rows.keys()];
    },
  };
  const assets = new Set<string>();
  const removed: string[] = [];
  const files: MediaFiles = {
    async importPhoto(selected, id) {
      // The real adapters create exclusively and can fail after allocation.
      if (assets.has(id)) throw new MediaIdentityCollisionError();
      assets.add(id);
      return { id, width: selected.width, height: selected.height };
    },
    async resolvePhoto(image) {
      return `owned://${image.id}`;
    },
    async removePhoto(image) {
      removed.push(image.id);
      assets.delete(image.id);
    },
    releaseUri() {},
  };
  const storage = createAccountStorage({ userId: "A", local, remote: null });
  let id = 0;
  const ownership = createProfileMediaOwnership({
    inventory: storage.mediaOwnership,
    files,
    createId: () => `new-${++id}`,
  });
  const document = () => parseProfileMedia(rows.get(scoped("A", profileMediaStorageKey)) ?? null);
  const owned = () => parseMediaOwnership(rows.get(scoped("A", profileMediaOwnershipKey)) ?? null);
  function avatar(nextId: string, before = document()) {
    return storage.withMediaOperation(() =>
      ownership.change({
        before,
        source,
        imageId: nextId,
        obsolete: before.avatar,
        document: (image) => ({ ...before, avatar: image ?? null }),
        isCurrent: () => true,
        commit: (next) => storage.setItem(profileMediaStorageKey, JSON.stringify(next)),
      }),
    );
  }
  return { rows, local, assets, removed, files, storage, ownership, document, owned, avatar };
}

test("ownership imports only after reservation and publishes replacement before retiring the old file", async () => {
  const f = fixture({
    [scoped("A", profileMediaStorageKey)]: JSON.stringify({ ...empty, avatar: photo("old") }),
  });
  f.assets.add("old");
  const importPhoto = f.files.importPhoto;
  f.files.importPhoto = async (selected, id) => {
    assert.deepEqual(
      f.owned().map((image) => image.id),
      ["old", "new"],
    );
    assert.equal(f.document().avatar?.id, "old");
    return importPhoto(selected, id);
  };
  const removePhoto = f.files.removePhoto;
  f.files.removePhoto = async (image) => {
    assert.equal(f.document().avatar?.id, "new");
    await removePhoto(image);
  };
  assert.equal(await f.avatar("new"), true);
  assert.deepEqual(
    f.owned().map((image) => image.id),
    ["new"],
  );
  assert.deepEqual([...f.assets], ["new"]);
});

test("ownership cannot reserve another owner's published or orphaned file", async () => {
  for (const key of [profileMediaStorageKey, profileMediaOwnershipKey]) {
    const f = fixture({
      [scoped("B", key)]:
        key === profileMediaStorageKey
          ? JSON.stringify({ ...empty, avatar: photo("foreign") })
          : encodeMediaOwnership([photo("foreign")]),
    });
    f.assets.add("foreign");
    await assert.rejects(f.avatar("foreign"), /already belongs to an owner/);
    assert.deepEqual(f.owned(), []);
    assert.deepEqual([...f.assets], ["foreign"]);
    assert.deepEqual(f.removed, []);
  }
});

test("exclusive import collision releases only its reservation and retains an unclaimed physical file", async () => {
  const f = fixture();
  f.assets.add("collision");
  await assert.rejects(f.avatar("collision"), MediaIdentityCollisionError);
  assert.deepEqual(f.owned(), []);
  assert.deepEqual(f.document(), empty);
  assert.equal(f.assets.has("collision"), true);
  assert.deepEqual(f.removed, []);
});

test("partial import and failed rollback retain ownership for confirmed deletion and restart recovery", async () => {
  const f = fixture();
  f.files.importPhoto = async (_selected, id) => {
    f.assets.add(id);
    throw new Error("partial import");
  };
  f.files.removePhoto = async () => {
    throw new Error("disk busy");
  };
  await assert.rejects(f.avatar("orphan"), /partial import/);
  assert.deepEqual(f.owned(), [photo("orphan")]);
  assert.deepEqual(f.document(), empty);
  const frozen = await f.storage.freezeForDeletion();
  await frozen.confirm();
  await assert.rejects(frozen.cleanup(f.files.removePhoto), /disk busy/);
  assert.deepEqual(f.owned(), [photo("orphan")]);
  const restarted = createAccountStorage({ userId: "A", local: f.local, remote: null });
  await restarted.cleanupDeletedData(async (image) => {
    f.assets.delete(image.id);
  });
  assert.deepEqual(f.owned(), []);
  assert.deepEqual([...f.assets], []);
});

test("replacement retirement preserves a shared file referenced only by another owner's ledger", async () => {
  const foreign = encodeMediaOwnership([photo("shared")]);
  const f = fixture({
    [scoped("A", profileMediaStorageKey)]: JSON.stringify({ ...empty, avatar: photo("shared") }),
    [scoped("B", profileMediaOwnershipKey)]: foreign,
  });
  f.assets.add("shared");
  assert.equal(await f.avatar("replacement"), true);
  assert.equal(f.document().avatar?.id, "replacement");
  assert.deepEqual(f.owned(), [photo("replacement")]);
  assert.deepEqual(f.removed, []);
  assert.equal(f.assets.has("shared"), true);
  assert.equal(f.rows.get(scoped("B", profileMediaOwnershipKey)), foreign);
  const frozen = await f.storage.freezeForDeletion();
  await frozen.confirm();
  await frozen.cleanup(f.files.removePhoto);
  assert.deepEqual(f.removed, ["replacement"]);
  assert.equal(f.assets.has("shared"), true);
  assert.equal(f.rows.get(scoped("B", profileMediaOwnershipKey)), foreign);
});

test("failed metadata publication rolls back the new file and keeps the saved file", async () => {
  const saved = { ...empty, avatar: photo("saved") };
  const f = fixture({ [scoped("A", profileMediaStorageKey)]: JSON.stringify(saved) });
  f.assets.add("saved");
  const write = f.local.setItem;
  f.local.setItem = async (key, value) => {
    if (key === scoped("A", profileMediaStorageKey)) throw new Error("metadata full");
    await write(key, value);
  };
  await assert.rejects(f.avatar("unpublished"), /metadata full/);
  assert.deepEqual(f.document(), saved);
  assert.deepEqual(f.owned(), [photo("saved")]);
  assert.deepEqual([...f.assets], ["saved"]);
  assert.deepEqual(f.removed, ["unpublished"]);
});

test("unreadable foreign ownership evidence prevents import and removal", async () => {
  const f = fixture({ [scoped("B", profileMediaOwnershipKey)]: "corrupt" });
  f.assets.add("foreign");
  await assert.rejects(f.avatar("new"));
  assert.deepEqual(f.owned(), []);
  assert.deepEqual([...f.assets], ["foreign"]);
  assert.deepEqual(f.removed, []);
});

test("failed retirement ledger write retains evidence even after the physical file is gone", async () => {
  const f = fixture({
    [scoped("A", profileMediaStorageKey)]: JSON.stringify({ ...empty, avatar: photo("old") }),
  });
  f.assets.add("old");
  const write = f.local.setItem;
  let failRetirement = true;
  f.local.setItem = async (key, value) => {
    if (
      failRetirement &&
      key === scoped("A", profileMediaOwnershipKey) &&
      parseMediaOwnership(value).every((image) => image.id !== "old")
    )
      throw new Error("ledger full");
    await write(key, value);
  };
  assert.equal(await f.avatar("new"), true);
  assert.equal(f.document().avatar?.id, "new");
  assert.equal(f.assets.has("old"), false);
  assert.deepEqual(
    f.owned().map((image) => image.id),
    ["old", "new"],
  );
  failRetirement = false;
  const frozen = await f.storage.freezeForDeletion();
  await frozen.confirm();
  await frozen.cleanup(f.files.removePhoto);
  assert.deepEqual(f.removed, ["old", "new", "old"]);
  assert.deepEqual(f.owned(), []);
  assert.deepEqual([...f.assets], []);
});

test("an interrupted import retires its allocation without publishing replacement metadata", async () => {
  const f = fixture();
  let complete!: () => void;
  const gate = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let began!: () => void;
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  const importPhoto = f.files.importPhoto;
  f.files.importPhoto = async (selected, id) => {
    began();
    await gate;
    return importPhoto(selected, id);
  };
  let current = true;
  const result = f.storage.withMediaOperation(() =>
    f.ownership.change({
      before: empty,
      source,
      imageId: "cancelled",
      document: (image) => ({ ...empty, avatar: image ?? null }),
      isCurrent: () => current,
      commit: async () => {
        assert.fail("Interrupted metadata must not publish");
      },
    }),
  );
  await started;
  assert.deepEqual(f.owned(), [photo("cancelled")]);
  current = false;
  complete();
  assert.equal(await result, false);
  assert.deepEqual(f.document(), empty);
  assert.deepEqual(f.owned(), []);
  assert.deepEqual([...f.assets], []);
  assert.deepEqual(f.removed, ["cancelled"]);
});

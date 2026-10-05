import assert from "node:assert/strict";
import test from "node:test";
import { createMediaFiles } from "../src/profile/media-files.web.ts";
import { parseProfileMedia, fitPhotoDimensions, type ProfileMediaDocument, type MediaFiles, type PhotoSource } from "../src/profile/media-model.ts";
import { createProfileMediaPersistence, profileMediaStorageKey } from "../src/profile/media-persistence.ts";

const empty: ProfileMediaDocument = { version: 1, avatar: null, photos: [] };
const image = { id: "image-1", width: 1200, height: 1600 };
const saved: ProfileMediaDocument = {
  version: 1, avatar: image,
  photos: [{ id: "photo-1", date: "2026-10-04", note: "First entry", image: { ...image, id: "image-2" } }],
};

test("photo resizing bounds the long edge, preserves aspect ratio, and never upscales", () => {
  assert.deepEqual(fitPhotoDimensions(3000, 4000, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(fitPhotoDimensions(4000, 3000, 320), { width: 320, height: 240 });
  assert.deepEqual(fitPhotoDimensions(200, 100, 1600), { width: 200, height: 100 });
  assert.deepEqual(fitPhotoDimensions(1, 10000, 320), { width: 1, height: 320 });
  assert.throws(() => fitPhotoDimensions(0, 100, 320));
});

test("web media construction is inert during static export and unavailable storage fails explicitly", async () => {
  const files = createMediaFiles();
  await assert.rejects(files.resolvePhoto(image), /storage.*unavailable/i);
  await assert.rejects(files.importPhoto(source, "safe-id"), /storage.*unavailable/i);
  await assert.rejects(files.removePhoto(image), /storage.*unavailable/i);
  files.releaseUri("blob:not-owned");
});

test("absent metadata creates an empty journal and valid metadata round trips", () => {
  assert.deepEqual(parseProfileMedia(null), empty);
  assert.deepEqual(parseProfileMedia(JSON.stringify(saved)), saved);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const source: PhotoSource = { uri: "file:///picker/photo.jpg", width: 1200, height: 1600 };
function fixture(initial: string | null = null) {
  let raw = initial;
  let nextId = 0;
  const assets = new Set(["image-1", "image-2"]);
  const events: string[] = [];
  const storage = {
    async getItem(key: string) { assert.equal(key, profileMediaStorageKey); events.push("read"); return raw; },
    async setItem(key: string, value: string) { assert.equal(key, profileMediaStorageKey); events.push("write"); raw = value; },
  };
  const files: MediaFiles = {
    async importPhoto(selected, id) { events.push(`import:${id}`); assets.add(id); return { id, width: selected.width, height: selected.height }; },
    async resolvePhoto(photo) { if (!assets.has(photo.id)) throw new Error("missing"); return `owned://${photo.id}`; },
    async removePhoto(photo) { events.push(`remove:${photo.id}`); assets.delete(photo.id); },
    releaseUri() {},
  };
  const store = createProfileMediaPersistence({ storage, files, createId: () => `new-${++nextId}` });
  return { store, storage, files, assets, events, raw: () => raw };
}
async function ready(initial: ProfileMediaDocument = saved) {
  const f = fixture(JSON.stringify(initial));
  f.store.start(); await flush();
  assert.equal(f.store.getSnapshot().state.kind, "ready");
  return f;
}
function documentOf(store: ReturnType<typeof createProfileMediaPersistence>) {
  const state = store.getSnapshot().state;
  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") throw new Error("Expected ready media");
  return state.document;
}

test("stopping during loading feedback prevents the abandoned media read", async () => {
  const f = fixture(JSON.stringify(saved));
  const unsubscribe = f.store.subscribe(() => {
    if (f.store.getSnapshot().state.kind === "loading") f.store.stop();
  });
  f.store.start(); await flush();
  assert.deepEqual(f.events, []);
  unsubscribe(); f.store.start(); await flush();
  assert.deepEqual(documentOf(f.store), saved);
});

test("stopping during saving feedback prevents abandoned image import and metadata writes", async () => {
  const f = await ready();
  const unsubscribe = f.store.subscribe(() => {
    if (f.store.getSnapshot().saving) f.store.stop();
  });
  assert.equal(await f.store.saveAvatar(source), false);
  assert.deepEqual(f.events, ["read"]);
  assert.deepEqual(parseProfileMedia(f.raw()), saved);
  unsubscribe(); f.store.start(); await flush();
  assert.equal(await f.store.saveAvatar(source), true);
});

test("construction is inert, start loads once, and subscribers see durable publication order", async () => {
  const f = fixture(JSON.stringify(saved));
  assert.deepEqual(f.events, []);
  assert.equal(f.store.getSnapshot(), f.store.getSnapshot());
  const seen: string[] = [];
  f.store.subscribe(() => {
    const snapshot = f.store.getSnapshot();
    if (snapshot.state.kind === "ready") {
      seen.push(`${snapshot.state.document.avatar?.id}:${snapshot.saving}`);
      assert.deepEqual(snapshot.state.document, parseProfileMedia(f.raw()));
    }
  });
  f.store.start(); f.store.start(); await flush();
  const gate = deferred<void>();
  const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const result = f.store.saveAvatar(source);
  await flush();
  assert.equal(f.store.getSnapshot().saving, true);
  assert.equal(documentOf(f.store).avatar?.id, "image-1");
  assert.deepEqual(f.events, ["read", "import:new-1"]);
  gate.resolve(); assert.equal(await result, true);
  assert.deepEqual(f.events, ["read", "import:new-1", "write", "remove:image-1"]);
  assert.deepEqual(seen, ["image-1:false", "image-1:true", "new-1:true", "new-1:false"]);
});

test("failed avatar write preserves the saved avatar, cleans only the import, and permits retry", async () => {
  const f = await ready();
  const before = f.store.getSnapshot();
  const write = f.storage.setItem;
  f.storage.setItem = async () => { throw new Error("Disk full"); };
  assert.equal(await f.store.saveAvatar(source), false);
  assert.deepEqual(f.store.getSnapshot().state, before.state);
  assert.deepEqual(parseProfileMedia(f.raw()), saved);
  assert.equal(f.assets.has("image-1"), true);
  assert.equal(f.assets.has("image-2"), true);
  assert.equal(f.assets.has("new-1"), false);
  assert.equal(f.store.getSnapshot().saving, false);
  assert.ok(f.store.getSnapshot().error);
  f.storage.setItem = write;
  assert.equal(await f.store.saveAvatar(source), true);
  assert.equal(documentOf(f.store).avatar?.id, "new-2");
  assert.equal(f.store.getSnapshot().error, null);
});

test("duplicate commands and reloads cannot overlap a pending import or write", async () => {
  const f = await ready();
  const gate = deferred<void>();
  const importPhoto = f.files.importPhoto;
  f.files.importPhoto = async (selected, id) => { await gate.promise; return importPhoto(selected, id); };
  const result = f.store.addPhoto({ source, date: "2026-10-04", note: "Draft" });
  assert.equal(await f.store.addPhoto({ source, date: "2026-10-04", note: "Duplicate" }), false);
  assert.equal(await f.store.saveAvatar(source), false);
  assert.equal(await f.store.removePhoto("photo-1"), false);
  assert.equal(await f.store.updatePhoto({ id: "photo-1", date: "2026-10-04", note: "Duplicate" }), false);
  f.store.retryLoad();
  assert.deepEqual(f.events, ["read"]);
  gate.resolve(); assert.equal(await result, true);
  assert.equal(documentOf(f.store).photos.length, 2);
});

test("validation and missing IDs reject before file imports or metadata writes", async () => {
  const f = await ready();
  for (const input of [
    { source, date: "2026-02-30", note: "" },
    { source, date: "2026-10-04", note: "x".repeat(2001) },
    { source: { ...source, width: 0 }, date: "2026-10-04", note: "" },
  ]) assert.equal(await f.store.addPhoto(input), false);
  assert.equal(await f.store.updatePhoto({ id: "missing", date: "2026-10-04", note: "", source }), false);
  assert.equal(await f.store.removePhoto("missing"), false);
  assert.equal(await f.store.saveAvatar({ ...source, uri: "" }), false);
  assert.deepEqual(f.events, ["read"]);
  assert.deepEqual(documentOf(f.store), saved);
});

test("replacing, editing and deleting a progress photo preserve unrelated photos and avatar", async () => {
  const initial: ProfileMediaDocument = { ...saved, photos: [...saved.photos, { id: "other", date: "2026-10-03", note: "Keep", image: { ...image, id: "other-image" } }] };
  const f = await ready(initial);
  f.assets.add("other-image");
  assert.equal(await f.store.updatePhoto({ id: "photo-1", date: "2026-10-02", note: "Edited" }), true);
  assert.deepEqual(documentOf(f.store).photos[0], { ...saved.photos[0], date: "2026-10-02", note: "Edited" });
  assert.equal(await f.store.updatePhoto({ id: "photo-1", date: "2026-10-01", note: "Replaced", source }), true);
  assert.equal(documentOf(f.store).photos[0].image.id, "new-1");
  assert.equal(f.assets.has("image-2"), false);
  const gate = deferred<void>();
  const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const result = f.store.removePhoto("photo-1"); await flush();
  assert.equal(documentOf(f.store).photos.length, 2);
  assert.equal(f.assets.has("new-1"), true);
  gate.resolve(); assert.equal(await result, true);
  assert.deepEqual(documentOf(f.store), { ...initial, photos: [initial.photos[1]] });
  assert.equal(f.assets.has("new-1"), false);
  assert.equal(f.assets.has("image-1"), true);
  assert.equal(f.assets.has("other-image"), true);
  assert.equal(await f.store.saveAvatar(null), true);
  assert.equal(documentOf(f.store).avatar, null);
  assert.deepEqual(documentOf(f.store).photos, [initial.photos[1]]);
});

test("cleanup failures keep successful metadata mutations successful", async () => {
  const f = await ready();
  f.files.removePhoto = async () => { throw new Error("Cannot clean file"); };
  assert.equal(await f.store.saveAvatar(source), true);
  assert.equal(documentOf(f.store).avatar?.id, "new-1");
  assert.equal(await f.store.removePhoto("photo-1"), true);
  assert.equal(documentOf(f.store).photos.length, 0);
  assert.equal(f.store.getSnapshot().error, null);
  assert.deepEqual(documentOf(f.store), parseProfileMedia(f.raw()));
});

test("read errors and invalid metadata require recovery and retry can restore saved media", async () => {
  for (const raw of ["broken", JSON.stringify({ version: 2 })]) {
    const f = fixture(raw); f.store.start(); await flush();
    assert.equal(f.store.getSnapshot().state.kind, "error");
    assert.equal(await f.store.saveAvatar(source), false);
    await f.storage.setItem(profileMediaStorageKey, JSON.stringify(saved));
    f.store.retryLoad(); await flush();
    assert.deepEqual(documentOf(f.store), saved);
  }
  const f = fixture();
  f.storage.getItem = async () => { throw new Error("Storage unavailable"); };
  f.store.start(); await flush();
  assert.equal(f.store.getSnapshot().state.kind, "error");
  f.storage.getItem = async () => null;
  f.store.retryLoad(); await flush(); assert.deepEqual(documentOf(f.store), empty);
});

test("stopped reads and stale retries cannot publish into the current lifecycle", async () => {
  const f = fixture();
  const read = deferred<string | null>();
  f.storage.getItem = () => read.promise;
  let changes = 0;
  f.store.subscribe(() => changes++);
  f.store.start(); f.store.stop();
  const stopped = changes;
  read.resolve(JSON.stringify(saved)); await flush();
  assert.equal(changes, stopped);
  assert.equal(await f.store.saveAvatar(source), false);
  const old = deferred<string | null>();
  f.storage.getItem = () => old.promise;
  f.store.start();
  f.storage.getItem = async () => JSON.stringify(saved);
  f.store.retryLoad(); await flush();
  old.reject(new Error("Stale read")); await flush();
  assert.deepEqual(documentOf(f.store), saved);
});

test("stop during import cancels the unpublished mutation and cleans its new asset", async () => {
  const f = await ready();
  const gate = deferred<void>();
  const importPhoto = f.files.importPhoto;
  f.files.importPhoto = async (selected, id) => { await gate.promise; return importPhoto(selected, id); };
  const result = f.store.saveAvatar(source);
  f.store.stop(); f.store.start();
  assert.equal(f.store.getSnapshot().state.kind, "loading");
  gate.resolve(); assert.equal(await result, false); await flush();
  assert.deepEqual(documentOf(f.store), saved);
  assert.equal(f.assets.has("new-1"), false);
  assert.equal(f.assets.has("image-1"), true);
  assert.deepEqual(f.events, ["read", "import:new-1", "remove:new-1", "read"]);
});

test("metadata committed across stop and restart keeps its imported asset and reloads durable state", async () => {
  const f = await ready();
  const gate = deferred<void>();
  const write = f.storage.setItem;
  f.storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const result = f.store.saveAvatar(source); await flush();
  f.store.stop(); f.store.start();
  assert.equal(await f.store.saveAvatar(source), false);
  gate.resolve(); assert.equal(await result, true); await flush();
  assert.equal(documentOf(f.store).avatar?.id, "new-1");
  assert.equal(f.assets.has("new-1"), true);
  assert.equal(f.assets.has("image-1"), false);
  assert.deepEqual(f.events, ["read", "import:new-1", "write", "remove:image-1", "read"]);
});

test("import failures preserve document and caller data and allow retry", async () => {
  const f = await ready();
  const importPhoto = f.files.importPhoto;
  f.files.importPhoto = async () => { throw new Error("Unreadable image"); };
  const input = { source: { ...source }, date: "2026-10-04", note: "Keep my draft" };
  assert.equal(await f.store.addPhoto(input), false);
  assert.deepEqual(input, { source, date: "2026-10-04", note: "Keep my draft" });
  assert.deepEqual(documentOf(f.store), saved);
  assert.deepEqual(f.events, ["read"]);
  f.files.importPhoto = importPhoto;
  assert.equal(await f.store.addPhoto(input), true);
});

test("unsafe or reused generated IDs never overwrite another asset", async () => {
  for (const id of ["../outside", "image-1", "photo-1"]) {
    const f = fixture(JSON.stringify(saved));
    const store = createProfileMediaPersistence({ storage: f.storage, files: f.files, createId: () => id });
    store.start(); await flush();
    assert.equal(await store.saveAvatar(source), false);
    assert.deepEqual(f.events, ["read"]);
    assert.deepEqual(documentOf(store), saved);
  }
});

test("malformed metadata rejects paths, bad dimensions, invalid dates, long notes, and reused identities", () => {
  const invalid = [
    "broken", JSON.stringify({ ...saved, version: 2 }),
    JSON.stringify({ ...saved, avatar: { ...image, id: "../outside" } }),
    JSON.stringify({ ...saved, avatar: { ...image, uri: "file:///outside" } }),
    JSON.stringify({ ...saved, avatar: { ...image, width: 0 } }),
    JSON.stringify({ ...saved, avatar: { ...image, height: 1.5 } }),
    JSON.stringify({ ...saved, photos: [{ ...saved.photos[0], date: "2026-02-30" }] }),
    JSON.stringify({ ...saved, photos: [{ ...saved.photos[0], date: "2026-2-03" }] }),
    JSON.stringify({ ...saved, photos: [{ ...saved.photos[0], note: "x".repeat(2001) }] }),
    JSON.stringify({ ...saved, photos: [{ ...saved.photos[0], image }] }),
    JSON.stringify({ ...saved, photos: [{ ...saved.photos[0], id: "image-1" }] }),
    JSON.stringify({ ...saved, photos: [saved.photos[0], saved.photos[0]] }),
  ];
  for (const raw of invalid) assert.throws(() => parseProfileMedia(raw));
  assert.doesNotThrow(() => parseProfileMedia(JSON.stringify({ ...saved, photos: [{ ...saved.photos[0], date: "2024-02-29", note: "x".repeat(2000) }] })));
});

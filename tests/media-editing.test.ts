import { createAccountStorage } from "../src/account/storage.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { profileMediaOwnershipKey } from "../src/profile/media-ownership.ts";
import { createMediaEditing } from "../src/profile/media-editing.ts";
import { createProfileMediaPersistence } from "../src/profile/media-persistence.ts";
import type { MediaFiles, PhotoSource, ProfileMediaDocument } from "../src/profile/media-model.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const flush = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};
const source = (uri: string): PhotoSource => ({ uri, width: 800, height: 600 });
const saved: ProfileMediaDocument = {
  version: 1,
  avatar: { id: "avatar", width: 800, height: 600 },
  photos: [
    {
      id: "photo",
      date: "2026-10-01",
      note: "Saved note",
      image: { id: "image", width: 800, height: 600 },
    },
  ],
};
async function fixture(mode: "avatar" | "photos" = "photos") {
  let ownership: string | null = null;
  let raw = JSON.stringify(saved),
    sequence = 0,
    fail = false;
  const writes = deferred<void>(),
    imports = deferred<void>();
  let delayed = false,
    importDelayed = false;
  const released: string[] = [],
    assets = new Set(["avatar", "image"]);
  const files: MediaFiles = {
    async importPhoto(selected, id) {
      if (importDelayed) await imports.promise;
      assets.add(id);
      return { id, width: selected.width, height: selected.height };
    },
    async resolvePhoto(image) {
      return `owned://${image.id}`;
    },
    async removePhoto(image) {
      assets.delete(image.id);
    },
    releaseUri(uri) {
      released.push(uri);
    },
  };
  const account = createAccountStorage({
    userId: null,
    remote: null,
    local: {
      async getItem(key) {
        if (key === profileMediaOwnershipKey) return ownership;
        return key === "kinevault-track.profile-media.v1" ? raw : null;
      },
      async setItem(key, value) {
        if (key === profileMediaOwnershipKey) {
          ownership = value;
          return;
        }
        if (delayed) await writes.promise;
        if (fail) throw new Error("disk full");
        raw = value;
      },
      async removeItem(key) {
        if (key === profileMediaOwnershipKey) ownership = null;
        else raw = "";
      },
      async getAllKeys() {
        return ["kinevault-track.profile-media.v1", profileMediaOwnershipKey];
      },
    },
  });
  await account.start();
  const media = createProfileMediaPersistence({
    files,
    createId: () => `new-${++sequence}`,
    storage: account,
  });
  media.start();
  await flush();
  const picks: {
    origin: string;
    avatar: boolean;
    result: ReturnType<typeof deferred<PhotoSource | null>>;
  }[] = [];
  const editing = createMediaEditing({
    mode,
    media,
    files,
    today: () => "2026-10-04",
    pick(origin, avatar) {
      const result = deferred<PhotoSource | null>();
      picks.push({ origin, avatar, result });
      return result.promise;
    },
  });
  editing.start();
  return {
    editing,
    media,
    picks,
    released,
    assets,
    document: () => JSON.parse(raw) as ProfileMediaDocument,
    fail: (value: boolean) => {
      fail = value;
    },
    delay: () => {
      delayed = true;
    },
    finish: () => writes.resolve(),
    delayImport: () => {
      importDelayed = true;
    },
    finishImport: () => imports.resolve(),
  };
}

test("first gallery pick remains the same editable attempt through failed save and retry", async () => {
  const f = await fixture();
  const picked = f.editing.pick("library");
  assert.equal(f.editing.getSnapshot().attempt.kind, "closed");
  f.picks[0].result.resolve(source("draft"));
  await picked;
  f.editing.change({ date: "2026-10-02", note: "Retain my edit" });
  f.fail(true);
  assert.equal(await f.editing.save(), false);
  const failed = f.editing.getSnapshot();
  assert.equal(failed.attempt.kind, "photo");
  if (failed.attempt.kind === "photo") {
    assert.equal(failed.attempt.source?.uri, "draft");
    assert.equal(failed.attempt.date, "2026-10-02");
    assert.equal(failed.attempt.note, "Retain my edit");
  }
  assert.equal(f.document().photos.length, 1);
  assert.deepEqual(f.released, []);
  assert.match(failed.error!, /Couldn't save your photo changes/);
  f.fail(false);
  assert.equal(await f.editing.save(), true);
  assert.equal(f.document().photos[1].note, "Retain my edit");
  assert.equal(f.editing.getSnapshot().attempt.kind, "closed");
  assert.deepEqual(f.released, ["draft"]);
});

test("media failure belongs to its attempt and does not follow a replacement editor", async () => {
  const f = await fixture();
  f.editing.open(saved.photos[0]);
  f.editing.change({ note: "Failed draft" });
  f.fail(true);
  assert.equal(await f.editing.save(), false);
  assert.match(f.editing.getSnapshot().error!, /Couldn't save your photo changes/);
  f.editing.cancel();
  f.editing.open(saved.photos[0]);
  assert.equal(f.editing.getSnapshot().error, null);
  // The durable failure is still available to its own callers, but this edit
  // renders only its attempt's feedback.
  assert.ok(f.media.getSnapshot().error);
});

test("editing snapshot follows shared media writes and reload readiness", async () => {
  const f = await fixture();
  f.editing.open(saved.photos[0]);
  f.editing.change({ note: "Retained draft" });
  const observed: { busy: boolean; ready: boolean }[] = [];
  f.editing.subscribe(() => {
    const { busy, ready } = f.editing.getSnapshot();
    observed.push({ busy, ready });
  });
  f.delay();
  const writing = f.media.saveAvatar(source("another editor"));
  assert.equal(f.editing.getSnapshot().busy, true);
  f.finish();
  await writing;
  assert.equal(f.editing.getSnapshot().busy, false);
  f.media.retryLoad();
  assert.equal(f.editing.getSnapshot().ready, false);
  await flush();
  assert.equal(f.editing.getSnapshot().ready, true);
  assert.deepEqual(observed, [
    { busy: true, ready: true },
    { busy: false, ready: true },
    { busy: false, ready: false },
    { busy: false, ready: true },
  ]);
  const attempt = f.editing.getSnapshot().attempt;
  assert.equal(attempt.kind, "photo");
  if (attempt.kind === "photo") assert.equal(attempt.note, "Retained draft");
});

test("failure of an earlier media save cannot add feedback to its replacement edit", async () => {
  const f = await fixture();
  f.editing.open(saved.photos[0]);
  f.editing.change({ note: "Old save" });
  f.delay();
  f.fail(true);
  const saving = f.editing.save();
  f.editing.open(saved.photos[0]);
  f.finish();
  assert.equal(await saving, false);
  assert.equal(f.editing.getSnapshot().error, null);
  const attempt = f.editing.getSnapshot().attempt;
  assert.equal(attempt.kind, "photo");
  if (attempt.kind === "photo") assert.equal(attempt.note, "Saved note");
});

test("detached media edit unsubscribes and reattachment reads current readiness", async () => {
  const f = await fixture();
  let updates = 0;
  f.editing.subscribe(() => {
    updates++;
  });
  f.editing.stop();
  await flush();
  const stoppedUpdates = updates;
  f.media.retryLoad();
  assert.equal(updates, stoppedUpdates);
  f.editing.start();
  assert.equal(f.editing.getSnapshot().ready, false);
  await flush();
  assert.equal(f.editing.getSnapshot().ready, true);
});

test("avatar selection uses cropping and replacement retires only replaced sources", async () => {
  const f = await fixture("avatar");
  f.editing.open();
  let pick = f.editing.pick("camera");
  assert.equal(f.picks[0].avatar, true);
  assert.equal(f.picks[0].origin, "camera");
  f.picks[0].result.resolve(source("first"));
  await pick;
  pick = f.editing.pick("library");
  f.picks[1].result.resolve(source("second"));
  await pick;
  assert.deepEqual(f.released, ["first"]);
  assert.equal(await f.editing.save(), true);
  assert.notEqual(f.document().avatar?.id, "avatar");
  assert.equal(f.assets.has("avatar"), false);
  assert.deepEqual(f.released, ["first", "second"]);
});

test("cancelled or denied replacement leaves existing date note and chosen image intact", async () => {
  const f = await fixture();
  f.editing.open(saved.photos[0]);
  f.editing.change({ date: "2026-10-03", note: "New note" });
  const pick = f.editing.pick("camera");
  f.picks[0].result.resolve(null);
  await pick;
  assert.equal(await f.editing.save(), true);
  assert.deepEqual(f.document().photos[0], {
    ...saved.photos[0],
    date: "2026-10-03",
    note: "New note",
  });
});

test("invalid date and oversized note cannot publish photo changes and remain correctable", async () => {
  const f = await fixture();
  f.editing.open(saved.photos[0]);
  for (const change of [{ date: "2026-02-30" }, { date: "2026-10-02", note: "x".repeat(2001) }]) {
    f.editing.change(change);
    assert.equal(await f.editing.save(), false);
    assert.deepEqual(f.document(), saved);
    assert.ok(f.editing.getSnapshot().error);
  }
  f.editing.change({ note: "Corrected" });
  assert.equal(await f.editing.save(), true);
  assert.equal(f.document().photos[0].note, "Corrected");
});

test("failed removal retains the editable attempt and successful retry removes only its media", async () => {
  for (const mode of ["avatar", "photos"] as const) {
    const f = await fixture(mode);
    f.editing.open(mode === "photos" ? saved.photos[0] : undefined);
    f.fail(true);
    assert.equal(await f.editing.remove(), false);
    assert.notEqual(f.editing.getSnapshot().attempt.kind, "closed");
    assert.deepEqual(f.document(), saved);
    f.fail(false);
    assert.equal(await f.editing.remove(), true);
    assert.equal(f.editing.getSnapshot().attempt.kind, "closed");
    assert.equal(
      mode === "avatar" ? f.document().avatar : f.document().photos[0],
      mode === "avatar" ? null : undefined,
    );
    assert.equal(
      mode === "avatar" ? f.document().photos.length : f.document().avatar?.id,
      mode === "avatar" ? 1 : "avatar",
    );
  }
});

test("picker admission is synchronous even when observers reenter commands", async () => {
  const f = await fixture();
  f.editing.subscribe(() => {
    void f.editing.pick("camera");
    f.editing.open(saved.photos[0]);
  });
  const pick = f.editing.pick("library");
  assert.equal(f.picks.length, 1);
  assert.equal(f.editing.cancel(), false);
  f.picks[0].result.resolve(source("new"));
  await pick;
  assert.equal(f.editing.getSnapshot().attempt.kind, "photo");
  assert.equal(f.picks.length, 1);
});

test("save captures fields before observers can change or replace its attempt", async () => {
  const f = await fixture();
  f.editing.open(saved.photos[0]);
  f.editing.change({ note: "Captured" });
  f.editing.subscribe(() => {
    f.editing.change({ note: "Reentrant" });
    f.editing.open(saved.photos[0]);
    void f.editing.remove();
  });
  assert.equal(await f.editing.save(), true);
  assert.equal(f.document().photos[0].note, "Captured");
  assert.equal(f.document().photos.length, 1);
  assert.equal(f.editing.getSnapshot().attempt.kind, "closed");
});

test("pending save blocks edits cancellation and duplicates but cannot retire a replacement attempt", async () => {
  const f = await fixture();
  f.editing.open(saved.photos[0]);
  f.editing.change({ note: "Original save" });
  f.delay();
  const saving = f.editing.save();
  await flush();
  assert.equal(f.editing.cancel(), false);
  assert.equal(f.editing.change({ note: "Too late" }), false);
  assert.equal(await f.editing.save(), false);
  assert.equal(await f.editing.remove(), false);
  f.editing.open(saved.photos[0]);
  f.finish();
  assert.equal(await saving, true);
  const attempt = f.editing.getSnapshot().attempt;
  assert.equal(attempt.kind, "photo");
  if (attempt.kind === "photo") assert.equal(attempt.note, "Saved note");
  assert.equal(f.document().photos[0].note, "Original save");
});

test("global durable save rejects picker and editing commands through the real store", async () => {
  const f = await fixture();
  f.editing.open(saved.photos[0]);
  f.delay();
  const saving = f.media.saveAvatar(source("other"));
  await flush();
  assert.equal(await f.editing.pick("library"), false);
  assert.equal(await f.editing.save(), false);
  assert.equal(f.editing.change({ note: "Blocked" }), false);
  assert.equal(f.picks.length, 0);
  f.finish();
  await saving;
  f.editing.change({ note: "After save" });
  assert.equal(await f.editing.save(), true);
  assert.equal(f.document().photos[0].note, "After save");
});

test("disposed first picker completion cannot reopen an editor", async () => {
  const f = await fixture();
  const pick = f.editing.pick("library");
  f.editing.stop();
  await flush();
  f.picks[0].result.resolve(source("late"));
  await pick;
  assert.equal(f.editing.getSnapshot().attempt.kind, "closed");
  assert.deepEqual(f.released, ["late"]);
  assert.deepEqual(f.document(), saved);
});

test("StrictMode stop start rehearsal retains chosen draft and later real disposal releases it once", async () => {
  const f = await fixture();
  const pick = f.editing.pick("library");
  f.picks[0].result.resolve(source("retained"));
  await pick;
  f.editing.change({ note: "Retained through rehearsal" });
  f.editing.stop();
  f.editing.start();
  await flush();
  assert.deepEqual(f.released, []);
  const attempt = f.editing.getSnapshot().attempt;
  assert.equal(attempt.kind, "photo");
  if (attempt.kind === "photo") assert.equal(attempt.note, "Retained through rehearsal");
  f.editing.stop();
  await flush();
  f.editing.stop();
  await flush();
  assert.deepEqual(f.released, ["retained"]);
});

test("disposal during durable write suppresses editor completion without deleting committed image", async () => {
  const f = await fixture("avatar");
  f.editing.open();
  const pick = f.editing.pick("library");
  f.picks[0].result.resolve(source("save-source"));
  await pick;
  f.delay();
  const saving = f.editing.save();
  await flush();
  f.editing.stop();
  await flush();
  assert.deepEqual(f.released, []);
  f.finish();
  assert.equal(await saving, true);
  assert.equal(f.editing.getSnapshot().attempt.kind, "closed");
  assert.ok(f.assets.has(f.document().avatar!.id));
  assert.deepEqual(f.released, ["save-source"]);
});

test("save reserves real durable persistence before edit observers can issue another mutation", async () => {
  const f = await fixture();
  f.editing.open(saved.photos[0]);
  f.editing.change({ note: "Intended save" });
  f.editing.subscribe(() => {
    if (f.editing.getSnapshot().phase === "saving") void f.media.saveAvatar(source("competing"));
  });
  assert.equal(await f.editing.save(), true);
  assert.equal(f.document().photos[0].note, "Intended save");
  assert.equal(f.document().avatar?.id, "avatar");
});

test("picker rejection retains an already chosen image and editable fields for retry", async () => {
  const f = await fixture();
  let pick = f.editing.pick("library");
  f.picks[0].result.resolve(source("chosen"));
  await pick;
  f.editing.change({ note: "Chosen note" });
  pick = f.editing.pick("camera");
  f.picks[1].result.reject(new Error("picker unavailable"));
  assert.equal(await pick, false);
  assert.ok(f.editing.getSnapshot().error);
  const attempt = f.editing.getSnapshot().attempt;
  assert.equal(attempt.kind, "photo");
  if (attempt.kind === "photo") {
    assert.equal(attempt.source?.uri, "chosen");
    assert.equal(attempt.note, "Chosen note");
  }
  assert.deepEqual(f.released, []);
  assert.equal(await f.editing.save(), true);
});

test("dismissal releases chosen source once and keeps durable records unchanged", async () => {
  const f = await fixture();
  const pick = f.editing.pick("library");
  f.picks[0].result.resolve(source("cancelled"));
  await pick;
  assert.equal(f.editing.cancel(), true);
  assert.equal(f.editing.getSnapshot().attempt.kind, "closed");
  f.editing.stop();
  await flush();
  assert.deepEqual(f.released, ["cancelled"]);
  assert.deepEqual(f.document(), saved);
});

test("stop start during replacement picker retains original source and suppresses late replacement", async () => {
  const f = await fixture();
  let pick = f.editing.pick("library");
  f.picks[0].result.resolve(source("original"));
  await pick;
  pick = f.editing.pick("camera");
  f.editing.stop();
  f.editing.start();
  await flush();
  f.picks[1].result.resolve(source("stale replacement"));
  assert.equal(await pick, false);
  const attempt = f.editing.getSnapshot().attempt;
  assert.equal(attempt.kind, "photo");
  if (attempt.kind === "photo") assert.equal(attempt.source?.uri, "original");
  assert.equal(f.editing.getSnapshot().phase, "idle");
  assert.deepEqual(f.released, ["stale replacement"]);
  assert.equal(await f.editing.save(), true);
  assert.equal(f.document().photos.length, 2);
});

test("stop start during durable save preserves the draft and does not retire it from an older lifecycle", async () => {
  const f = await fixture("avatar");
  f.editing.open();
  const pick = f.editing.pick("library");
  f.picks[0].result.resolve(source("original"));
  await pick;
  f.delay();
  const saving = f.editing.save();
  await flush();
  f.editing.stop();
  f.editing.start();
  await flush();
  f.finish();
  assert.equal(await saving, true);
  assert.equal(f.editing.getSnapshot().attempt.kind, "avatar");
  assert.equal(f.editing.getSnapshot().phase, "idle");
  assert.deepEqual(f.released, []);
  assert.ok(f.assets.has(f.document().avatar!.id));
  f.editing.cancel();
  assert.deepEqual(f.released, ["original"]);
});

test("picked source belongs to the edit rather than the picker adapter's mutable result", async () => {
  const f = await fixture();
  const selected = source("chosen");
  const pick = f.editing.pick("library");
  f.picks[0].result.resolve(selected);
  await pick;
  selected.uri = "changed outside the edit";
  selected.width = 20;
  assert.equal(await f.editing.save(), true);
  assert.equal(f.document().photos[1].image.width, 800);
  assert.deepEqual(f.released, ["chosen"]);
});

test("replacement editor opened during picker cannot be overwritten by its older result", async () => {
  const f = await fixture();
  const pick = f.editing.pick("library");
  f.editing.open(saved.photos[0]);
  f.picks[0].result.resolve(source("late new photo"));
  assert.equal(await pick, false);
  const attempt = f.editing.getSnapshot().attempt;
  assert.equal(attempt.kind, "photo");
  if (attempt.kind === "photo") assert.equal(attempt.photo?.id, "photo");
  assert.deepEqual(f.released, ["late new photo"]);
  assert.deepEqual(f.document(), saved);
});

test("source remains available to a pending real import after its editor is disposed", async () => {
  const f = await fixture("avatar");
  f.editing.open();
  const pick = f.editing.pick("library");
  f.picks[0].result.resolve(source("import-source"));
  await pick;
  f.delayImport();
  const saving = f.editing.save();
  await flush();
  f.editing.stop();
  await flush();
  assert.deepEqual(f.document(), saved);
  assert.deepEqual(f.released, []);
  f.finishImport();
  assert.equal(await saving, true);
  assert.ok(f.assets.has(f.document().avatar!.id));
  assert.deepEqual(f.released, ["import-source"]);
  assert.equal(f.editing.getSnapshot().attempt.kind, "closed");
});

import assert from "node:assert/strict";
import test from "node:test";
import { emptyAnswers } from "../src/profile/answers.ts";
import { createFocusedProfileEdit } from "../src/profile/focused-editing.ts";
import { createProfilePersistence, profileStorageKey, type ProfileStorage } from "../src/profile/persistence.ts";
import type { ProfileDocument } from "../src/profile/model.ts";

const complete: ProfileDocument = { version: 1, kind: "complete", answers: {
  ...emptyAnswers, name: "Saved", age: "30", height: "180", weight: "80",
  goal: "maintain", activity: "moderate", sex: "male", eligible: true,
} };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  return { promise, resolve };
}
async function ready() {
  let raw = JSON.stringify(complete);
  const calls: string[] = [];
  const externalListeners = new Set<() => void>();
  const storage: ProfileStorage = {
    async getItem(key) { assert.equal(key, profileStorageKey); calls.push("read"); return raw; },
    async setItem(key, value) { assert.equal(key, profileStorageKey); calls.push("write"); raw = value; },
    async removeItem(key) { assert.equal(key, profileStorageKey); calls.push("remove"); raw = ""; },
    subscribeItem(key, listener) {
      assert.equal(key, profileStorageKey);
      externalListeners.add(listener);
      return () => { externalListeners.delete(listener); };
    },
  };
  const profile = createProfilePersistence(storage);
  profile.start(); await flush();
  let closes = 0;
  const edit = createFocusedProfileEdit(profile, { onClose: () => { closes++; } });
  edit.start();
  return { profile, edit, storage, calls, raw: () => JSON.parse(raw) as ProfileDocument, closes: () => closes,
    async replaceExternally(document: ProfileDocument) {
      await storage.setItem(profileStorageKey, JSON.stringify(document));
      for (const listener of externalListeners) listener();
    },
  };
}
function answersOf(profile: ReturnType<typeof createProfilePersistence>) {
  const saved = profile.getSnapshot().state;
  assert.equal(saved.kind, "ready");
  if (saved.kind !== "ready") throw new Error("Expected saved Profile");
  return saved.document.answers;
}

test("construction is inert, snapshots are stable, and cancel preserves saved answers", async () => {
  const { profile, calls, closes } = await ready();
  const initial = { ...complete.answers };
  let dismissed = 0;
  const edit = createFocusedProfileEdit(profile, { initial: { section: "age", answers: initial }, onClose: () => { dismissed++; } });
  initial.age = "99";
  assert.equal(edit.getSnapshot(), edit.getSnapshot());
  assert.equal(edit.getSnapshot().attempt?.draft.age, "30");
  assert.equal(edit.change({ kind: "fields", patch: { age: "40" } }), false);
  edit.start(); edit.start();
  assert.equal(edit.change({ kind: "fields", patch: { age: "40" } }), true);
  assert.equal(edit.cancel(), true);
  assert.equal(edit.cancel(), false);
  assert.equal(edit.getSnapshot().attempt, null);
  assert.equal(answersOf(profile).age, "30");
  assert.deepEqual(calls, ["read"]);
  assert.equal(dismissed, 1);
  assert.equal(closes(), 0);
});

test("focused Save merges only its fields into the latest durable Profile", async () => {
  const { profile, edit, raw, closes } = await ready();
  edit.begin("name");
  edit.change({ kind: "fields", patch: { name: "New name", weight: "1", customProtein: "1" } });
  assert.equal(await profile.save({ ...complete, answers: { ...complete.answers, weight: "81", customProtein: "0" } }), true);
  assert.equal(await edit.save(), true);
  assert.equal(raw().answers.name, "New name");
  assert.equal(raw().answers.weight, "81");
  assert.equal(raw().answers.customProtein, "0");
  assert.equal(edit.getSnapshot().attempt, null);
  assert.equal(closes(), 1);
});

test("external Profile replacement preserves a focused draft and Save merges into the new durable answers", async () => {
  const { profile, edit, replaceExternally, raw, closes } = await ready();
  edit.begin("name");
  edit.change({ kind: "fields", patch: { name: "My unfinished name" } });
  const attempt = edit.getSnapshot().attempt;
  await replaceExternally({ ...complete, answers: { ...complete.answers, name: "Another device", age: "35", weight: "82" } });
  await flush();
  assert.equal(edit.getSnapshot().attempt, attempt);
  assert.equal(edit.getSnapshot().attempt?.draft.name, "My unfinished name");
  assert.equal(answersOf(profile).name, "Another device");
  assert.equal(closes(), 0);
  assert.equal(await edit.save(), true);
  assert.equal(raw().answers.name, "My unfinished name");
  assert.equal(raw().answers.age, "35");
  assert.equal(raw().answers.weight, "82");
});

test("draft changes own calorie policy and focused age Save preserves newer macros", async () => {
  const { profile, edit, raw } = await ready();
  edit.begin("age");
  edit.change({ kind: "fields", patch: { age: "17" } });
  assert.equal(edit.getSnapshot().attempt?.draft.estimateEnabled, false);
  assert.equal(edit.getSnapshot().attempt?.draft.sex, null);
  await profile.save({ ...complete, answers: { ...complete.answers, customProtein: "0", customCalories: "2500" } });
  assert.equal(await edit.save(), true);
  assert.equal(raw().answers.age, "17");
  assert.equal(raw().answers.customProtein, "0");
  assert.equal(raw().answers.customCalories, "");
  assert.equal(raw().answers.estimateEnabled, false);
});

test("validation keeps raw draft and errors without writing; editing permits retry", async () => {
  const { edit, calls, closes } = await ready();
  edit.begin("name");
  edit.change({ kind: "fields", patch: { name: "X".repeat(41) } });
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().attempt?.draft.name, "X".repeat(41));
  assert.ok(edit.getSnapshot().attempt?.errors.name);
  assert.equal(edit.getSnapshot().busy, false);
  assert.deepEqual(calls, ["read"]);
  assert.equal(closes(), 0);
  edit.change({ kind: "fields", patch: { name: "Valid" } });
  assert.deepEqual(edit.getSnapshot().attempt?.errors, {});
  assert.equal(await edit.save(), true);
});

test("Save validates the whole current Profile, including unowned fields", async () => {
  const { profile, edit, calls } = await ready();
  // A saved setup draft is valid persistence input but cannot be completed by
  // silently ignoring an unrelated missing answer.
  await profile.save({ version: 1, kind: "draft", step: "body", answers: { ...complete.answers, height: "" } });
  calls.length = 0;
  edit.begin("name"); edit.change({ kind: "fields", patch: { name: "Valid" } });
  assert.equal(await edit.save(), false);
  assert.ok(edit.getSnapshot().attempt?.errors.height);
  assert.deepEqual(calls, []);
});

test("padded names obey the durable length limit with field feedback and permit valid retry", async () => {
  const { edit, calls, raw } = await ready();
  edit.begin("name");
  edit.change({ kind: "fields", patch: { name: `  ${"A".repeat(39)}` } });
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().attempt?.errors.name, "Use 40 characters or fewer.");
  assert.equal(edit.getSnapshot().attempt?.error, null);
  assert.deepEqual(calls, ["read"]);
  const valid = ` ${"A".repeat(39)}`;
  edit.change({ kind: "fields", patch: { name: valid } });
  assert.equal(await edit.save(), true);
  assert.equal(raw().answers.name, valid);
});

test("failed durable Save retains draft and error and succeeds on retry", async () => {
  const { edit, storage, raw, closes } = await ready();
  const write = storage.setItem;
  storage.setItem = async () => { throw new Error("disk full"); };
  edit.begin("name"); edit.change({ kind: "fields", patch: { name: "Retry me" } });
  assert.equal(await edit.save(), false);
  assert.equal(raw().answers.name, "Saved");
  assert.equal(edit.getSnapshot().attempt?.draft.name, "Retry me");
  assert.equal(edit.getSnapshot().attempt?.error, "Couldn't save your answers. Try again.");
  assert.equal(edit.getSnapshot().busy, false);
  assert.equal(closes(), 0);
  storage.setItem = write;
  const retry = edit.save();
  assert.equal(edit.getSnapshot().attempt?.error, null);
  assert.equal(await retry, true);
  assert.equal(raw().answers.name, "Retry me");
  assert.equal(closes(), 1);
});

test("error publication rejects a synchronous observer retry without recursive validation", async () => {
  const { edit, calls } = await ready();
  edit.begin("name"); edit.change({ kind: "fields", patch: { name: "X".repeat(41) } });
  let notifications = 0;
  let retry: Promise<boolean> | null = null;
  edit.subscribe(() => {
    notifications++;
    retry = edit.save();
  });
  assert.equal(await edit.save(), false);
  assert.equal(await retry, false);
  assert.equal(notifications, 1);
  assert.equal(edit.getSnapshot().busy, false);
  assert.deepEqual(calls, ["read"]);
  edit.change({ kind: "fields", patch: { name: "Retry later" } });
  assert.equal(await edit.save(), true);
});

test("pending Save rejects duplicate, mutation, cancellation and competing persistence writes", async () => {
  const { profile, edit, storage, calls } = await ready();
  const gate = deferred(); const write = storage.setItem;
  storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  edit.begin("age"); edit.change({ kind: "fields", patch: { age: "31" } });
  const saving = edit.save();
  assert.equal(edit.getSnapshot().busy, true);
  assert.equal(edit.change({ kind: "fields", patch: { age: "99" } }), false);
  assert.equal(edit.cancel(), false);
  assert.equal(edit.begin("name"), false);
  assert.equal(await edit.save(), false);
  assert.equal(await profile.save(complete), false);
  gate.resolve();
  assert.equal(await saving, true);
  assert.equal(answersOf(profile).age, "31");
  assert.deepEqual(calls, ["read", "write"]);
});

test("Save reserves both locks before edit observers can issue competing commands", async () => {
  const { profile, edit, calls } = await ready();
  edit.begin("name"); edit.change({ kind: "fields", patch: { name: "Owner" } });
  let observed = false;
  let duplicate: Promise<boolean> | null = null, competing: Promise<boolean> | null = null;
  edit.subscribe(() => {
    if (observed || !edit.getSnapshot().busy) return;
    observed = true;
    assert.equal(edit.cancel(), false);
    assert.equal(edit.begin("age"), false);
    assert.equal(edit.change({ kind: "fields", patch: { name: "Intruder" } }), false);
    duplicate = edit.save(); competing = profile.save(complete);
  });
  assert.equal(await edit.save(), true);
  assert.equal(observed, true);
  assert.equal(await duplicate, false);
  assert.equal(await competing, false);
  assert.equal(answersOf(profile).name, "Owner");
  assert.deepEqual(calls, ["read", "write"]);
});

test("inline draft can start during another save and uses latest answers when enabled", async () => {
  const { profile, edit, storage } = await ready();
  const gate = deferred(); const write = storage.setItem;
  storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  const saving = profile.save({ ...complete, answers: { ...complete.answers, weight: "82" } });
  assert.equal(edit.begin("name"), true);
  assert.equal(edit.getSnapshot().attempt?.draft.name, "Saved");
  assert.equal(edit.getSnapshot().busy, true);
  assert.equal(edit.change({ kind: "fields", patch: { name: "Too soon" } }), false);
  assert.equal(await edit.save(), false);
  gate.resolve(); await saving;
  assert.equal(edit.getSnapshot().busy, false);
  edit.change({ kind: "fields", patch: { name: "Enabled" } });
  assert.equal(await edit.save(), true);
  assert.equal(answersOf(profile).weight, "82");
});

test("stop/start retains a draft but retired write cannot close resumed editing", async () => {
  const { profile, edit, storage, closes } = await ready();
  const gate = deferred(); const write = storage.setItem;
  storage.setItem = async (key, value) => { await gate.promise; await write(key, value); };
  edit.begin("name"); edit.change({ kind: "fields", patch: { name: "Accepted" } });
  const saving = edit.save();
  edit.stop(); edit.stop(); edit.start(); edit.start();
  assert.equal(edit.getSnapshot().attempt?.draft.name, "Accepted");
  assert.equal(edit.getSnapshot().busy, true);
  gate.resolve();
  assert.equal(await saving, false);
  assert.equal(answersOf(profile).name, "Accepted");
  assert.equal(edit.getSnapshot().attempt?.draft.name, "Accepted");
  assert.equal(closes(), 0);
  edit.change({ kind: "fields", patch: { name: "Resumed" } });
  assert.equal(await edit.save(), true);
  assert.equal(closes(), 1);
});

test("persistence observer may detach and replace a pending attempt without stale closure", async () => {
  const { profile, edit, closes } = await ready();
  edit.begin("name"); edit.change({ kind: "fields", patch: { name: "Old" } });
  let replaced = false;
  profile.subscribe(() => {
    if (replaced || !profile.getSnapshot().saving) return;
    replaced = true;
    edit.stop(); edit.start();
    assert.equal(edit.begin("age"), true);
  });
  assert.equal(await edit.save(), false);
  assert.equal(answersOf(profile).name, "Old");
  assert.equal(edit.getSnapshot().attempt?.section, "age");
  assert.equal(edit.getSnapshot().attempt?.draft.name, "Saved");
  assert.equal(edit.getSnapshot().busy, false);
  assert.equal(closes(), 0);
});

test("success publication cannot close an observer's replacement attempt", async () => {
  const { profile, edit, closes } = await ready();
  edit.begin("name"); edit.change({ kind: "fields", patch: { name: "Accepted" } });
  let replaced = false;
  edit.subscribe(() => {
    if (!replaced && edit.getSnapshot().attempt === null) {
      replaced = true;
      assert.equal(edit.begin("age"), true);
    }
  });
  assert.equal(await edit.save(), true);
  assert.equal(answersOf(profile).name, "Accepted");
  assert.equal(edit.getSnapshot().attempt?.section, "age");
  assert.equal(closes(), 0);
});

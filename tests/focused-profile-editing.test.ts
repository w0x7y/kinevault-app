import assert from "node:assert/strict";
import test from "node:test";
import { emptyAnswers } from "../src/profile/answers.ts";
import { createFocusedProfileEdit, focusedEditFeedback } from "../src/profile/focused-editing.ts";
import {
  createProfilePersistence,
  profileStorageKey,
  type ProfileStorage,
} from "../src/profile/persistence.ts";
import type { ProfileDocument } from "../src/profile/model.ts";
import type { ProfileEditSection } from "../src/profile/section-editing.ts";

const complete: ProfileDocument = {
  version: 1,
  kind: "complete",
  answers: {
    ...emptyAnswers,
    name: "Saved",
    age: "30",
    height: "180",
    weight: "80",
    goal: "maintain",
    activity: "moderate",
    sex: "male",
    eligible: true,
  },
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
async function ready() {
  let raw = JSON.stringify(complete);
  const calls: string[] = [];
  const externalListeners = new Set<() => void>();
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
      raw = "";
    },
    subscribeItem(key, listener) {
      assert.equal(key, profileStorageKey);
      externalListeners.add(listener);
      return () => {
        externalListeners.delete(listener);
      };
    },
  };
  const profile = createProfilePersistence(storage);
  profile.start();
  await flush();
  const open = (section: ProfileEditSection = "name") => {
    const edit = createFocusedProfileEdit(profile, section);
    edit.start();
    return edit;
  };
  return {
    profile,
    open,
    storage,
    calls,
    raw: () => JSON.parse(raw) as ProfileDocument,
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

// The edit lifecycle (exclusion, reservation, feedback ownership and stale
// completions) is covered once in document-edit.test.ts.
test("a focused draft copies the saved answers once; cancel restarts from the latest Profile", async () => {
  const { profile, open, calls, replaceExternally } = await ready();
  const edit = open("age");
  assert.deepEqual(edit.getSnapshot().draft, complete.answers);
  assert.equal(edit.change({ kind: "fields", patch: { age: "40" } }), true);
  await replaceExternally({ ...complete, answers: { ...complete.answers, age: "35" } });
  await flush();
  assert.equal(edit.getSnapshot().draft.age, "40");
  assert.equal(edit.cancel(), true);
  assert.equal(edit.getSnapshot().draft.age, "35");
  assert.equal(answersOf(profile).age, "35");
  assert.deepEqual(calls, ["read", "write", "read"]);
});

test("focused Save merges only its fields into the latest durable Profile", async () => {
  const { profile, open, raw } = await ready();
  const edit = open("name");
  edit.change({ kind: "fields", patch: { name: "New name", weight: "1", customProtein: "1" } });
  assert.equal(
    await profile.save({
      ...complete,
      answers: { ...complete.answers, weight: "81", customProtein: "0" },
    }),
    true,
  );
  assert.equal(await edit.save(), true);
  assert.equal(raw().answers.name, "New name");
  assert.equal(raw().answers.weight, "81");
  assert.equal(raw().answers.customProtein, "0");
});

test("external Profile replacement preserves a focused draft and Save merges into the new durable answers", async () => {
  const { profile, open, replaceExternally, raw } = await ready();
  const edit = open("name");
  edit.change({ kind: "fields", patch: { name: "My unfinished name" } });
  await replaceExternally({
    ...complete,
    answers: { ...complete.answers, name: "Another device", age: "35", weight: "82" },
  });
  await flush();
  assert.equal(edit.getSnapshot().draft.name, "My unfinished name");
  assert.equal(answersOf(profile).name, "Another device");
  assert.equal(await edit.save(), true);
  assert.equal(raw().answers.name, "My unfinished name");
  assert.equal(raw().answers.age, "35");
  assert.equal(raw().answers.weight, "82");
});

test("draft changes own calorie policy and focused age Save preserves newer macros", async () => {
  const { profile, open, raw } = await ready();
  const edit = open("age");
  edit.change({ kind: "fields", patch: { age: "17" } });
  assert.equal(edit.getSnapshot().draft.estimateEnabled, false);
  assert.equal(edit.getSnapshot().draft.sex, null);
  await profile.save({
    ...complete,
    answers: { ...complete.answers, customProtein: "0", customCalories: "2500" },
  });
  assert.equal(await edit.save(), true);
  assert.equal(raw().answers.age, "17");
  assert.equal(raw().answers.customProtein, "0");
  assert.equal(raw().answers.customCalories, "");
  assert.equal(raw().answers.estimateEnabled, false);
});

test("validation reports field errors with the raw draft and never writes", async () => {
  const { open, calls } = await ready();
  const edit = open("name");
  edit.change({ kind: "fields", patch: { name: "X".repeat(41) } });
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().draft.name, "X".repeat(41));
  const { errors, message } = focusedEditFeedback(edit.getSnapshot().error);
  assert.ok(errors.name);
  assert.equal(message, null);
  assert.deepEqual(calls, ["read"]);
  edit.change({ kind: "fields", patch: { name: "Valid" } });
  assert.deepEqual(focusedEditFeedback(edit.getSnapshot().error), { errors: {}, message: null });
  assert.equal(await edit.save(), true);
});

test("Save validates the whole current Profile, including unowned fields", async () => {
  const { profile, open, calls } = await ready();
  // A saved setup draft is valid persistence input but cannot be completed by
  // silently ignoring an unrelated missing answer.
  await profile.save({
    version: 1,
    kind: "draft",
    step: "body",
    answers: { ...complete.answers, height: "" },
  });
  calls.length = 0;
  const edit = open("name");
  edit.change({ kind: "fields", patch: { name: "Valid" } });
  assert.equal(await edit.save(), false);
  assert.ok(focusedEditFeedback(edit.getSnapshot().error).errors.height);
  assert.deepEqual(calls, []);
});

test("padded names obey the durable length limit with field feedback and permit valid retry", async () => {
  const { open, calls, raw } = await ready();
  const edit = open("name");
  edit.change({ kind: "fields", patch: { name: `  ${"A".repeat(39)}` } });
  assert.equal(await edit.save(), false);
  assert.deepEqual(edit.getSnapshot().error, { name: "Use 40 characters or fewer." });
  assert.deepEqual(calls, ["read"]);
  const valid = ` ${"A".repeat(39)}`;
  edit.change({ kind: "fields", patch: { name: valid } });
  assert.equal(await edit.save(), true);
  assert.equal(raw().answers.name, valid);
});

test("a failed durable Save reports the Profile message separately from field errors", async () => {
  const { open, storage, raw } = await ready();
  storage.setItem = async () => {
    throw new Error("disk full");
  };
  const edit = open("name");
  edit.change({ kind: "fields", patch: { name: "Retry me" } });
  assert.equal(await edit.save(), false);
  assert.equal(raw().answers.name, "Saved");
  assert.equal(edit.getSnapshot().draft.name, "Retry me");
  assert.deepEqual(focusedEditFeedback(edit.getSnapshot().error), {
    errors: {},
    message: "Couldn't save your answers. Try again.",
  });
});

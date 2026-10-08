import assert from "node:assert/strict";
import test from "node:test";
import { emptyAnswers } from "../src/profile/answers.ts";
import { calorieState } from "../src/profile/calories.ts";
import type { ProfileDocument } from "../src/profile/model.ts";
import {
  createProfilePersistence,
  profileStorageKey,
  type ProfileStorage,
} from "../src/profile/persistence.ts";
import { createWeightEdit } from "../src/profile/weight-editing.ts";

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
    estimateEnabled: true,
    customProtein: "125",
  },
};
const first = { date: "2026-10-01", kg: 80 };
const second = { date: "2026-10-03", kg: 79 };
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function ready(document: ProfileDocument = { ...complete, weightEntries: [first, second] }) {
  let raw = JSON.stringify(document);
  let failWrites = false;
  let failReads = false;
  let heldWrite: ReturnType<typeof deferred> | null = null;
  const writes: string[] = [];
  const externalListeners = new Set<() => void>();
  const storage: ProfileStorage = {
    async getItem(key) {
      assert.equal(key, profileStorageKey);
      if (failReads) throw new Error("read failure");
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, profileStorageKey);
      writes.push(value);
      if (failWrites) throw new Error("disk failure");
      const gate = heldWrite;
      heldWrite = null;
      if (gate) await gate.promise;
      raw = value;
    },
    async removeItem(key) {
      assert.equal(key, profileStorageKey);
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
  const edit = createWeightEdit(profile);
  edit.start();
  return {
    profile,
    edit,
    writes,
    durable: () => JSON.parse(raw) as ProfileDocument,
    failWrites: (value: boolean) => {
      failWrites = value;
    },
    failReads: (value: boolean) => {
      failReads = value;
    },
    holdWrite() {
      const gate = deferred();
      heldWrite = gate;
      return gate;
    },
    async external(next: ProfileDocument) {
      raw = JSON.stringify(next);
      for (const listener of externalListeners) listener();
      await flush();
    },
  };
}
function measurement(edit: ReturnType<typeof createWeightEdit>) {
  const attempt = edit.getSnapshot().attempt;
  if (attempt?.kind !== "edit") throw new Error("Expected measurement editor");
  return attempt;
}
function saved(profile: ReturnType<typeof createProfilePersistence>) {
  const state = profile.getSnapshot().state;
  if (state.kind !== "ready") throw new Error("Expected saved Profile");
  return state.document;
}

test("construction is inert, unavailable history cannot be edited, and effect restart works", async () => {
  const { profile, writes } = await ready();
  const edit = createWeightEdit(profile);
  const initial = edit.getSnapshot();
  assert.equal(edit.getSnapshot(), initial);
  assert.equal(edit.begin("2026-10-08"), false);
  assert.equal(edit.beginDelete(first), false);
  assert.equal(await edit.save(), false);
  assert.equal(await edit.remove(), false);
  edit.start();
  edit.stop();
  edit.start();
  assert.equal(edit.begin("2026-10-08"), true);
  assert.equal(measurement(edit).draft.date, "2026-10-08");
  assert.equal(measurement(edit).draft.weight, "");
  assert.equal(edit.cancel(), true);
  assert.equal(edit.getSnapshot().attempt, null);
  assert.equal(writes.length, 0);
});

test("invalid raw date and kg stay editable with field feedback; a comma saves to legacy profile.v1", async () => {
  const { edit, profile, writes, durable } = await ready(complete);
  const calories = calorieState(complete.answers);
  edit.begin("2026-02-30");
  edit.change("weight", "0");
  assert.equal(await edit.save(), false);
  assert.deepEqual(measurement(edit).draft, { date: "2026-02-30", weight: "0" });
  assert.match(measurement(edit).fields.date!, /valid date/);
  assert.match(measurement(edit).fields.weight!, /between 1 and 500/);
  assert.equal(writes.length, 0);
  edit.change("weight", " 79,25 ");
  assert.equal(measurement(edit).fields.weight, undefined);
  assert.match(measurement(edit).fields.date!, /valid date/);
  edit.change("date", "2026-10-08");
  assert.equal(await edit.save(), true);
  assert.equal(edit.getSnapshot().attempt, null);
  assert.deepEqual(saved(profile).weightEntries, [{ date: "2026-10-08", kg: 79.25 }]);
  assert.deepEqual(durable(), saved(profile));
  assert.equal(durable().version, 1);
  assert.deepEqual(durable().answers, complete.answers);
  assert.deepEqual(calorieState(durable().answers), calories);
});

test("replacement interpretation follows raw destination and current saved history", async () => {
  const { edit, profile, external, durable } = await ready();
  edit.begin("2026-10-08", first);
  assert.equal(edit.getSnapshot().replacing, false);
  edit.change("date", second.date);
  assert.equal(edit.getSnapshot().replacing, true);
  edit.change("date", "2026-10-05");
  assert.equal(edit.getSnapshot().replacing, false);
  await external({ ...durable(), weightEntries: [first, second, { date: "2026-10-05", kg: 78 }] });
  assert.equal(edit.getSnapshot().replacing, true);
  assert.equal(measurement(edit).draft.previousDate, first.date);
  edit.change("weight", "77.50");
  assert.equal(await edit.save(), true);
  assert.deepEqual(saved(profile).weightEntries, [second, { date: "2026-10-05", kg: 77.5 }]);
  edit.begin(second.date);
  assert.equal(edit.getSnapshot().replacing, true);
  edit.change("weight", "76");
  assert.equal(await edit.save(), true);
  assert.deepEqual(durable().weightEntries, [
    { date: second.date, kg: 76 },
    { date: "2026-10-05", kg: 77.5 },
  ]);
});

test("failed save retains all entered values and history; retry clears feedback before writing", async () => {
  const { edit, profile, durable, failWrites, holdWrite } = await ready();
  const original = durable();
  edit.begin("2026-10-08", first);
  edit.change("date", second.date);
  edit.change("weight", "78,25");
  failWrites(true);
  assert.equal(await edit.save(), false);
  assert.deepEqual(measurement(edit).draft, {
    date: second.date,
    weight: "78,25",
    previousDate: first.date,
  });
  assert.match(measurement(edit).error!, /Couldn't save/);
  assert.deepEqual(durable(), original);
  assert.deepEqual(saved(profile), original);
  failWrites(false);
  const gate = holdWrite();
  const retry = edit.save();
  assert.equal(measurement(edit).error, null);
  assert.equal(edit.getSnapshot().busy, true);
  assert.deepEqual(durable(), original);
  gate.resolve();
  assert.equal(await retry, true);
  assert.equal(edit.getSnapshot().attempt, null);
  assert.deepEqual(durable().weightEntries, [{ date: second.date, kg: 78.25 }]);
});

test("new add, edit, and delete attempts discard older feedback and cancel preserves history", async () => {
  const { edit, durable, failWrites, writes } = await ready();
  const original = durable();
  edit.begin("bad date");
  await edit.save();
  edit.beginDelete(first);
  assert.equal(edit.getSnapshot().attempt?.error, null);
  failWrites(true);
  assert.equal(await edit.remove(), false);
  assert.match(edit.getSnapshot().attempt?.error ?? "", /Couldn't delete/);
  edit.begin("2026-10-08", second);
  assert.equal(measurement(edit).error, null);
  assert.deepEqual(measurement(edit).fields, {});
  edit.change("weight", "78");
  assert.equal(await edit.save(), false);
  assert.match(measurement(edit).error!, /Couldn't save/);
  edit.begin("2026-10-08");
  assert.equal(measurement(edit).error, null);
  assert.equal(measurement(edit).draft.weight, "");
  assert.equal(edit.cancel(), true);
  edit.beginDelete(first);
  assert.equal(edit.cancel(), true);
  assert.equal(writes.length, 2);
  assert.deepEqual(durable(), original);
});

test("failed delete retains its confirmation and history; retry retires only after durability", async () => {
  const { edit, profile, durable, failWrites, holdWrite } = await ready();
  edit.beginDelete(first);
  failWrites(true);
  assert.equal(await edit.remove(), false);
  const attempt = edit.getSnapshot().attempt;
  assert.equal(attempt?.kind, "delete");
  if (attempt?.kind !== "delete") throw new Error("Expected delete confirmation");
  assert.deepEqual(attempt.entry, first);
  assert.match(attempt.error!, /Couldn't delete/);
  assert.deepEqual(durable().weightEntries, [first, second]);
  failWrites(false);
  const gate = holdWrite();
  const retry = edit.remove();
  assert.equal(edit.getSnapshot().attempt?.error, null);
  assert.deepEqual(saved(profile).weightEntries, [first, second]);
  assert.equal(edit.getSnapshot().busy, true);
  gate.resolve();
  assert.equal(await retry, true);
  assert.equal(edit.getSnapshot().attempt, null);
  assert.deepEqual(durable().weightEntries, [second]);
});

for (const operation of ["save", "delete"] as const) {
  test(`${operation} reserves exclusion before notifying observers and keeps history until durable completion`, async () => {
    const { edit, profile, holdWrite, writes, durable } = await ready();
    if (operation === "save") {
      edit.begin("2026-10-08", first);
      edit.change("weight", "78.5");
    } else edit.beginDelete(first);
    const original = durable();
    const gate = holdWrite();
    const competing: Promise<boolean>[] = [];
    let attempted = false;
    const unsubscribe = edit.subscribe(() => {
      if (!edit.getSnapshot().busy || attempted) return;
      attempted = true;
      competing.push(
        edit.save(),
        edit.remove(),
        profile.save(complete),
        profile.removeWeight(second.date),
      );
      assert.equal(edit.begin("2026-10-08"), false);
      assert.equal(edit.beginDelete(second), false);
      assert.equal(edit.change("weight", "1"), false);
      assert.equal(edit.cancel(), false);
    });
    const result = operation === "save" ? edit.save() : edit.remove();
    assert.equal(attempted, true);
    assert.deepEqual(await Promise.all(competing), [false, false, false, false]);
    assert.equal(writes.length, 1);
    assert.deepEqual(durable(), original);
    assert.deepEqual(saved(profile), original);
    assert.equal(edit.getSnapshot().busy, true);
    gate.resolve();
    assert.equal(await result, true);
    assert.equal(edit.getSnapshot().busy, false);
    assert.equal(edit.getSnapshot().attempt, null);
    assert.deepEqual(
      durable().weightEntries,
      operation === "save" ? [{ ...first, kg: 78.5 }, second] : [second],
    );
    unsubscribe();
  });
}

test("validation feedback cannot recursively submit or remove an attempt opened by an observer", async () => {
  const { edit, writes } = await ready();
  edit.begin("not a date");
  const recursive: Promise<boolean>[] = [];
  let notified = false;
  const unsubscribe = edit.subscribe(() => {
    if (notified) return;
    notified = true;
    recursive.push(edit.save());
    edit.beginDelete(first);
    recursive.push(edit.remove());
  });
  assert.equal(await edit.save(), false);
  assert.deepEqual(await Promise.all(recursive), [false, false]);
  assert.equal(writes.length, 0);
  assert.equal(edit.getSnapshot().attempt?.kind, "delete");
  unsubscribe();
  assert.equal(await edit.remove(), true);
});

for (const operation of ["save", "delete"] as const) {
  for (const succeeds of [true, false]) {
    test(`departed ${operation} ${succeeds ? "success" : "failure"} cannot close or report feedback on a replacement attempt`, async () => {
      const { edit, profile, holdWrite, durable } = await ready();
      const original = durable();
      if (operation === "save") {
        edit.begin("2026-10-08", first);
        edit.change("weight", "78");
      } else edit.beginDelete(first);
      const gate = holdWrite();
      const result = operation === "save" ? edit.save() : edit.remove();
      edit.stop();
      edit.start();
      assert.equal(edit.getSnapshot().attempt, null);
      assert.equal(edit.begin("2026-10-07"), false);
      let replacementOpened = false;
      const unsubscribe = edit.subscribe(() => {
        if (replacementOpened || edit.getSnapshot().busy) return;
        replacementOpened = true;
        assert.equal(edit.begin("2026-10-07"), true);
        edit.change("weight", "77,25");
      });
      if (succeeds) gate.resolve();
      else gate.reject(new Error("disk failure"));
      assert.equal(await result, false);
      assert.equal(replacementOpened, true);
      assert.deepEqual(measurement(edit).draft, { date: "2026-10-07", weight: "77,25" });
      assert.equal(measurement(edit).error, null);
      assert.equal(measurement(edit).fields.date, undefined);
      assert.equal(measurement(edit).fields.weight, undefined);
      assert.equal(edit.getSnapshot().busy, false);
      if (succeeds)
        assert.deepEqual(
          saved(profile).weightEntries,
          operation === "save" ? [{ ...first, kg: 78 }, second] : [second],
        );
      else assert.deepEqual(durable(), original);
      unsubscribe();
      assert.equal(await edit.save(), true);
      assert.equal(edit.getSnapshot().attempt, null);
    });
  }
}

test("stale previousDate and delete report real persistence errors while preserving the attempts", async () => {
  const { edit, external, durable, writes } = await ready();
  edit.begin("2026-10-08", first);
  edit.change("date", "2026-10-05");
  await external({ ...durable(), weightEntries: [second] });
  assert.equal(await edit.save(), false);
  assert.match(measurement(edit).error!, /measurement changed/);
  assert.equal(measurement(edit).draft.previousDate, first.date);
  edit.beginDelete(first);
  assert.equal(await edit.remove(), false);
  assert.match(edit.getSnapshot().attempt?.error ?? "", /measurement changed/);
  assert.equal(writes.length, 0);
  assert.deepEqual(durable().weightEntries, [second]);
});

test("shared Profile saving and failed refresh block commands; recovery keeps the raw editor", async () => {
  const { edit, profile, external, failReads, holdWrite, durable, writes } = await ready();
  edit.begin("2026-10-08", first);
  edit.change("weight", "77,5");
  const gate = holdWrite();
  const answerSave = profile.save({
    ...durable(),
    answers: { ...complete.answers, name: "Latest" },
  });
  assert.equal(edit.getSnapshot().busy, true);
  assert.equal(await edit.save(), false);
  assert.equal(edit.beginDelete(first), false);
  assert.equal(edit.cancel(), false);
  gate.resolve();
  assert.equal(await answerSave, true);
  failReads(true);
  await external(durable());
  assert.ok(profile.getSnapshot().refreshError);
  assert.equal(edit.begin("2026-10-09"), false);
  assert.equal(edit.beginDelete(first), false);
  assert.equal(await edit.save(), false);
  assert.equal(writes.length, 1);
  assert.equal(measurement(edit).draft.weight, "77,5");
  failReads(false);
  profile.retryLoad();
  await flush();
  assert.equal(await edit.save(), true);
  assert.equal(durable().answers.name, "Latest");
  assert.deepEqual(durable().weightEntries, [{ ...first, kg: 77.5 }, second]);
});

test("departure clears unsaved validation feedback and fields without retaining a navigation draft", async () => {
  const { edit, durable, writes } = await ready();
  const original = durable();
  edit.begin("invalid");
  edit.change("weight", "abc");
  await edit.save();
  edit.stop();
  edit.start();
  assert.equal(edit.getSnapshot().attempt, null);
  edit.begin("2026-10-08");
  assert.deepEqual(measurement(edit).draft, { date: "2026-10-08", weight: "" });
  assert.deepEqual(measurement(edit).fields, {});
  assert.equal(measurement(edit).error, null);
  assert.deepEqual(durable(), original);
  assert.equal(writes.length, 0);
});

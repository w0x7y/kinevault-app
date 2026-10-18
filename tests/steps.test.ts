import assert from "node:assert/strict";
import test from "node:test";
import { createManualStepsEdit } from "../src/steps/manual-editing.ts";
import { parseStepsLog } from "../src/steps/model.ts";
import {
  createStepsLogPersistence,
  stepsLogStorageKey,
  type StepsLogStorage,
} from "../src/steps/persistence.ts";
import { phoneStepsStatus, stepDayRange } from "../src/steps/summary.ts";

// The shared day amount log (parsing, replacing, clamped steps) is covered once in
// day-amount-log.test.ts. These tests pin Logged steps' key, messages and documents.
const date = "2026-10-01";
const otherDate = "2026-10-02";
const days = (entries: Record<string, number>) => JSON.stringify({ version: 1, days: entries });
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
async function ready(initial: string | null = null) {
  let raw = initial;
  const storage: StepsLogStorage = {
    async getItem(key) {
      assert.equal(key, stepsLogStorageKey);
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, stepsLogStorageKey);
      raw = value;
    },
  };
  const log = createStepsLogPersistence({ storage });
  log.start();
  await flush();
  return { log, storage, raw: () => raw };
}

test("saved steps logs load unchanged from the steps log key", async () => {
  assert.equal(stepsLogStorageKey, "kinevault-track.steps-log.v1");
  const saved = days({ [date]: 4200, [otherDate]: 0 });
  assert.deepEqual(parseStepsLog(saved), JSON.parse(saved));
  assert.deepEqual(parseStepsLog(null), { version: 1, days: {} });
  assert.throws(() => parseStepsLog(days({ [date]: 0.5 })));
  const { log } = await ready(saved);
  assert.deepEqual(log.getSnapshot().state, { kind: "ready", document: JSON.parse(saved) });
});

test("a steps edit fills from its date, steps by 500 without going below zero, and saves only that date", async () => {
  const { log, raw } = await ready(days({ [date]: 1000, [otherDate]: 300 }));
  const edit = createManualStepsEdit({ log, date });
  edit.start();
  assert.equal(edit.getSnapshot().draft, "1000");
  edit.adjust(500);
  assert.equal(edit.getSnapshot().draft, "1500");
  edit.change("200");
  edit.adjust(-500);
  assert.equal(edit.getSnapshot().draft, "0");
  edit.change("bad");
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().error, "Enter a whole number of steps, 0 or more.");
  edit.change("2500");
  assert.equal(await edit.save(), true);
  assert.equal(raw(), days({ [date]: 2500, [otherDate]: 300 }));
});

test("a failed steps save reports the steps message", async () => {
  const { log, storage } = await ready(days({ [date]: 250 }));
  storage.setItem = async () => {
    throw new Error("disk full");
  };
  const edit = createManualStepsEdit({ log, date });
  edit.start();
  edit.change("500");
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().error, "Couldn't save your steps. Try again.");
});

test("the phone's range runs from local midnight to now, or the whole of a past day; a future day has none", () => {
  const now = new Date(2026, 9, 1, 15, 30);
  const today = stepDayRange("2026-10-01", now)!;
  assert.deepEqual([today.start, today.end], [new Date(2026, 9, 1), now]);
  const past = stepDayRange("2026-09-30", now)!;
  assert.deepEqual([past.start, past.end], [new Date(2026, 8, 30), new Date(2026, 9, 1)]);
  assert.equal(stepDayRange("2026-10-02", now), null);
});

test("the steps sheet offers the fix that fits each phone access", () => {
  const status = (access: Parameters<typeof phoneStepsStatus>[0]["access"], state = "ready") => {
    const { status, counted, action } = phoneStepsStatus({
      access,
      state: state as "loading" | "ready" | "error",
      steps: 4200,
    });
    return [status, counted, action && `${action.label} -> ${action.kind}`];
  };
  assert.deepEqual(status("granted"), [`${(4200).toLocaleString()} steps`, true, null]);
  assert.deepEqual(status("granted", "loading"), ["Loading...", false, null]);
  assert.deepEqual(status(null, "loading"), ["Loading...", false, null]);
  assert.deepEqual(status("granted", "error"), [
    "Couldn't read phone steps.",
    false,
    "Retry phone steps -> retry",
  ]);
  assert.deepEqual(status("undetermined"), [
    "Not connected",
    false,
    "Connect phone steps -> connect",
  ]);
  assert.deepEqual(status("denied"), [
    "Step access is off.",
    false,
    "Open settings -> openSettings",
  ]);
  assert.deepEqual(status("install"), [
    "Install Health Connect to count steps.",
    false,
    "Get Health Connect -> openSettings",
  ]);
  assert.deepEqual(status("unavailable"), [
    "Phone step counting isn't available on this device.",
    false,
    null,
  ]);
});

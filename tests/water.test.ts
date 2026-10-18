import assert from "node:assert/strict";
import test from "node:test";
import { createManualWaterEdit } from "../src/water/manual-editing.ts";
import { parseWaterLog } from "../src/water/model.ts";
import {
  createWaterLogPersistence,
  waterLogStorageKey,
  type WaterLogStorage,
} from "../src/water/persistence.ts";

// The shared day amount log (parsing, replacing, clamped steps) is covered once in
// day-amount-log.test.ts. These tests pin Manual water's key, messages and documents.
const date = "2026-10-01";
const otherDate = "2026-10-02";
const days = (entries: Record<string, number>) => JSON.stringify({ version: 1, days: entries });
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
async function ready(initial: string | null = null) {
  let raw = initial;
  const storage: WaterLogStorage = {
    async getItem(key) {
      assert.equal(key, waterLogStorageKey);
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, waterLogStorageKey);
      raw = value;
    },
  };
  const log = createWaterLogPersistence({ storage });
  log.start();
  await flush();
  return { log, storage, raw: () => raw };
}
function editFor(log: ReturnType<typeof createWaterLogPersistence>, editDate = date) {
  const edit = createManualWaterEdit({ log, date: editDate });
  edit.start();
  return edit;
}

test("saved water logs load unchanged from the water log key", async () => {
  assert.equal(waterLogStorageKey, "kinevault-track.water-log.v1");
  const saved = days({ [date]: 12500, [otherDate]: 0 });
  assert.deepEqual(parseWaterLog(saved), JSON.parse(saved));
  assert.deepEqual(parseWaterLog(null), { version: 1, days: {} });
  assert.throws(() => parseWaterLog(days({ [date]: -1 })));
  const { log } = await ready(saved);
  assert.deepEqual(log.getSnapshot().state, { kind: "ready", document: JSON.parse(saved) });
});

test("a manual water edit fills from its captured date and saves only that date", async () => {
  const { log, raw } = await ready(days({ [date]: 1000, [otherDate]: 300 }));
  const edit = editFor(log);
  assert.equal(edit.getSnapshot().draft, "1000");
  assert.equal(editFor(log, "2026-10-03").getSnapshot().draft, "0");
  edit.change("0");
  assert.equal(await edit.save(), true);
  assert.equal(raw(), days({ [date]: 0, [otherDate]: 300 }));
});

test("manual water shows its own invalid and failed save messages", async () => {
  const { log, storage } = await ready(days({ [date]: 250 }));
  const edit = editFor(log);
  edit.change("1.5");
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().error, "Enter a whole number of milliliters, 0 or more.");
  storage.setItem = async () => {
    throw new Error("disk full");
  };
  edit.change("500");
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().error, "Couldn't save your water log. Try again.");
});

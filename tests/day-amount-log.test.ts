import assert from "node:assert/strict";
import test from "node:test";
import {
  createDayAmountEdit,
  createDayAmountLog,
  dayAmountFromText,
  parseDayAmounts,
} from "../src/persistence/day-amount-log.ts";
import type { DurableStorage } from "../src/persistence/durable-write.ts";

// A test log stands in for Manual water and Logged steps, which configure this module.
const key = "test-day-amounts";
const date = "2026-10-01";
const otherDate = "2026-10-02";
const invalid = "Enter a whole amount.";
const failure = "Couldn't save the amount.";
const days = (entries: Record<string, unknown>) => JSON.stringify({ version: 1, days: entries });
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
async function ready(initial: string | null = null) {
  let raw = initial;
  const calls: string[] = [];
  const storage: DurableStorage = {
    async getItem(name) {
      assert.equal(name, key);
      calls.push("read");
      return raw;
    },
    async setItem(name, value) {
      assert.equal(name, key);
      calls.push("write");
      raw = value;
    },
  };
  const log = createDayAmountLog({
    storage,
    key,
    parse: (raw) => parseDayAmounts(raw, "test log"),
    failure,
  });
  log.start();
  await flush();
  assert.equal(log.getSnapshot().state.kind, "ready");
  return { log, storage, calls, raw: () => raw };
}
function daysOf(log: Awaited<ReturnType<typeof ready>>["log"]) {
  const state = log.getSnapshot().state;
  if (state.kind !== "ready") throw new Error("Expected a loaded log");
  return state.document.days;
}
function editFor(log: Awaited<ReturnType<typeof ready>>["log"], editDate = date) {
  const edit = createDayAmountEdit({ log, date: editDate, invalid, failure });
  edit.start();
  return edit;
}

test("day amounts round trip, including zero, and unsupported or corrupt records fail", () => {
  const document = { version: 1, days: { [date]: 750, [otherDate]: 0 } };
  assert.deepEqual(parseDayAmounts(JSON.stringify(document), "test log"), document);
  assert.deepEqual(parseDayAmounts(null, "test log"), { version: 1, days: {} });
  for (const raw of [
    "",
    "corrupt",
    "null",
    "[]",
    JSON.stringify({ version: 2, days: {} }),
    JSON.stringify({ version: 1, days: [] }),
    days({ "2026-02-30": 250 }),
    ...[-1, 0.5, "250", null, Number.MAX_SAFE_INTEGER + 1].map((amount) =>
      days({ [date]: amount }),
    ),
    `{"version":1,"days":{"${date}":1e309}}`,
  ])
    assert.throws(() => parseDayAmounts(raw, "test log"));
});

test("amount text accepts whole numbers from zero to the safe maximum", () => {
  for (const [text, expected] of [
    ["0", 0],
    [" 750 ", 750],
    ["12500", 12500],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ] as const)
    assert.equal(dayAmountFromText(text), expected);
  for (const text of [
    "",
    " ",
    "-1",
    "+250",
    "1.5",
    "1e3",
    "1,000",
    "250ml",
    String(Number.MAX_SAFE_INTEGER + 1),
  ])
    assert.equal(dayAmountFromText(text), null);
});

test("invalid amounts and dates never reach storage", async () => {
  const { log, calls, raw } = await ready(days({ [date]: Number.MAX_SAFE_INTEGER }));
  const before = raw();
  for (const input of [
    { date: "2026-02-30", amount: 250 },
    ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity].map((amount) => ({ date, amount })),
  ])
    assert.equal(await log.set(input), false);
  assert.equal(log.getSnapshot().error, failure);
  assert.deepEqual(calls, ["read"]);
  assert.equal(raw(), before);
});

test("setting replaces only that date, zero clears it, and high totals survive a reload", async () => {
  const { log, raw } = await ready(days({ [date]: 12500, [otherDate]: 1000 }));
  assert.equal(await log.set({ date, amount: 12500 }), true);
  assert.deepEqual(daysOf(log), { [date]: 12500, [otherDate]: 1000 });
  assert.equal(await log.set({ date, amount: 750 }), true);
  assert.deepEqual(daysOf(log), { [date]: 750, [otherDate]: 1000 });
  assert.equal(await log.set({ date, amount: 0 }), true);
  assert.deepEqual(daysOf(log), { [date]: 0, [otherDate]: 1000 });
  assert.deepEqual(daysOf((await ready(raw())).log), { [date]: 0, [otherDate]: 1000 });
});

// The edit lifecycle (fill-once seeding, exclusion, feedback ownership, stale
// completions) is covered once in document-edit.test.ts.
test("an edit fills from its captured date and saves only that date", async () => {
  const { log, raw } = await ready(days({ [date]: 1000, [otherDate]: 300 }));
  const edit = editFor(log);
  assert.equal(edit.getSnapshot().draft, "1000");
  assert.equal(editFor(log, "2026-10-03").getSnapshot().draft, "0");
  edit.change(" 750 ");
  assert.equal(await edit.save(), true);
  assert.equal(raw(), days({ [date]: 750, [otherDate]: 300 }));
});

test("adjusting clamps at zero and the safe maximum without saving", async () => {
  const { log, raw } = await ready(days({ [date]: 500, [otherDate]: 300 }));
  const edit = editFor(log);
  edit.adjust(250);
  assert.equal(edit.getSnapshot().draft, "750");
  for (const text of ["", "100", "0", "bad", "1.5", "-5", "9".repeat(400)]) {
    edit.change(text);
    edit.adjust(-250);
    assert.equal(edit.getSnapshot().draft, "0");
  }
  edit.change("bad");
  edit.adjust(250);
  assert.equal(edit.getSnapshot().draft, "250");
  edit.change(String(Number.MAX_SAFE_INTEGER - 100));
  edit.adjust(250);
  assert.equal(edit.getSnapshot().draft, String(Number.MAX_SAFE_INTEGER));
  edit.adjust(-250);
  assert.equal(edit.getSnapshot().draft, String(Number.MAX_SAFE_INTEGER - 250));
  assert.equal(raw(), days({ [date]: 500, [otherDate]: 300 }));
});

test("invalid input shows its message until the draft changes and never writes", async () => {
  const { log, calls } = await ready();
  const edit = editFor(log);
  for (const text of ["", "-1", "1.5", "1e3", "250ml"]) {
    edit.change(text);
    assert.equal(await edit.save(), false);
    assert.equal(edit.getSnapshot().error, invalid);
    edit.adjust(250);
    assert.equal(edit.getSnapshot().error, null);
  }
  assert.deepEqual(calls, ["read"]);
});

test("a failed save keeps the draft and reports the log's failure", async () => {
  const { log, storage } = await ready(days({ [date]: 250 }));
  storage.setItem = async () => {
    throw new Error("disk full");
  };
  const edit = editFor(log);
  edit.change("500");
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().error, failure);
  assert.equal(edit.getSnapshot().draft, "500");
  assert.equal(daysOf(log)[date], 250);
});

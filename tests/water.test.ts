import assert from "node:assert/strict";
import test from "node:test";
import { createManualWaterEdit } from "../src/water/manual-editing.ts";
import {
  manualWaterAmountFromText,
  parseWaterLog,
  waterAmountFromText,
} from "../src/water/model.ts";
import {
  createWaterLogPersistence,
  waterLogStorageKey,
  type WaterLogStorage,
} from "../src/water/persistence.ts";

const date = "2026-10-01";
const otherDate = "2026-10-02";
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function memory(initial: string | null = null) {
  let raw = initial;
  const calls: string[] = [];
  const external = new Set<() => void>();
  const storage: WaterLogStorage = {
    async getItem(key) {
      assert.equal(key, waterLogStorageKey);
      calls.push("read");
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, waterLogStorageKey);
      calls.push("write");
      raw = value;
    },
    subscribeItem(key, listener) {
      assert.equal(key, waterLogStorageKey);
      external.add(listener);
      return () => {
        external.delete(listener);
      };
    },
  };
  // Another device replaces the durable log and notifies this one.
  async function replace(next: string) {
    raw = next;
    for (const listener of external) listener();
    await flush();
  }
  return { storage, calls, raw: () => raw, replace };
}
async function ready(initial: string | null = null) {
  const store = memory(initial);
  const log = createWaterLogPersistence({ storage: store.storage });
  log.start();
  await flush();
  assert.equal(log.getSnapshot().state.kind, "ready");
  return { ...store, log };
}
function documentOf(log: ReturnType<typeof createWaterLogPersistence>) {
  const state = log.getSnapshot().state;
  if (state.kind !== "ready") throw new Error("Expected a loaded water log");
  return state.document;
}

test("water totals round trip, including zero, and unsupported or corrupt records fail", () => {
  const document = { version: 1, days: { [date]: 750, [otherDate]: 0 } };
  assert.deepEqual(parseWaterLog(JSON.stringify(document)), document);
  assert.deepEqual(parseWaterLog(null), { version: 1, days: {} });
  for (const raw of [
    "",
    "corrupt",
    "null",
    "[]",
    JSON.stringify({ version: 2, days: {} }),
    JSON.stringify({ version: 1, days: [] }),
    JSON.stringify({ version: 1, days: { "2026-02-30": 250 } }),
    ...[-1, 0.5, "250", null, Number.MAX_SAFE_INTEGER + 1].map((total) =>
      JSON.stringify({ version: 1, days: { [date]: total } }),
    ),
    `{"version":1,"days":{"${date}":1e309}}`,
  ])
    assert.throws(() => parseWaterLog(raw));
});

test("water entry accepts only integer millilitres for Drinks between 1 and 10000", () => {
  for (const [text, ml] of [
    ["1", 1],
    ["250", 250],
    [" 500 ", 500],
    ["10000", 10000],
  ] as const)
    assert.equal(waterAmountFromText(text), ml);
  for (const text of [
    "",
    " ",
    "0",
    "-1",
    "1.5",
    "10001",
    "NaN",
    "Infinity",
    "1e3",
    "250ml",
    "1,000",
    "+250",
  ])
    assert.equal(waterAmountFromText(text), null);
});

test("manual water replaces only its captured date and persists across a restart", async () => {
  const { log, raw } = await ready();
  await log.set({ date, ml: 250 });
  await log.set({ date: otherDate, ml: 500 });
  await log.set({ date, ml: 100 });
  assert.deepEqual(documentOf(log).days, { [date]: 100, [otherDate]: 500 });
  const restored = await ready(raw());
  assert.deepEqual(documentOf(restored.log), documentOf(log));
});

test("a pending save keeps the previous total and rejects duplicate and competing-date writes", async () => {
  const { log, storage, calls, raw } = await ready();
  await log.set({ date, ml: 250 });
  const gate = deferred<void>();
  const write = storage.setItem;
  storage.setItem = async (key, value) => {
    await gate.promise;
    await write(key, value);
  };
  const input = { date, ml: 500 };
  const pending = log.set(input);
  input.date = otherDate;
  input.ml = 1000;
  assert.equal(log.getSnapshot().saving, true);
  assert.equal(documentOf(log).days[date], 250);
  assert.equal(parseWaterLog(raw()).days[date], 250);
  assert.equal(await log.set({ date, ml: 500 }), false);
  assert.equal(await log.set({ date: otherDate, ml: 500 }), false);
  log.retryLoad();
  assert.deepEqual(calls, ["read", "write"]);
  gate.resolve();
  assert.equal(await pending, true);
  assert.deepEqual(documentOf(log).days, { [date]: 500 });
  assert.equal(log.getSnapshot().saving, false);
});

test("failed writes preserve the previous total and retry the same amount exactly once", async () => {
  const { log, storage, raw } = await ready();
  await log.set({ date, ml: 250 });
  const before = raw();
  const write = storage.setItem;
  storage.setItem = async () => {
    throw new Error("disk full");
  };
  assert.equal(await log.set({ date, ml: 500 }), false);
  assert.equal(raw(), before);
  assert.equal(documentOf(log).days[date], 250);
  assert.equal(log.getSnapshot().error, "Couldn't save your water log. Try again.");
  assert.equal(log.getSnapshot().saving, false);
  storage.setItem = write;
  assert.equal(await log.set({ date, ml: 500 }), true);
  assert.equal(documentOf(log).days[date], 500);
  assert.equal(log.getSnapshot().error, null);
});

test("corruption and read failure block writes until retry loads valid durable data", async () => {
  for (const unreadable of ["corrupt", "read failure"]) {
    const store = memory(
      unreadable === "corrupt" ? unreadable : JSON.stringify({ version: 1, days: { [date]: 500 } }),
    );
    const read = store.storage.getItem;
    if (unreadable === "read failure")
      store.storage.getItem = async () => {
        throw new Error("unavailable");
      };
    const log = createWaterLogPersistence({ storage: store.storage });
    log.start();
    await flush();
    assert.equal(log.getSnapshot().state.kind, "error");
    const before = store.raw();
    assert.equal(await log.set({ date, ml: 250 }), false);
    assert.equal(store.raw(), before);
    assert.ok(!store.calls.includes("write"));
    store.storage.getItem = read;
    if (unreadable === "corrupt")
      await store.storage.setItem(
        waterLogStorageKey,
        JSON.stringify({ version: 1, days: { [date]: 500 } }),
      );
    log.retryLoad();
    await flush();
    assert.equal(await log.set({ date, ml: 250 }), true);
    assert.equal(documentOf(log).days[date], 250);
  }
});

test("invalid manual totals and dates never reach storage", async () => {
  const { log, calls, raw } = await ready(
    JSON.stringify({ version: 1, days: { [date]: Number.MAX_SAFE_INTEGER } }),
  );
  const before = raw();
  for (const input of [
    { date: "2026-02-30", ml: 250 },
    ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity].map((ml) => ({ date, ml })),
  ])
    assert.equal(await log.set(input), false);
  assert.deepEqual(calls, ["read"]);
  assert.equal(raw(), before);
});

test("manual water accepts zero and legacy daily totals above the per-drink limit", () => {
  for (const [text, expected] of [
    ["0", 0],
    [" 750 ", 750],
    ["12500", 12500],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ] as const)
    assert.equal(manualWaterAmountFromText(text), expected);
  for (const text of [
    "",
    " ",
    "-1",
    "1.5",
    "1e3",
    "1,000",
    "250ml",
    String(Number.MAX_SAFE_INTEGER + 1),
  ])
    assert.equal(manualWaterAmountFromText(text), null);
});

test("replacing manual water with zero clears only that date and preserves high legacy totals", async () => {
  const initial = JSON.stringify({ version: 1, days: { [date]: 12500, [otherDate]: 1000 } });
  const { log, raw } = await ready(initial);
  assert.equal(await log.set({ date, ml: 12500 }), true);
  assert.deepEqual(documentOf(log).days, { [date]: 12500, [otherDate]: 1000 });
  assert.equal(await log.set({ date, ml: 750 }), true);
  assert.deepEqual(documentOf(log).days, { [date]: 750, [otherDate]: 1000 });
  assert.equal(await log.set({ date, ml: 0 }), true);
  assert.deepEqual(documentOf(log).days, { [date]: 0, [otherDate]: 1000 });
  const restored = await ready(raw());
  assert.deepEqual(documentOf(restored.log).days, { [date]: 0, [otherDate]: 1000 });
});

const days = (entries: Record<string, number>) => JSON.stringify({ version: 1, days: entries });
function editFor(log: ReturnType<typeof createWaterLogPersistence>, editDate = date) {
  const edit = createManualWaterEdit({ log, date: editDate });
  edit.start();
  return edit;
}

// The edit lifecycle (fill-once seeding, exclusion, feedback ownership, stale
// completions) is covered once in document-edit.test.ts.
test("a manual water edit fills from its captured date and saves only that date", async () => {
  const { log, raw } = await ready(days({ [date]: 1000, [otherDate]: 300 }));
  const edit = editFor(log);
  assert.equal(edit.getSnapshot().draft, "1000");
  assert.equal(editFor(log, "2026-10-03").getSnapshot().draft, "0");
  edit.change(" 750 ");
  assert.equal(await edit.save(), true);
  assert.deepEqual(documentOf(log).days, { [date]: 750, [otherDate]: 300 });
  assert.equal(raw(), days({ [date]: 750, [otherDate]: 300 }));
});

test("manual water steps clamp at zero and the safe maximum, and zero clears only that date", async () => {
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
  edit.change("0");
  assert.equal(await edit.save(), true);
  assert.deepEqual(documentOf(log).days, { [date]: 0, [otherDate]: 300 });
});

test("invalid manual water shows its message until the draft changes and never writes", async () => {
  const { log, calls } = await ready();
  const edit = editFor(log);
  for (const text of ["", "-1", "1.5", "1e3", "250ml"]) {
    edit.change(text);
    assert.equal(await edit.save(), false);
    assert.equal(edit.getSnapshot().error, "Enter a whole number of millilitres, 0 or more.");
    edit.adjust(250);
    assert.equal(edit.getSnapshot().error, null);
  }
  assert.deepEqual(calls, ["read"]);
});

test("a failed manual water save reports the water log message", async () => {
  const { log, storage } = await ready(days({ [date]: 250 }));
  storage.setItem = async () => {
    throw new Error("disk full");
  };
  const edit = editFor(log);
  edit.change("500");
  assert.equal(await edit.save(), false);
  assert.equal(edit.getSnapshot().error, "Couldn't save your water log. Try again.");
  assert.equal(edit.getSnapshot().draft, "500");
  assert.equal(documentOf(log).days[date], 250);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createManualStepsEdit } from "../src/steps/manual-editing.ts";
import { parseStepsLog, stepsFromText } from "../src/steps/model.ts";
import {
  createStepsLogPersistence,
  stepsLogStorageKey,
  type StepsLogStorage,
} from "../src/steps/persistence.ts";
import { stepDayRange, stepsTile, type PhoneSteps } from "../src/steps/summary.ts";

const date = "2026-10-01";
const otherDate = "2026-10-02";
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
async function ready(initial: string | null = null) {
  let raw = initial;
  const calls: string[] = [];
  const storage: StepsLogStorage = {
    async getItem(key) {
      assert.equal(key, stepsLogStorageKey);
      calls.push("read");
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, stepsLogStorageKey);
      calls.push("write");
      raw = value;
    },
  };
  const log = createStepsLogPersistence({ storage });
  log.start();
  await flush();
  assert.equal(log.getSnapshot().state.kind, "ready");
  return { log, calls, raw: () => raw };
}
const days = (entries: Record<string, number>) => JSON.stringify({ version: 1, days: entries });

test("logged steps round trip, and unsupported or corrupt records fail", () => {
  const document = { version: 1, days: { [date]: 4200, [otherDate]: 0 } };
  assert.deepEqual(parseStepsLog(JSON.stringify(document)), document);
  assert.deepEqual(parseStepsLog(null), { version: 1, days: {} });
  for (const raw of [
    "corrupt",
    "[]",
    JSON.stringify({ version: 2, days: {} }),
    JSON.stringify({ version: 1, days: { "2026-02-30": 10 } }),
    ...[-1, 0.5, "10", null, Number.MAX_SAFE_INTEGER + 1].map((steps) =>
      days({ [date]: steps as number }),
    ),
  ])
    assert.throws(() => parseStepsLog(raw));
});

test("step text accepts whole numbers from zero to the safe maximum", () => {
  for (const [text, steps] of [
    ["0", 0],
    [" 1500 ", 1500],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ] as const)
    assert.equal(stepsFromText(text), steps);
  for (const text of [
    "",
    "-1",
    "1.5",
    "1e3",
    "1,000",
    "10 steps",
    String(Number.MAX_SAFE_INTEGER + 1),
  ])
    assert.equal(stepsFromText(text), null);
});

test("a steps edit fills from its date, steps by 500 without going below zero, and saves only that date", async () => {
  const { log, calls, raw } = await ready(days({ [date]: 1000, [otherDate]: 300 }));
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
  assert.deepEqual(calls, ["read"]);
  edit.change("2500");
  assert.equal(await edit.save(), true);
  assert.equal(raw(), days({ [date]: 2500, [otherDate]: 300 }));
});

test("the phone's range runs from local midnight to now, or the whole of a past day; a future day has none", () => {
  const now = new Date(2026, 9, 1, 15, 30);
  const today = stepDayRange("2026-10-01", now)!;
  assert.deepEqual([today.start, today.end], [new Date(2026, 9, 1), now]);
  const past = stepDayRange("2026-09-30", now)!;
  assert.deepEqual([past.start, past.end], [new Date(2026, 8, 30), new Date(2026, 9, 1)]);
  assert.equal(stepDayRange("2026-10-02", now), null);
});

test("the Steps tile adds logged steps to the phone's and says where the figure comes from", () => {
  const phone = (patch: Partial<PhoneSteps>): PhoneSteps => ({
    access: "granted",
    state: "ready",
    steps: 4000,
    ...patch,
  });
  const tile = (value: PhoneSteps, logged: number | null) => {
    const { value: total, captions } = stepsTile(date, value, logged);
    return { total, captions };
  };
  assert.deepEqual(tile(phone({}), 0), { total: 4000, captions: ["From your phone"] });
  assert.deepEqual(tile(phone({}), 1500), {
    total: 5500,
    captions: ["From your phone", `Includes ${(1500).toLocaleString()} logged`],
  });
  assert.deepEqual(tile(phone({ access: null, steps: null, state: "loading" }), 0), {
    total: null,
    captions: ["loading..."],
  });
  assert.deepEqual(tile(phone({ state: "loading", steps: null }), 200), {
    total: 200,
    captions: ["loading..."],
  });
  assert.deepEqual(tile(phone({ state: "error", steps: null }), 0), {
    total: null,
    captions: ["Couldn't read phone steps"],
  });
  for (const access of ["undetermined", "denied", "install"] as const)
    assert.deepEqual(tile(phone({ access, steps: null }), 0), {
      total: null,
      captions: ["Not connected"],
    });
  assert.deepEqual(tile(phone({ access: "unavailable", steps: null }), 0), {
    total: null,
    captions: ["Tap to log steps"],
  });
  assert.deepEqual(tile(phone({ access: "unavailable", steps: null }), 1500), {
    total: 1500,
    captions: ["Logged manually"],
  });
  assert.match(
    stepsTile(date, phone({}), null).label,
    /^Log steps\. .+ steps for .+\. From your phone\.$/,
  );
});

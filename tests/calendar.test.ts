import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  calendarWeeks,
  dayKey,
  millisecondsUntilTomorrow,
  parseDay,
} from "../src/calendar/dates.ts";

test("calendar keeps the current week in row three across a year boundary", () => {
  const weeks = calendarWeeks("2026-01-01");
  assert.equal(weeks.length, 5);
  assert.ok(weeks.every((week) => week.length === 7));
  assert.deepEqual(weeks[2], [
    "2025-12-28", "2025-12-29", "2025-12-30", "2025-12-31",
    "2026-01-01", "2026-01-02", "2026-01-03",
  ]);
  assert.equal(weeks[0]?.[0], "2025-12-14");
  assert.equal(weeks[4]?.[6], "2026-01-17");
});

test("calendar centers a Sunday today at the start of the middle row", () => {
  const weeks = calendarWeeks("2026-10-04");
  assert.equal(weeks[2]?.[0], "2026-10-04");
  assert.equal(weeks[0]?.[0], "2026-09-20");
  assert.equal(weeks[4]?.[6], "2026-10-24");
});

test("day arithmetic crosses month ends and leap years", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-29", 1), "2024-03-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.throws(() => parseDay("2026-02-30"), RangeError);
});

test("local keys and arithmetic preserve the local day across daylight saving", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    assert.equal(dayKey(new Date(2026, 2, 8, 23, 30)), "2026-03-08");
    assert.equal(addDays("2026-03-07", 1), "2026-03-08");
    assert.equal(addDays("2026-03-08", 1), "2026-03-09");
    assert.equal(addDays("2026-11-01", 1), "2026-11-02");
    assert.equal(millisecondsUntilTomorrow(new Date(2026, 2, 8)), 23 * 60 * 60 * 1000);
    assert.equal(millisecondsUntilTomorrow(new Date(2026, 10, 1)), 25 * 60 * 60 * 1000);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("local keys do not inherit the UTC date in a positive timezone", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "Asia/Jerusalem";
  try {
    assert.equal(dayKey(new Date(2026, 9, 1, 0, 30)), "2026-10-01");
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

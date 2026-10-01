import assert from "node:assert/strict";
import test from "node:test";
import * as lifecycle from "../src/calendar/selection.ts";

function controlledTime(initial: Date) {
  let now = initial;
  const timers = new Set<{ callback: () => void; delay: number }>();
  const wakes = new Set<() => void>();
  return {
    clock: {
      now: () => new Date(now),
      schedule(callback: () => void, delay: number) {
        const timer = { callback, delay };
        timers.add(timer);
        return () => { timers.delete(timer); };
      },
    },
    wakeEvents: {
      subscribe(callback: () => void) {
        wakes.add(callback);
        return () => { wakes.delete(callback); };
      },
    },
    timers,
    wakes,
    setNow(value: Date) { now = value; },
    wake() { for (const callback of [...wakes]) callback(); },
    nextTimer() {
      const timer = timers.values().next().value;
      assert.ok(timer, "expected a pending midnight refresh");
      return timer;
    },
    fireTimer() {
      const timer = this.nextTimer();
      timers.delete(timer);
      timer.callback();
    },
  };
}

test("construction is inert and midnight advances the observable Today selection", () => {
  assert.equal(typeof lifecycle.createSelectedDay, "function");
  const time = controlledTime(new Date(2026, 9, 1, 23, 59));
  const selection = lifecycle.createSelectedDay(time);
  const initial = selection.getSnapshot();
  const snapshots: unknown[] = [];
  selection.subscribe(() => { snapshots.push(selection.getSnapshot()); });
  assert.equal(selection.getSnapshot(), initial);
  assert.deepEqual(initial, { today: "2026-10-01", selectedDay: "2026-10-01" });
  assert.equal(time.timers.size, 0);
  assert.equal(time.wakes.size, 0);
  selection.start();
  assert.equal(time.timers.size, 1);
  assert.equal(time.wakes.size, 1);
  assert.equal(selection.getSnapshot(), initial);
  assert.equal(snapshots.length, 0);
  time.setNow(new Date(2026, 9, 2, 0, 0, 1));
  time.fireTimer();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-02", selectedDay: "2026-10-02" });
  assert.deepEqual(snapshots, [{ today: "2026-10-02", selectedDay: "2026-10-02" }]);
  assert.equal(time.timers.size, 1);
  selection.stop();
});

test("wake catches up across skipped days without publishing repeated refreshes", () => {
  const time = controlledTime(new Date(2026, 9, 1, 12));
  const selection = lifecycle.createSelectedDay(time);
  let published = 0;
  const unsubscribe = selection.subscribe(() => { published += 1; });
  selection.start();
  time.setNow(new Date(2026, 9, 5, 9));
  time.wake();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-05", selectedDay: "2026-10-05" });
  const snapshot = selection.getSnapshot();
  time.wake();
  time.wake();
  assert.equal(selection.getSnapshot(), snapshot);
  assert.equal(published, 1);
  assert.equal(time.timers.size, 1);
  unsubscribe();
  time.setNow(new Date(2026, 9, 6, 9));
  time.wake();
  assert.equal(published, 1);
  selection.stop();
});

test("selection rejects invalid days and publishes only when the selected day changes", () => {
  const time = controlledTime(new Date(2026, 9, 1, 12));
  const selection = lifecycle.createSelectedDay(time);
  assert.equal(typeof selection.selectDay, "function");
  let published = 0;
  selection.subscribe(() => { published += 1; });
  const initial = selection.getSnapshot();
  selection.selectDay("2026-10-01");
  assert.equal(selection.getSnapshot(), initial);
  for (const day of ["2026-02-30", "2026-10-1", "not a date"]) {
    assert.throws(() => selection.selectDay(day), RangeError);
  }
  assert.equal(selection.getSnapshot(), initial);
  assert.equal(published, 0);
  selection.selectDay("2026-09-30");
  const chosen = selection.getSnapshot();
  selection.selectDay("2026-09-30");
  assert.equal(selection.getSnapshot(), chosen);
  assert.equal(published, 1);
  assert.equal(time.timers.size, 0);
  assert.equal(time.wakes.size, 0);
});

test("historical selection survives waking several days later", () => {
  const time = controlledTime(new Date(2026, 9, 1, 12));
  const selection = lifecycle.createSelectedDay(time);
  selection.start();
  selection.selectDay("2026-09-30");
  time.setNow(new Date(2026, 9, 8, 12));
  time.wake();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-08", selectedDay: "2026-09-30" });
  selection.stop();
});

test("future selection remains deliberate when Today catches up and passes it", () => {
  const time = controlledTime(new Date(2026, 9, 1, 12));
  const selection = lifecycle.createSelectedDay(time);
  selection.start();
  selection.selectDay("2026-10-03");
  time.setNow(new Date(2026, 9, 3, 12));
  time.wake();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-03", selectedDay: "2026-10-03" });
  time.setNow(new Date(2026, 9, 4, 12));
  time.wake();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-04", selectedDay: "2026-10-03" });
  selection.selectDay("2026-10-04");
  time.setNow(new Date(2026, 9, 5, 12));
  time.wake();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-05", selectedDay: "2026-10-05" });
  selection.stop();
});

test("selecting the matching Today explicitly resumes following without publishing", () => {
  const time = controlledTime(new Date(2026, 9, 1, 12));
  const selection = lifecycle.createSelectedDay(time);
  selection.start();
  selection.selectDay("2026-10-03");
  time.setNow(new Date(2026, 9, 3, 12));
  time.wake();
  const snapshot = selection.getSnapshot();
  let published = 0;
  selection.subscribe(() => { published += 1; });
  selection.selectDay("2026-10-03");
  assert.equal(selection.getSnapshot(), snapshot);
  assert.equal(published, 0);
  time.setNow(new Date(2026, 9, 4, 12));
  time.wake();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-04", selectedDay: "2026-10-04" });
  selection.stop();
});

test("start stop start keeps one timer and wake listener and catches up immediately", () => {
  const time = controlledTime(new Date(2026, 9, 1, 12));
  const selection = lifecycle.createSelectedDay(time);
  let published = 0;
  selection.subscribe(() => { published += 1; });
  selection.start();
  selection.start();
  assert.equal(time.timers.size, 1);
  assert.equal(time.wakes.size, 1);
  const delayedTimer = time.nextTimer().callback;
  const delayedWake = [...time.wakes][0];
  assert.ok(delayedWake);
  selection.stop();
  selection.stop();
  assert.equal(time.timers.size, 0);
  assert.equal(time.wakes.size, 0);
  const stopped = selection.getSnapshot();
  time.setNow(new Date(2026, 9, 4, 12));
  delayedTimer();
  delayedWake();
  assert.equal(selection.getSnapshot(), stopped);
  assert.equal(time.timers.size, 0);
  selection.start();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-04", selectedDay: "2026-10-04" });
  assert.equal(published, 1);
  assert.equal(time.timers.size, 1);
  assert.equal(time.wakes.size, 1);
  time.setNow(new Date(2026, 9, 5, 12));
  const restarted = selection.getSnapshot();
  const currentTimer = time.nextTimer();
  delayedTimer();
  delayedWake();
  assert.equal(selection.getSnapshot(), restarted);
  assert.equal(time.nextTimer(), currentTimer);
  time.fireTimer();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-05", selectedDay: "2026-10-05" });
  assert.equal(published, 2);
  selection.stop();
  assert.equal(time.timers.size, 0);
  assert.equal(time.wakes.size, 0);
});

test("a midnight callback replaced by wake cannot publish or replace the current timer", () => {
  const time = controlledTime(new Date(2026, 9, 1, 12));
  const selection = lifecycle.createSelectedDay(time);
  selection.start();
  const delayedTimer = time.nextTimer().callback;
  time.wake();
  const currentTimer = time.nextTimer();
  const snapshot = selection.getSnapshot();
  time.setNow(new Date(2026, 9, 2, 12));
  delayedTimer();
  assert.equal(selection.getSnapshot(), snapshot);
  assert.equal(time.nextTimer(), currentTimer);
  time.fireTimer();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-02", selectedDay: "2026-10-02" });
  selection.stop();
});

test("a subscriber stopping during midnight publication leaves no acquired resources", () => {
  const time = controlledTime(new Date(2026, 9, 1, 12));
  const selection = lifecycle.createSelectedDay(time);
  selection.subscribe(() => { selection.stop(); });
  selection.start();
  time.setNow(new Date(2026, 9, 2, 12));
  time.fireTimer();
  assert.deepEqual(selection.getSnapshot(), { today: "2026-10-02", selectedDay: "2026-10-02" });
  assert.equal(time.timers.size, 0);
  assert.equal(time.wakes.size, 0);
});

test("the lifecycle schedules local midnight across short and long daylight-saving days", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    for (const { now, delay, nextDay } of [
      { now: new Date(2026, 2, 8), delay: 23 * 60 * 60 * 1000, nextDay: "2026-03-09" },
      { now: new Date(2026, 10, 1), delay: 25 * 60 * 60 * 1000, nextDay: "2026-11-02" },
    ]) {
      const time = controlledTime(now);
      const selection = lifecycle.createSelectedDay(time);
      selection.start();
      const timer = time.nextTimer();
      assert.ok(timer.delay >= delay && timer.delay < delay + 1000);
      time.setNow(new Date(now.getTime() + timer.delay));
      time.fireTimer();
      assert.deepEqual(selection.getSnapshot(), { today: nextDay, selectedDay: nextDay });
      assert.equal(time.timers.size, 1);
      selection.stop();
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

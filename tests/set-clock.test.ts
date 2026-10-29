import assert from "node:assert/strict";
import test from "node:test";
import { createSetClock } from "../src/exercise/set-clock.ts";

/** A Set clock on fake time; `tick` runs its ticker once, and `due` records `onDue` calls. */
function fixture() {
  const time = { now: 5_000_000 };
  let ticker: (() => void) | null = null;
  const due: string[] = [];
  const clock = createSetClock({
    now: () => time.now,
    every: (ms, tick) => {
      assert.equal(ms, 250);
      ticker = tick;
      return () => {
        ticker = null;
      };
    },
    onDue: (logId) => due.push(logId),
  });
  return { clock, time, due, tick: () => ticker?.(), ticking: () => ticker !== null };
}

test("a stopwatch counts up with the ticker and never runs out", () => {
  const f = fixture();
  assert.equal(f.clock.toggle("log", "row", "open", null), null);
  assert.deepEqual(f.clock.shown("log"), {
    rowId: "row",
    setId: "open",
    seconds: 0,
    countdown: false,
  });
  f.time.now += 42_500;
  assert.equal(f.clock.shown("log")?.seconds, 0, "the shown time moves with the ticker");
  f.tick();
  assert.equal(f.clock.shown("log")?.seconds, 42);
  f.time.now += 600_000;
  f.tick();
  assert.equal(f.clock.shown("log")?.seconds, 642);
  assert.deepEqual(f.due, []);
});

test("a countdown counts down and goes to onDue at zero on each tick until settled", () => {
  const f = fixture();
  f.clock.toggle("log", "row", "hold", 30);
  assert.deepEqual(f.clock.shown("log"), {
    rowId: "row",
    setId: "hold",
    seconds: 30,
    countdown: true,
  });
  f.time.now += 10_000;
  f.tick();
  assert.equal(f.clock.shown("log")?.seconds, 20);
  assert.deepEqual(f.due, []);
  f.time.now += 25_000;
  f.tick();
  assert.deepEqual(f.due, ["log"]);
  assert.equal(f.clock.shown("log")?.seconds, 0);
  // A busy edit leaves it running, so the next tick asks again.
  f.tick();
  assert.deepEqual(f.due, ["log", "log"]);
  assert.deepEqual(f.clock.settle("log"), { rowId: "row", setId: "hold", seconds: 30 });
  assert.equal(f.ticking(), false);
});

test("toggling the running set stops it and returns its seconds", () => {
  const f = fixture();
  f.clock.toggle("log", "row", "open", null);
  f.time.now += 15_900;
  assert.deepEqual(f.clock.toggle("log", "row", "open", null), {
    rowId: "row",
    setId: "open",
    seconds: 15,
  });
  assert.equal(f.clock.shown("log"), null);
  assert.equal(f.clock.settle("log"), null);
});

test("toggling another set in the same log settles the first", () => {
  const f = fixture();
  f.clock.toggle("log", "row", "open", null);
  f.time.now += 15_000;
  assert.deepEqual(f.clock.toggle("log", "row", "hold", 30), {
    rowId: "row",
    setId: "open",
    seconds: 15,
  });
  assert.deepEqual(f.clock.shown("log"), {
    rowId: "row",
    setId: "hold",
    seconds: 30,
    countdown: true,
  });
});

test("clocks in different logs are independent", () => {
  const f = fixture();
  f.clock.toggle("first", "row", "open", null);
  f.time.now += 5_000;
  assert.equal(f.clock.toggle("second", "row", "open", null), null, "the first keeps running");
  f.time.now += 10_000;
  f.tick();
  assert.equal(f.clock.shown("first")?.seconds, 15);
  assert.equal(f.clock.shown("second")?.seconds, 10);
  assert.deepEqual(f.clock.settle("first"), { rowId: "row", setId: "open", seconds: 15 });
  assert.equal(f.clock.shown("second")?.seconds, 10);
  assert.equal(f.ticking(), true, "the ticker runs while any clock does");
});

test("the ticker stops on detach and with no clocks, and restarts on attach", () => {
  const f = fixture();
  assert.equal(f.ticking(), false);
  f.clock.toggle("log", "row", "open", null);
  assert.equal(f.ticking(), true);
  f.clock.detach();
  assert.equal(f.ticking(), false);
  f.time.now += 42_000;
  f.clock.attach();
  assert.equal(f.ticking(), true);
  f.tick();
  assert.equal(f.clock.shown("log")?.seconds, 42, "the clock kept running while detached");
  f.clock.settle("log");
  assert.equal(f.ticking(), false);
  f.clock.detach();
  f.clock.toggle("log", "row", "open", null);
  assert.equal(f.ticking(), false, "a clock started while detached waits for attach");
  f.clock.attach();
  assert.equal(f.ticking(), true);
});

test("forget drops a clock without logging it", () => {
  const f = fixture();
  f.clock.toggle("log", "row", "hold", 30);
  f.time.now += 40_000;
  f.clock.forget("log");
  assert.equal(f.clock.shown("log"), null);
  assert.equal(f.clock.settle("log"), null);
  assert.equal(f.ticking(), false);
  assert.deepEqual(f.due, []);
});

test("subscribers are told only when the shown seconds move", () => {
  const f = fixture();
  let calls = 0;
  const unsubscribe = f.clock.subscribe(() => calls++);
  f.clock.toggle("log", "row", "open", null);
  assert.equal(calls, 0, "starting tells no one");
  const shown = f.clock.shown("log");
  f.time.now += 999;
  f.tick();
  assert.equal(calls, 0);
  assert.equal(f.clock.shown("log"), shown, "the same object until it moves");
  f.time.now += 1;
  f.tick();
  f.tick();
  assert.equal(calls, 1);
  assert.notEqual(f.clock.shown("log"), shown);
  f.clock.settle("log");
  assert.equal(calls, 1, "settling tells no one");
  unsubscribe();
  f.clock.toggle("log", "row", "open", null);
  f.time.now += 1_000;
  f.tick();
  assert.equal(calls, 1);
});

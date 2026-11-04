import assert from "node:assert/strict";
import test from "node:test";
import { fakeTime } from "./helpers/fake-time.ts";

test("one timer runs while any tick is held, and each tick hears it", () => {
  const f = fakeTime();
  const ticker = f.ticker();
  assert.equal(f.ticking(), false);
  const heard: string[] = [];
  const releaseClock = ticker.hold(() => heard.push("clock"));
  const releaseRest = ticker.hold(() => heard.push("rest"));
  assert.equal(f.ticking(), true);
  f.tick();
  assert.deepEqual(heard, ["clock", "rest"]);
  releaseClock();
  assert.equal(f.ticking(), true, "the rest still holds it");
  f.tick();
  assert.deepEqual(heard, ["clock", "rest", "rest"]);
  releaseRest();
  assert.equal(f.ticking(), false);
  assert.equal(ticker.now(), f.time.now);
});

test("the timer stops on detach and restarts on attach while a tick is held", () => {
  const f = fakeTime();
  const ticker = f.ticker();
  ticker.detach();
  const release = ticker.hold(() => {});
  assert.equal(f.ticking(), false, "a tick held while detached waits for attach");
  ticker.attach();
  assert.equal(f.ticking(), true);
  ticker.detach();
  assert.equal(f.ticking(), false);
  ticker.attach();
  release();
  assert.equal(f.ticking(), false);
  ticker.attach();
  assert.equal(f.ticking(), false, "attaching without a held tick starts nothing");
});

test("a tick released while ticking doesn't stop the others from hearing that tick", () => {
  const f = fakeTime();
  const ticker = f.ticker();
  const heard: string[] = [];
  let releaseSecond = () => {};
  ticker.hold(() => {
    heard.push("first");
    releaseSecond();
  });
  releaseSecond = ticker.hold(() => heard.push("second"));
  f.tick();
  assert.deepEqual(heard, ["first", "second"]);
  f.tick();
  assert.deepEqual(heard, ["first", "second", "first"]);
});

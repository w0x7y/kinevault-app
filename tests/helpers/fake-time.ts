import assert from "node:assert/strict";
import { createTicker } from "../../src/exercise/ticker.ts";

/**
 * Fake time for the ticker behind Set clocks and the Rest timer: `time.now` is the clock,
 * `options` builds a ticker on it, `tick` runs its 250 ms timer once and `ticking` says whether
 * that timer runs.
 */
export function fakeTime(start = 5_000_000) {
  const time = { now: start };
  let timer: (() => void) | null = null;
  const options = {
    now: () => time.now,
    every: (ms: number, tick: () => void) => {
      assert.equal(ms, 250);
      timer = tick;
      return () => {
        timer = null;
      };
    },
  };
  return {
    time,
    options,
    ticker: () => createTicker(options),
    tick: () => timer?.(),
    ticking: () => timer !== null,
  };
}

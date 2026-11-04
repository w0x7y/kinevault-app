import type { Ticker } from "./ticker.ts";

/** Rest lengths change by this many seconds, from 15 seconds to 10 minutes. */
export const restStep = 15;
export const shortestRest = 15;
export const longestRest = 600;
export const defaultRestSeconds = 90;

/** Where the chosen rest length is kept between launches. */
export type RestLengthStorage = {
  load(): Promise<string | null>;
  save(value: string): Promise<void>;
};
export type RestSnapshot = {
  /** The chosen rest length in seconds. */
  length: number;
  /** Whole seconds left of the running rest; null when none runs. */
  left: number | null;
};

/** A saved rest length: whole seconds in steps of 15 from 15 to 600, or null. */
export function parseRestLength(value: string | null): number | null {
  const seconds = Number(value);
  return value !== null &&
    /^\d+$/.test(value) &&
    seconds >= shortestRest &&
    seconds <= longestRest &&
    seconds % restStep === 0
    ? seconds
    : null;
}

/**
 * The Rest timer: a countdown of the chosen length between sets, which calls `onEnd` (to buzz)
 * when it runs out. It holds a tick of `ticker` while a rest runs. The length starts at 90
 * seconds and follows `storage` once loaded, unless changed first; each change is saved.
 */
export function createRestTimer({
  ticker,
  onEnd,
  storage,
}: {
  ticker: Pick<Ticker, "now" | "hold">;
  onEnd: () => void;
  storage?: RestLengthStorage;
}) {
  const { now } = ticker;
  const listeners = new Set<() => void>();
  let length = defaultRestSeconds,
    endsAt: number | null = null,
    changed = false,
    release: (() => void) | null = null,
    snapshot: RestSnapshot = { length, left: null };
  function publish() {
    const left = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now()) / 1000));
    if (snapshot.length === length && snapshot.left === left) return;
    snapshot = { length, left };
    for (const listener of listeners) listener();
  }
  function syncTicker() {
    if (endsAt !== null && !release) release = ticker.hold(tick);
    else if (endsAt === null && release) {
      release();
      release = null;
    }
  }
  function end() {
    endsAt = null;
    syncTicker();
    publish();
  }
  function tick() {
    if (endsAt === null) return;
    if (now() < endsAt) return publish();
    end();
    onEnd();
  }
  void storage
    ?.load()
    .then((value) => {
      const saved = parseRestLength(value);
      if (saved !== null && !changed) {
        length = saved;
        publish();
      }
    })
    // An unreadable length keeps the default; the timer still works.
    .catch(() => {});
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Starts a rest of the chosen length, or stops the running one early. */
    toggle() {
      if (endsAt !== null) return end();
      endsAt = now() + length * 1000;
      syncTicker();
      publish();
    },
    /** Stops a running rest without `onEnd`, e.g. when the workout ends. */
    stop() {
      if (endsAt !== null) end();
    },
    /**
     * Changes the rest length by `delta` seconds within its range, and a running rest by as much;
     * shortening it past the time already rested ends it quietly.
     */
    adjust(delta: number) {
      const next = Math.min(longestRest, Math.max(shortestRest, length + delta));
      if (next === length) return;
      if (endsAt !== null) endsAt += (next - length) * 1000;
      length = next;
      changed = true;
      // shortcut: a failed save keeps the length for this run only; it's a convenience setting.
      void storage?.save(String(length)).catch(() => {});
      if (endsAt !== null && endsAt <= now()) end();
      else publish();
    },
  };
}

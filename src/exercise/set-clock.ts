import type { Ticker } from "./ticker.ts";

/**
 * A Timed set's running clock: a stopwatch from `startedAt`, or with a `target` a countdown from
 * the seconds the set held when it started.
 */
type SetClock = { rowId: string; setId: string; startedAt: number; target: number | null };
/** A running clock as its set shows it: seconds counted up, or left of a countdown. */
export type ShownClock = { rowId: string; setId: string; seconds: number; countdown: boolean };
/** A stopped clock and the whole seconds it ran, for its set to log. */
export type StoppedClock = { rowId: string; setId: string; seconds: number };
/**
 * The Set clocks of Workout edits, one per Workout log, so a clock survives the set table
 * unmounting and keeps running while its page is away. They hold a tick of `ticker` while any
 * clock runs. Each second they move the shown clocks on and tell subscribers, and hand a
 * countdown that ran out to `onDue` on each tick until the edit settles it.
 * Starting, settling and forgetting notify no one: the edit publishes those changes itself.
 */
export function createSetClock({
  ticker,
  onDue,
}: {
  ticker: Pick<Ticker, "now" | "hold">;
  onDue: (logId: string) => void;
}) {
  const { now } = ticker;
  const running = new Map<string, { clock: SetClock; shown: ShownClock }>(),
    listeners = new Set<() => void>();
  let release: (() => void) | null = null;
  function syncTicker() {
    if (running.size > 0 && !release) release = ticker.hold(tick);
    else if (running.size === 0 && release) {
      release();
      release = null;
    }
  }
  function clockSeconds(clock: SetClock, at = now()) {
    const elapsed = Math.max(0, Math.floor((at - clock.startedAt) / 1000));
    return clock.target === null ? elapsed : Math.min(elapsed, clock.target);
  }
  function shownAt(clock: SetClock, at: number): ShownClock {
    const seconds = clockSeconds(clock, at);
    return {
      rowId: clock.rowId,
      setId: clock.setId,
      seconds: clock.target === null ? seconds : clock.target - seconds,
      countdown: clock.target !== null,
    };
  }
  function tick() {
    const at = now();
    let moved = false;
    for (const [logId, value] of running) {
      const { clock } = value;
      if (clock.target !== null && clockSeconds(clock, at) >= clock.target) onDue(logId);
      // A countdown waiting out a busy edit shows its time like any other clock.
      if (running.get(logId) !== value) continue;
      const shown = shownAt(clock, at);
      if (shown.seconds !== value.shown.seconds) {
        value.shown = shown;
        moved = true;
      }
    }
    if (moved) for (const listener of listeners) listener();
  }
  /** Drops log `logId`'s clock without logging it, e.g. when its set, row or edit goes. */
  function forget(logId: string) {
    running.delete(logId);
    syncTicker();
  }
  /** Stops log `logId`'s clock; returns it with the seconds it ran, or null when none runs. */
  function settle(logId: string): StoppedClock | null {
    const value = running.get(logId);
    if (!value) return null;
    const { rowId, setId } = value.clock;
    const stopped = { rowId, setId, seconds: clockSeconds(value.clock) };
    forget(logId);
    return stopped;
  }
  return {
    /** Log `logId`'s running clock as of the last tick, or null; the same object until it moves. */
    shown: (logId: string) => running.get(logId)?.shown ?? null,
    /** Called when a shown clock moves on, about once a second. */
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /**
     * Settles log `logId`'s running clock and returns it, since a log runs one clock at a time.
     * Unless that was this set's, starts this set's clock: a countdown from `target` seconds, or a
     * stopwatch without one.
     */
    toggle(logId: string, rowId: string, setId: string, target: number | null) {
      const stopped = settle(logId);
      if (stopped?.setId !== setId) {
        const clock = { rowId, setId, startedAt: now(), target };
        running.set(logId, { clock, shown: shownAt(clock, clock.startedAt) });
        syncTicker();
      }
      return stopped;
    },
    settle,
    forget,
  };
}

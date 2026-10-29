/**
 * A Timed set's running clock: a stopwatch from `startedAt`, or with a `target` a countdown from
 * the seconds the set held when it started.
 */
type SetClock = { rowId: string; setId: string; startedAt: number; target: number | null };
/** A running clock as its set shows it: seconds counted up, or left of a countdown. */
export type ShownClock = { rowId: string; setId: string; seconds: number; countdown: boolean };
/** A stopped clock and the whole seconds it ran, for its set to log. */
export type StoppedClock = { rowId: string; setId: string; seconds: number };
/** What set clocks read and how they tick; the device's clock and timers by default. */
export type SetClockTime = {
  now?: () => number;
  /** Calls `tick` every `ms` until the returned stop. */
  every?: (ms: number, tick: () => void) => () => void;
};
const deviceTimer = (ms: number, tick: () => void) => {
  const timer = setInterval(tick, ms);
  return () => clearInterval(timer);
};

/**
 * The Set clocks of Workout edits, one per Workout log, so a clock survives the set table
 * unmounting and keeps running while its page is away. One ticker runs while any clock does and
 * the tab is attached. Each second it moves the shown clocks on and tells subscribers, and hands a
 * countdown that ran out to `onDue` on each tick until the edit settles it.
 * Starting, settling and forgetting notify no one: the edit publishes those changes itself.
 */
export function createSetClock({
  now = Date.now,
  every = deviceTimer,
  onDue,
}: SetClockTime & { onDue: (logId: string) => void }) {
  const running = new Map<string, { clock: SetClock; shown: ShownClock }>(),
    listeners = new Set<() => void>();
  let attached = true,
    stopTicker: (() => void) | null = null;
  function syncTicker() {
    const ticking = attached && running.size > 0;
    if (ticking && !stopTicker) stopTicker = every(250, tick);
    else if (!ticking && stopTicker) {
      stopTicker();
      stopTicker = null;
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
    /** The ticker runs only while the tab is attached; clocks keep their start times meanwhile. */
    attach() {
      attached = true;
      syncTicker();
    },
    detach() {
      attached = false;
      syncTicker();
    },
  };
}

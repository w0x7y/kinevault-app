/** What the ticker reads and how it ticks; the device's clock and timers by default. */
export type TickerTime = {
  now?: () => number;
  /** Calls `tick` every `ms` until the returned stop. */
  every?: (ms: number, tick: () => void) => () => void;
};
const deviceTimer = (ms: number, tick: () => void) => {
  const timer = setInterval(tick, ms);
  return () => clearInterval(timer);
};

/**
 * The clock and the one 250 ms timer behind the Set clocks and the Rest timer. The timer runs only
 * while some caller holds a tick and the tab is attached; detaching keeps the held ticks for when
 * it attaches again.
 */
export function createTicker({ now = Date.now, every = deviceTimer }: TickerTime = {}) {
  const ticks = new Set<() => void>();
  let attached = true,
    stop: (() => void) | null = null;
  function sync() {
    const ticking = attached && ticks.size > 0;
    if (ticking && !stop) stop = every(250, () => [...ticks].forEach((tick) => tick()));
    else if (!ticking && stop) {
      stop();
      stop = null;
    }
  }
  return {
    now,
    /** Calls `tick` on each tick until the returned release. */
    hold(tick: () => void) {
      ticks.add(tick);
      sync();
      return () => {
        ticks.delete(tick);
        sync();
      };
    },
    attach() {
      attached = true;
      sync();
    },
    detach() {
      attached = false;
      sync();
    },
  };
}
export type Ticker = ReturnType<typeof createTicker>;

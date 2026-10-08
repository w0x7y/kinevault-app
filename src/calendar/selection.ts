import { dayKey, millisecondsUntilTomorrow, parseDay } from "./dates.ts";

export type SelectedDaySnapshot = Readonly<{
  today: string;
  selectedDay: string;
}>;

type SelectedDayClock = {
  now: () => Date;
  schedule: (callback: () => void, delay: number) => () => void;
};

export type SelectedDayWakeEvents = {
  subscribe: (callback: () => void) => () => void;
};

type ActiveRun = {
  cancelTimer: () => void;
  cancelWake: () => void;
  timer: object | null;
};

/** Construction reads the local day; only start acquires timers and wake listeners. */
export function createSelectedDay({
  clock,
  wakeEvents,
}: {
  clock: SelectedDayClock;
  wakeEvents: SelectedDayWakeEvents;
}) {
  const today = dayKey(clock.now());
  let snapshot: SelectedDaySnapshot = { today, selectedDay: today };
  // null follows Today; a chosen day remains deliberate even when Today reaches it.
  let chosenDay: string | null = null;
  const listeners = new Set<() => void>();
  let activeRun: ActiveRun | null = null;

  function publish(next: SelectedDaySnapshot) {
    if (next.today === snapshot.today && next.selectedDay === snapshot.selectedDay) return;
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function refresh(run: ActiveRun) {
    if (activeRun !== run) return;
    run.timer = null;
    run.cancelTimer();
    const now = clock.now();
    const today = dayKey(now);
    publish({ today, selectedDay: chosenDay ?? today });
    // A subscriber may stop or restart the lifecycle while observing the new day.
    if (activeRun !== run) return;
    const timer = {};
    run.timer = timer;
    run.cancelTimer = clock.schedule(
      () => {
        if (activeRun === run && run.timer === timer) refresh(run);
      },
      millisecondsUntilTomorrow(now) + 100,
    );
  }

  return {
    getSnapshot: () => snapshot,
    selectDay(day: string) {
      parseDay(day);
      chosenDay = day === snapshot.today ? null : day;
      publish({ today: snapshot.today, selectedDay: day });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (activeRun !== null) return;
      const run: ActiveRun = { cancelTimer: () => {}, cancelWake: () => {}, timer: null };
      activeRun = run;
      run.cancelWake = wakeEvents.subscribe(() => {
        refresh(run);
      });
      refresh(run);
    },
    stop() {
      const run = activeRun;
      if (run === null) return;
      activeRun = null;
      run.timer = null;
      run.cancelTimer();
      run.cancelWake();
    },
  };
}

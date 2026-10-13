import type { Reminder } from "./model.ts";
import type { ReminderPermission } from "./notifications.ts";
import type { createReminderPersistence, ReminderSnapshot } from "./persistence.ts";

type PermissionState =
  { kind: "checking" } | { kind: "known"; permission: ReminderPermission } | { kind: "error" };

export type ReminderControllerSnapshot = ReminderSnapshot & {
  permission: ReminderPermission | null;
  /** A permission prompt is open or being checked. */
  asking: boolean;
  /** Explains why the latest attempt to turn a reminder on left it off. */
  notice: string | null;
  scheduleFailed: boolean;
};

type ReminderControllerPorts = {
  store: ReturnType<typeof createReminderPersistence>;
  scheduler: {
    /** Resolves null when a newer request replaced this one. */
    reconcile(
      reminders: readonly Reminder[],
      options: { dismissDelivered?: boolean },
    ): Promise<boolean | null>;
  };
  /** Each resolves null when this build can't deliver local notifications. */
  permissions: {
    get(): Promise<ReminderPermission | null>;
    request(): Promise<ReminderPermission | null>;
  };
  signedIn: boolean;
  /** False on web and in builds without local notification support. */
  supported: boolean;
};

const stayedOff = "Notifications aren't allowed, so this reminder stays off.";
const savedOff = "Notifications aren't allowed, so this reminder is saved but off.";

/**
 * One account scope's reminders on this device. A signed-out scope cancels
 * every reminder notification and clears delivered ones; a signed-in scope
 * schedules its saved reminders while notifications are allowed.
 */
export function createReminderController(ports: ReminderControllerPorts) {
  const { store, scheduler, permissions, signedIn, supported } = ports;
  let permissionState: PermissionState = { kind: "checking" };
  let own = { asking: false, notice: null as string | null, scheduleFailed: false };
  let snapshot = build();
  const listeners = new Set<() => void>();
  let running = false;
  let starting = false;
  let lifecycle = 0;
  let detachStore: (() => void) | undefined;
  // Schedule inputs, compared by identity like effect dependencies.
  let inputs: readonly unknown[] | null = null;
  let scheduleTicket = 0;

  function build(): ReminderControllerSnapshot {
    return {
      ...store.getSnapshot(),
      permission: permissionState.kind === "known" ? permissionState.permission : null,
      ...own,
    };
  }
  function publish(patch: Partial<typeof own> = {}) {
    own = { ...own, ...patch };
    snapshot = build();
    listeners.forEach((listener) => listener());
  }
  function setPermission(next: PermissionState) {
    permissionState = next;
    publish();
    schedule();
  }

  // Foreground returns and retries pass `repeat` to repair drift.
  function schedule(repeat = false) {
    if (!running || !supported) return;
    const state = store.getSnapshot().state;
    const reminders = state.kind === "ready" ? state.document.reminders : null;
    const permissionKnown = permissionState.kind === "known";
    const granted = permissionState.kind === "known" && permissionState.permission.granted;
    const previous = inputs;
    const next = [reminders, permissionKnown, granted];
    if (!repeat && previous && next.every((value, index) => Object.is(value, previous[index])))
      return;
    inputs = next;
    let desired: readonly Reminder[];
    if (!signedIn) desired = [];
    // An unreadable record or permission keeps the current device schedule,
    // and the result of a pass already running.
    else if (!reminders || !permissionKnown) return;
    else desired = granted ? reminders : [];
    const ticket = ++scheduleTicket;
    void scheduler.reconcile(desired, { dismissDelivered: !signedIn }).then((result) => {
      if (running && ticket === scheduleTicket && result !== null)
        publish({ scheduleFailed: !result });
    });
  }

  function checkPermission() {
    if (!running || !supported) return;
    const current = lifecycle;
    const settle = (next: PermissionState) => {
      if (running && current === lifecycle) setPermission(next);
    };
    void permissions
      .get()
      .then((permission) => settle(permission ? { kind: "known", permission } : { kind: "error" }))
      .catch(() => settle({ kind: "error" }));
  }

  async function ensurePermission(): Promise<boolean> {
    if (running) publish({ asking: true });
    try {
      let next = await permissions.get();
      if (next && !next.granted && next.canAskAgain) next = await permissions.request();
      if (next && running) setPermission({ kind: "known", permission: next });
      return next?.granted ?? false;
    } catch {
      return false;
    } finally {
      // A prompt that settles while stopped must not leave a restart busy.
      if (running) publish({ asking: false });
      else own = { ...own, asking: false };
    }
  }

  function showNotice(notice: string | null) {
    if (running) publish({ notice });
  }

  return {
    supported,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (running) return;
      running = true;
      lifecycle++;
      starting = true;
      detachStore = store.subscribe(() => {
        if (!running) return;
        publish();
        if (!starting) schedule();
      });
      store.start();
      starting = false;
      publish();
      checkPermission();
      schedule(true);
    },
    stop() {
      if (!running) return;
      running = false;
      lifecycle++;
      scheduleTicket++;
      inputs = null;
      detachStore?.();
      detachStore = undefined;
      store.stop();
    },
    /** Re-checks permission and repairs the device schedule after the app returns. */
    foreground() {
      checkPermission();
      schedule(true);
    },
    retrySchedule() {
      schedule(true);
    },
    async setEnabled(id: string, enabled: boolean): Promise<boolean> {
      showNotice(null);
      if (enabled && !(await ensurePermission())) {
        showNotice(stayedOff);
        return false;
      }
      return store.setEnabled(id, enabled);
    },
    /** Saves an edit, or adds a reminder that asks to be on when `enabled`. */
    async saveReminder(reminder: Reminder): Promise<boolean> {
      showNotice(null);
      if (!reminder.enabled) return store.saveReminder(reminder);
      const allowed = await ensurePermission();
      if (!allowed) showNotice(savedOff);
      return store.saveReminder({ ...reminder, enabled: allowed });
    },
    async requestPermission(): Promise<boolean> {
      showNotice(null);
      return ensurePermission();
    },
    deleteReminder: store.deleteReminder,
    retryLoad: store.retryLoad,
    reset: store.reset,
  };
}

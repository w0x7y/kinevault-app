import {
  reminderCopy,
  reminderKinds,
  reminderRoute,
  type Reminder,
  type ReminderKind,
  type ReminderRoute,
  type Weekday,
} from "./model.ts";

export const reminderChannelId = "reminders";
export const reminderSource = "kinevault-track.reminder";
const identifierPrefix = `${reminderSource}.`;

export type ReminderTrigger =
  | { type: "daily"; hour: number; minute: number }
  /** Expo weekly triggers number weekdays 1 (Sunday) through 7 (Saturday). */
  | { type: "weekly"; weekday: number; hour: number; minute: number };
export type ReminderNotificationData = {
  source: typeof reminderSource;
  reminderId: string;
  kind: ReminderKind;
  /** Lets reconcile keep an unchanged scheduled notification in place. */
  fingerprint: string;
};
export type DesiredNotification = {
  identifier: string;
  title: string;
  body: string | null;
  data: ReminderNotificationData;
  trigger: ReminderTrigger;
};
export type ScheduledNotification = { identifier: string; data: unknown };

export function expoWeekday(day: Weekday): number {
  return (day % 7) + 1;
}

function fingerprint(title: string, body: string | null, trigger: ReminderTrigger): string {
  return JSON.stringify([title, body, trigger]);
}

/** The notifications that saved reminders should have scheduled on this device. */
export function desiredSchedule(reminders: readonly Reminder[]): DesiredNotification[] {
  const desired: DesiredNotification[] = [];
  for (const reminder of reminders) {
    if (!reminder.enabled) continue;
    const { title, body } = reminderCopy(reminder);
    const { hour, minute } = reminder.time;
    const triggers: [string, ReminderTrigger][] =
      reminder.weekdays.length === 7
        ? [["daily", { type: "daily", hour, minute }]]
        : reminder.weekdays.map((day) => {
            const weekday = expoWeekday(day);
            return [`weekly-${weekday}`, { type: "weekly", weekday, hour, minute }];
          });
    for (const [slot, trigger] of triggers)
      desired.push({
        identifier: `${identifierPrefix}${reminder.id}.${slot}`,
        title,
        body,
        trigger,
        data: {
          source: reminderSource,
          reminderId: reminder.id,
          kind: reminder.kind,
          fingerprint: fingerprint(title, body, trigger),
        },
      });
  }
  return desired;
}

function dataRecord(data: unknown): Record<string, unknown> | null {
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

/** Only notifications created by reminders may be replaced or canceled by them. */
export function isReminderNotification({ identifier, data }: ScheduledNotification): boolean {
  return identifier.startsWith(identifierPrefix) || dataRecord(data)?.source === reminderSource;
}

export function planReconcile(
  scheduled: readonly ScheduledNotification[],
  desired: readonly DesiredNotification[],
): { cancel: string[]; schedule: DesiredNotification[] } {
  const owned = scheduled.filter(isReminderNotification);
  const wanted = new Map(desired.map((item) => [item.identifier, item]));
  const kept = new Set<string>();
  const cancel: string[] = [];
  for (const item of owned) {
    const match = wanted.get(item.identifier);
    if (
      match &&
      !kept.has(item.identifier) &&
      dataRecord(item.data)?.fingerprint === match.data.fingerprint
    )
      kept.add(item.identifier);
    else cancel.push(item.identifier);
  }
  return { cancel, schedule: desired.filter((item) => !kept.has(item.identifier)) };
}

/** Where a tapped reminder opens. Other notifications return null. */
export function reminderTapRoute(data: unknown): ReminderRoute | null {
  const value = dataRecord(data);
  if (value?.source !== reminderSource) return null;
  const kind = reminderKinds.find((item) => item === value.kind);
  return kind ? reminderRoute(kind) : "/";
}

export type ReminderNotificationAdapter = {
  /** Prepares delivery, such as the Android channel. */
  prepare(): Promise<void>;
  getScheduled(): Promise<ScheduledNotification[]>;
  cancel(identifier: string): Promise<void>;
  schedule(notification: DesiredNotification): Promise<void>;
  /** Notifications already shown in the system notification list. */
  getPresented(): Promise<ScheduledNotification[]>;
  dismiss(identifier: string): Promise<void>;
};

/**
 * Serializes reconciliation across account changes, so a signed-out pass can't
 * interleave with the previous account's pass. Queued requests that a newer
 * request supersedes are skipped.
 */
export function createReminderScheduler(adapter: ReminderNotificationAdapter) {
  let queue: Promise<unknown> = Promise.resolve();
  let generation = 0;

  async function pass(reminders: readonly Reminder[], dismissDelivered: boolean): Promise<boolean> {
    try {
      const plan = planReconcile(await adapter.getScheduled(), desiredSchedule(reminders));
      let complete = true;
      // Keep going after a failure so one bad request can't strand the rest.
      if (dismissDelivered) {
        const shown = await adapter.getPresented().catch(() => {
          complete = false;
          return [];
        });
        for (const { identifier } of shown.filter(isReminderNotification))
          await adapter.dismiss(identifier).catch(() => {
            complete = false;
          });
      }
      for (const identifier of plan.cancel)
        await adapter.cancel(identifier).catch(() => {
          complete = false;
        });
      if (plan.schedule.length) await adapter.prepare();
      for (const notification of plan.schedule)
        await adapter.schedule(notification).catch(() => {
          complete = false;
        });
      return complete;
    } catch {
      return false;
    }
  }

  return {
    /**
     * Resolves true once the device schedule matches these reminders, false if
     * it couldn't, or null when a newer request replaced this one. After sign-out,
     * `dismissDelivered` also clears reminders already shown, so their text and
     * tap action don't outlive the account on this device.
     */
    reconcile(
      reminders: readonly Reminder[],
      { dismissDelivered = false }: { dismissDelivered?: boolean } = {},
    ): Promise<boolean | null> {
      const ticket = ++generation;
      const run = queue.then(() =>
        ticket === generation ? pass(reminders, dismissDelivered) : null,
      );
      queue = run;
      return run;
    },
  };
}

import type { Reminder, ReminderRoute } from "./model";

// Browsers can't schedule expo-notifications reminders. Keep the web bundle
// free of the native module and report reminders as unavailable.
export type ReminderPermission = { granted: boolean; canAskAgain: boolean };
export type ReminderTap = { key: string; route: ReminderRoute };

export function remindersSupported(): boolean {
  return false;
}

export function initializeReminderNotifications() {}

export async function getReminderPermission(): Promise<ReminderPermission | null> {
  return null;
}

export async function requestReminderPermission(): Promise<ReminderPermission | null> {
  return null;
}

export const reminderScheduler = {
  async reconcile(
    _reminders: readonly Reminder[],
    _options: { dismissDelivered?: boolean } = {},
  ): Promise<boolean | null> {
    return null;
  },
};

export function getPendingReminderTap(): ReminderTap | null {
  return null;
}

export function subscribeToReminderTaps(_listener: (tap: ReminderTap) => void): () => void {
  return () => {};
}

export function completeReminderTap(_tap: ReminderTap) {}

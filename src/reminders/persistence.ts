import {
  createDurableWrite,
  type DurableSnapshot,
  type DurableStorage,
} from "../persistence/durable-write.ts";
import {
  isPresetId,
  parseReminder,
  parseReminders,
  reminderListError,
  type Reminder,
  type RemindersDocument,
} from "./model.ts";

// Not an Account tracking document: account storage keeps it on this device,
// scoped to the signed-in account, and never uploads it.
export const remindersStorageKey = "kinevault-track.reminders.v1";
export type ReminderStorage = DurableStorage;
export type ReminderSnapshot = DurableSnapshot<RemindersDocument>;

const saveFailure = "Couldn't save your reminders. Try again.";

export function createReminderPersistence({ storage }: { storage: ReminderStorage }) {
  const { update, remove, ...lifecycle } = createDurableWrite({
    storage,
    key: remindersStorageKey,
    parse: parseReminders,
  });

  function replace(reminders: Reminder[]) {
    const error = reminderListError(reminders);
    return error
      ? { error }
      : { document: { version: 1 as const, reminders }, value: true as const };
  }

  return {
    ...lifecycle,
    async setEnabled(id: string, enabled: boolean): Promise<boolean> {
      return (
        (await update(({ reminders }) => {
          if (!reminders.some((reminder) => reminder.id === id))
            return { error: "This reminder no longer exists." };
          return replace(
            reminders.map((reminder) => (reminder.id === id ? { ...reminder, enabled } : reminder)),
          );
        }, saveFailure)) === true
      );
    },
    /** Adds a reminder, or replaces the saved reminder with the same id. */
    async saveReminder(input: Reminder): Promise<boolean> {
      return (
        (await update(({ reminders }) => {
          const reminder = parseReminder(input);
          if (!reminder) return { error: "Check the reminder's name, time, and days." };
          const exists = reminders.some((item) => item.id === reminder.id);
          if (!exists && isPresetId(reminder.id))
            return { error: "This reminder no longer exists." };
          return replace(
            exists
              ? reminders.map((item) => (item.id === reminder.id ? reminder : item))
              : [...reminders, reminder],
          );
        }, saveFailure)) === true
      );
    },
    async deleteReminder(id: string): Promise<boolean> {
      return (
        (await update(({ reminders }) => {
          if (isPresetId(id)) return { error: "Built-in reminders can be turned off instead." };
          return replace(reminders.filter((reminder) => reminder.id !== id));
        }, "Couldn't delete this reminder. Try again.")) === true
      );
    },
    /** Replaces an unreadable record with the default, all-off reminders. */
    async reset(): Promise<boolean> {
      return (await remove("Couldn't reset your reminders. Try again.")) === true;
    },
  };
}

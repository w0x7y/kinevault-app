import { useEffect } from "react";
import { AppState } from "react-native";
import { createDocumentProvider } from "../persistence/document-provider";
import { createReminderController, type ReminderControllerSnapshot } from "./controller";
import type { Reminder } from "./model";
import {
  getReminderPermission,
  reminderScheduler,
  remindersSupported,
  requestReminderPermission,
} from "./notifications";
import { createReminderPersistence } from "./persistence";

type ReminderController = ReturnType<typeof createReminderController>;
type ReminderContextValue = ReminderControllerSnapshot &
  Pick<ReminderController, "deleteReminder" | "retryLoad" | "reset"> & {
    /** False on web and in builds without local notification support. */
    supported: boolean;
    setEnabled(id: string, enabled: boolean): Promise<boolean>;
    /** Saves an edit, or adds a reminder that asks to be on when `enabled`. */
    saveReminder(reminder: Reminder): Promise<boolean>;
    requestPermission(): Promise<boolean>;
    retrySchedule(): void;
  };

// Mounted once per account scope. Reminders belong to the signed-in account on
// this device: a signed-out scope cancels every reminder notification and clears
// delivered ones, and the next sign-in schedules that account's reminders again.
export const { Provider: ReminderProvider, useDocument: useReminders } = createDocumentProvider({
  name: "ReminderProvider",
  create: (storage) =>
    createReminderController({
      store: createReminderPersistence({ storage }),
      scheduler: reminderScheduler,
      permissions: { get: getReminderPermission, request: requestReminderPermission },
      signedIn: storage.ownerId !== null,
      supported: remindersSupported(),
    }),
  useValue(snapshot, controller): ReminderContextValue {
    useEffect(() => {
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") controller.foreground();
      });
      return () => listener.remove();
    }, [controller]);
    return {
      ...snapshot,
      supported: controller.supported,
      deleteReminder: controller.deleteReminder,
      retryLoad: controller.retryLoad,
      reset: controller.reset,
      setEnabled: controller.setEnabled,
      saveReminder: controller.saveReminder,
      requestPermission: controller.requestPermission,
      retrySchedule: controller.retrySchedule,
    };
  },
});

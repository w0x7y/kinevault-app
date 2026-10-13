import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import { useAccountStorage } from "../account/storage-context";
import { createReminderController, type ReminderControllerSnapshot } from "./controller";
import type { Reminder } from "./model";
import {
  getReminderPermission,
  reminderScheduler,
  remindersSupported,
  requestReminderPermission,
} from "./notifications";
import { createReminderPersistence } from "./persistence";

type ReminderStore = ReturnType<typeof createReminderPersistence>;
type ReminderContextValue = ReminderControllerSnapshot &
  Pick<ReminderStore, "deleteReminder" | "retryLoad" | "reset"> & {
    /** False on web and in builds without local notification support. */
    supported: boolean;
    setEnabled(id: string, enabled: boolean): Promise<boolean>;
    /** Saves an edit, or adds a reminder that asks to be on when `enabled`. */
    saveReminder(reminder: Reminder): Promise<boolean>;
    requestPermission(): Promise<boolean>;
    retrySchedule(): void;
  };

const ReminderContext = createContext<ReminderContextValue | null>(null);

// Mounted once per account scope. Reminders belong to the signed-in account on
// this device: a signed-out scope cancels every reminder notification and clears
// delivered ones, and the next sign-in schedules that account's reminders again.
export function ReminderProvider({ children }: PropsWithChildren) {
  const storage = useAccountStorage();
  const [controller] = useState(() =>
    createReminderController({
      store: createReminderPersistence({ storage }),
      scheduler: reminderScheduler,
      permissions: { get: getReminderPermission, request: requestReminderPermission },
      signedIn: storage.ownerId !== null,
      supported: remindersSupported(),
    }),
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    controller.start();
    return controller.stop;
  }, [controller]);

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") controller.foreground();
    });
    return () => listener.remove();
  }, [controller]);

  const value: ReminderContextValue = {
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
  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders() {
  const value = useContext(ReminderContext);
  if (!value) throw new Error("useReminders must be used inside ReminderProvider");
  return value;
}

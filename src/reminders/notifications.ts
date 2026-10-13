import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import type { ReminderRoute } from "./model";
import {
  createReminderScheduler,
  isReminderNotification,
  reminderChannelId,
  reminderTapRoute,
  type ReminderNotificationAdapter,
} from "./schedule";

type NotificationsModule = typeof import("expo-notifications");
export type ReminderPermission = { granted: boolean; canAskAgain: boolean };
export type ReminderTap = { key: string; route: ReminderRoute };

let loaded: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (loaded !== undefined) return loaded;
  loaded = null;
  // Expo Go for Android throws while expo-notifications loads its push-token
  // registration. Reminders there need a development or store build.
  if (Platform.OS === "android" && isRunningInExpoGo()) return loaded;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("expo-notifications") as NotificationsModule;
  } catch {
    loaded = null;
  }
  return loaded;
}

export function remindersSupported(): boolean {
  return notifications() !== null;
}

let initialized = false;

/** Shows reminders as banners while the app is open. Call once at startup. */
export function initializeReminderNotifications() {
  const api = notifications();
  if (!api || initialized) return;
  initialized = true;
  try {
    api.setNotificationHandler({
      handleNotification: async ({ request }) => {
        const reminder = isReminderNotification({
          identifier: request.identifier,
          data: request.content.data,
        });
        return {
          shouldShowBanner: reminder,
          shouldShowList: reminder,
          // Android hides the heads-up banner of a silent notification.
          shouldPlaySound: reminder,
          shouldSetBadge: false,
        };
      },
    });
  } catch {
    /* Foreground presentation must never prevent startup. */
  }
}

async function prepareChannel(api: NotificationsModule) {
  if (Platform.OS !== "android") return;
  await api.setNotificationChannelAsync(reminderChannelId, {
    name: "Reminders",
    description: "Reminders you set in Settings.",
    // Heads-up banners need high importance; the user can lower it in system settings.
    importance: api.AndroidImportance.HIGH,
  });
}

function permission(
  api: NotificationsModule,
  status: Awaited<ReturnType<NotificationsModule["getPermissionsAsync"]>>,
): ReminderPermission {
  const ios = status.ios?.status;
  return {
    granted:
      status.granted ||
      ios === api.IosAuthorizationStatus.PROVISIONAL ||
      ios === api.IosAuthorizationStatus.EPHEMERAL,
    canAskAgain: status.canAskAgain,
  };
}

/** Null when this build can't deliver local notifications. */
export async function getReminderPermission(): Promise<ReminderPermission | null> {
  const api = notifications();
  if (!api) return null;
  return permission(api, await api.getPermissionsAsync());
}

export async function requestReminderPermission(): Promise<ReminderPermission | null> {
  const api = notifications();
  if (!api) return null;
  // Android 13 shows the permission prompt only once a channel exists.
  await prepareChannel(api);
  return permission(
    api,
    await api.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    }),
  );
}

const adapter: ReminderNotificationAdapter = {
  async prepare() {
    const api = notifications();
    if (!api) throw new Error("Notifications are unavailable");
    await prepareChannel(api);
  },
  async getScheduled() {
    const api = notifications();
    if (!api) throw new Error("Notifications are unavailable");
    return (await api.getAllScheduledNotificationsAsync()).map(({ identifier, content }) => ({
      identifier,
      data: content.data,
    }));
  },
  async cancel(identifier) {
    await notifications()?.cancelScheduledNotificationAsync(identifier);
  },
  async schedule({ identifier, title, body, data, trigger }) {
    const api = notifications();
    if (!api) throw new Error("Notifications are unavailable");
    const channelId = Platform.OS === "android" ? reminderChannelId : undefined;
    await api.scheduleNotificationAsync({
      identifier,
      content: { title, body, data, sound: "default" },
      trigger:
        trigger.type === "daily"
          ? {
              type: api.SchedulableTriggerInputTypes.DAILY,
              hour: trigger.hour,
              minute: trigger.minute,
              channelId,
            }
          : {
              type: api.SchedulableTriggerInputTypes.WEEKLY,
              weekday: trigger.weekday,
              hour: trigger.hour,
              minute: trigger.minute,
              channelId,
            },
    });
  },
  async getPresented() {
    const api = notifications();
    if (!api) throw new Error("Notifications are unavailable");
    return (await api.getPresentedNotificationsAsync()).map(({ request }) => ({
      identifier: request.identifier,
      data: request.content.data,
    }));
  },
  async dismiss(identifier) {
    await notifications()?.dismissNotificationAsync(identifier);
  },
};

export const reminderScheduler = createReminderScheduler(adapter);

const handledTaps = new Set<string>();

function tapFrom(
  api: NotificationsModule,
  response: ReturnType<NotificationsModule["getLastNotificationResponse"]>,
): ReminderTap | null {
  if (!response || response.actionIdentifier !== api.DEFAULT_ACTION_IDENTIFIER) return null;
  const { request, date } = response.notification;
  const route = reminderTapRoute(request.content.data);
  if (!route) return null;
  // Repeating reminders reuse an identifier; each delivery has its own date.
  const key = `${request.identifier}:${date}`;
  return handledTaps.has(key) ? null : { key, route };
}

/** The reminder tap that launched or resumed the app, if it is still unhandled. */
export function getPendingReminderTap(): ReminderTap | null {
  const api = notifications();
  if (!api) return null;
  try {
    return tapFrom(api, api.getLastNotificationResponse());
  } catch {
    return null;
  }
}

export function subscribeToReminderTaps(listener: (tap: ReminderTap) => void): () => void {
  const api = notifications();
  if (!api) return () => {};
  const subscription = api.addNotificationResponseReceivedListener((response) => {
    const tap = tapFrom(api, response);
    if (tap) listener(tap);
  });
  return () => subscription.remove();
}

export function completeReminderTap(tap: ReminderTap) {
  handledTaps.add(tap.key);
  try {
    notifications()?.clearLastNotificationResponse();
  } catch {
    /* The handled key still prevents a repeated route change. */
  }
}

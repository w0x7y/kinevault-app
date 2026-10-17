import { Linking } from "react-native";
import type { DeviceSteps } from "./device-steps";

type HealthConnect = typeof import("react-native-health-connect");

const provider = "com.google.android.apps.healthdata";
let client: HealthConnect | null = null;

/** Health Connect once it's ready to use, or why it isn't. Only success is kept, so an install shows up. */
async function connect(): Promise<HealthConnect | "install" | "unavailable"> {
  if (client) return client;
  try {
    // Expo Go has no Health Connect module, and loading it throws, so it loads on first use.
    const module = await import("react-native-health-connect");
    const status = await module.getSdkStatus();
    if (status === module.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
      return "install";
    if (status !== module.SdkAvailabilityStatus.SDK_AVAILABLE || !(await module.initialize()))
      return "unavailable";
    return (client = module);
  } catch {
    return "unavailable";
  }
}

const readsSteps = (permissions: { accessType: string; recordType: string }[]) =>
  permissions.some(({ accessType, recordType }) => accessType === "read" && recordType === "Steps");

export const deviceSteps: DeviceSteps = {
  async access() {
    const health = await connect();
    if (typeof health === "string") return health;
    return readsSteps(await health.getGrantedPermissions()) ? "granted" : "undetermined";
  },
  async request() {
    const health = await connect();
    if (typeof health === "string") return health;
    // Android stops showing the dialog after repeated refusals; only settings can grant it then.
    const granted = await health.requestPermission([{ accessType: "read", recordType: "Steps" }]);
    return readsSteps(granted) ? "granted" : "denied";
  },
  async count(start, end) {
    const health = await connect();
    if (typeof health === "string") throw new Error("Health Connect isn't available.");
    const result = await health.aggregateRecord({
      recordType: "Steps",
      timeRangeFilter: {
        operator: "between",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    return result.COUNT_TOTAL;
  },
  async openSettings() {
    const health = await connect();
    if (health === "install")
      await Linking.openURL(`market://details?id=${provider}`).catch(() =>
        Linking.openURL(`https://play.google.com/store/apps/details?id=${provider}`),
      );
    else if (typeof health !== "string") health.openHealthConnectSettings();
  },
};

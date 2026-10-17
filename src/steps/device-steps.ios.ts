import { Pedometer } from "expo-sensors";
import { Linking } from "react-native";
import type { DeviceSteps, DeviceStepsAccess } from "./device-steps";

async function access(
  check: () => Promise<{ status: string }> = Pedometer.getPermissionsAsync,
): Promise<DeviceStepsAccess> {
  if (!(await Pedometer.isAvailableAsync())) return "unavailable";
  const { status } = await check();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

export const deviceSteps: DeviceSteps = {
  access: () => access(),
  request: () => access(Pedometer.requestPermissionsAsync),
  // Core Motion keeps only the last seven days; older days return what it still has.
  count: async (start, end) => (await Pedometer.getStepCountAsync(start, end)).steps,
  openSettings: () => Linking.openSettings(),
};

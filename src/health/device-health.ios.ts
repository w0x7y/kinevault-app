import { Linking } from "react-native";
import type { DeviceHealth, HealthAccess } from "./device-health";
import type { HealthWrite } from "./plan";

type HealthKit = typeof import("@kingstinct/react-native-healthkit");

const types = {
  workout: "HKWorkoutTypeIdentifier",
  weight: "HKQuantityTypeIdentifierBodyMass",
  water: "HKQuantityTypeIdentifierDietaryWater",
} as const;
let kit: HealthKit | null = null;

/** HealthKit once it's loaded on a device that has it. */
async function load(): Promise<HealthKit | null> {
  if (kit) return kit;
  try {
    // Expo Go has no HealthKit module, and loading it throws, so it loads on first use.
    const module = await import("@kingstinct/react-native-healthkit");
    return module.isHealthDataAvailable() ? (kit = module) : null;
  } catch {
    return null;
  }
}

async function access(): Promise<HealthAccess> {
  const health = await load();
  if (!health) return "unavailable";
  // Write access is reported truthfully; read access never is, and the app reads nothing.
  const statuses = Object.values(types).map((type) => health.authorizationStatusFor(type));
  if (statuses.every((status) => status === health.AuthorizationStatus.sharingAuthorized))
    return "granted";
  return statuses.includes(health.AuthorizationStatus.notDetermined) ? "undetermined" : "denied";
}

/** A sync identifier and a higher sync version make HealthKit replace the older copy. */
function save(health: HealthKit, write: HealthWrite) {
  const sync = { HKSyncIdentifier: write.id, HKSyncVersion: write.version };
  switch (write.kind) {
    case "workout":
      return health.saveWorkoutSample(
        write.strength
          ? health.WorkoutActivityType.traditionalStrengthTraining
          : health.WorkoutActivityType.other,
        [],
        new Date(write.start),
        new Date(write.end),
        undefined,
        // HealthKit workouts have no title; the brand name is the closest field.
        { ...sync, HKWorkoutBrandName: write.title },
      );
    case "weight":
      return health.saveQuantitySample(
        types.weight,
        "kg",
        write.kg,
        new Date(write.time),
        new Date(write.time),
        sync,
      );
    case "water":
      return health.saveQuantitySample(
        types.water,
        "mL",
        write.ml,
        new Date(write.start),
        new Date(write.end),
        sync,
      );
  }
}

export const deviceHealth: DeviceHealth = {
  name: "Apple Health",
  access,
  async request() {
    const health = await load();
    if (!health) return "unavailable";
    await health.requestAuthorization({ toShare: Object.values(types) });
    return access();
  },
  async save(writes) {
    const health = await load();
    if (!health) throw new Error("Apple Health isn't available.");
    for (const write of writes) await save(health, write);
  },
  async remove(kind, ids) {
    const health = await load();
    if (!health) throw new Error("Apple Health isn't available.");
    for (const id of ids)
      await health.deleteObjects(types[kind], {
        metadata: { withMetadataKey: "HKSyncIdentifier", value: id },
      });
  },
  // Like Phone steps, this opens the app's page in Settings, which lists its Health access.
  openSettings: () => Linking.openSettings(),
};

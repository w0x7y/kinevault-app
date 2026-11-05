import type { HealthKind, HealthWrite } from "./plan.ts";

/**
 * Whether the app may save to the phone's health store, worded like Phone steps' access:
 * - `unavailable`: no health store here (web, Expo Go, a device without one).
 * - `install`: Android needs Health Connect installed or updated first.
 * - `undetermined`: the app can ask.
 * - `denied`: write access to workouts, weight or water is off; only the settings turn it on.
 * - `granted`: the app may write all three.
 */
export type HealthAccess = "unavailable" | "install" | "undetermined" | "denied" | "granted";

/** The phone's health store: Apple Health on iOS, Health Connect on Android. */
export type DeviceHealth = {
  /** What Settings calls the store; null where there is none. */
  name: "Apple Health" | "Health Connect" | null;
  /** Checks write access without prompting. */
  access(): Promise<HealthAccess>;
  /** Asks to write workouts, weight and water, and resolves to the access afterwards. */
  request(): Promise<HealthAccess>;
  /** Saves records of one kind, replacing older versions saved under the same IDs. */
  save(records: readonly HealthWrite[]): Promise<void>;
  /** Removes the records this app saved under these IDs. */
  remove(kind: HealthKind, ids: readonly string[]): Promise<void>;
  /** Opens where the user can grant access or install Health Connect. */
  openSettings(): Promise<void>;
};

// The web build has no health store, so Settings hides the option. `device-health.ios.ts` and
// `device-health.android.ts` replace this file on phones.
export const deviceHealth: DeviceHealth = {
  name: null,
  access: async () => "unavailable",
  request: async () => "unavailable",
  save: async () => {
    throw new Error("There's no health store on this device.");
  },
  remove: async () => {
    throw new Error("There's no health store on this device.");
  },
  openSettings: async () => {},
};

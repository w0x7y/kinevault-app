/**
 * Whether this device can count steps and whether the app may read them:
 * - `unavailable`: no step counting here (web, Expo Go on Android, no sensor).
 * - `install`: Android needs Health Connect installed or updated first.
 * - `undetermined`: the app can ask.
 * - `denied`: the user turned access off; only the system settings can turn it back on.
 * - `granted`: the app can read steps.
 */
export type DeviceStepsAccess = "unavailable" | "install" | "undetermined" | "denied" | "granted";

/** The phone's own step count: Core Motion on iOS, Health Connect on Android. */
export type DeviceSteps = {
  /** Checks access without prompting. */
  access(): Promise<DeviceStepsAccess>;
  /** Asks to read steps and resolves to the access afterwards. */
  request(): Promise<DeviceStepsAccess>;
  /** Steps counted between `start` and `end`. Rejects when the platform can't read them. */
  count(start: Date, end: Date): Promise<number>;
  /** Opens where the user can grant access or install the step provider. */
  openSettings(): Promise<void>;
};

// The web build has no step counter. `device-steps.ios.ts` and `device-steps.android.ts`
// replace this file on phones.
export const deviceSteps: DeviceSteps = {
  access: async () => "unavailable",
  request: async () => "unavailable",
  count: async () => {
    throw new Error("Step counting isn't available on this device.");
  },
  openSettings: async () => {},
};

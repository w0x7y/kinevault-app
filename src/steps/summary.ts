import { addDays, parseDay } from "../calendar/dates.ts";
import type { DeviceStepsAccess } from "./device-steps.ts";

/** The part of `date` the phone may have counted: local midnight until now or the next midnight. */
export function stepDayRange(date: string, now: Date): { start: Date; end: Date } | null {
  const start = parseDay(date);
  start.setHours(0, 0, 0, 0);
  const end = parseDay(addDays(date, 1));
  end.setHours(0, 0, 0, 0);
  if (start >= now) return null;
  return { start, end: end < now ? end : now };
}

/** The phone's reading of a day, as `useDeviceSteps` reports it. */
export type PhoneSteps = {
  /** Null until the first access check finishes. */
  access: DeviceStepsAccess | null;
  state: "loading" | "ready" | "error";
  steps: number | null;
};

/** The phone's reading with what the user can do about it: read again, connect or open settings. */
export type PhoneStepsReading = PhoneSteps & {
  retry(): void;
  connect(): Promise<void>;
  openSettings(): Promise<void>;
};

/** What the steps sheet says about the phone: its count, why it has none, and the fix offered. */
export function phoneStepsStatus(phone: PhoneSteps): {
  status: string;
  /** The phone's count is showing. */
  counted: boolean;
  action: { label: string; kind: "retry" | "connect" | "openSettings" } | null;
} {
  const { access, state } = phone;
  if (access === "granted" && state === "ready")
    return { status: `${(phone.steps ?? 0).toLocaleString()} steps`, counted: true, action: null };
  if (access === null || access === "granted")
    return state === "error"
      ? {
          status: "Couldn't read phone steps.",
          counted: false,
          action: { label: "Retry phone steps", kind: "retry" },
        }
      : { status: "Loading...", counted: false, action: null };
  if (access === "undetermined")
    return {
      status: "Not connected",
      counted: false,
      action: { label: "Connect phone steps", kind: "connect" },
    };
  if (access === "denied")
    return {
      status: "Step access is off.",
      counted: false,
      action: { label: "Open settings", kind: "openSettings" },
    };
  if (access === "install")
    return {
      status: "Install Health Connect to count steps.",
      counted: false,
      action: { label: "Get Health Connect", kind: "openSettings" },
    };
  return {
    status: "Phone step counting isn't available on this device.",
    counted: false,
    action: null,
  };
}

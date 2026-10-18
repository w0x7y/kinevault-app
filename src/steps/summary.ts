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

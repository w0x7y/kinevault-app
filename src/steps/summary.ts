import { addDays, parseDay, shortDayLabel } from "../calendar/dates.ts";
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

/** The Home Steps tile: phone steps plus steps logged by hand, with what the figure includes. */
export function stepsTile(date: string, phone: PhoneSteps, logged: number | null) {
  const read = phone.access === "granted" && phone.state === "ready" ? phone.steps : null;
  const extra = logged ?? 0;
  const value = read === null && extra === 0 ? null : (read ?? 0) + extra;
  let captions: string[];
  if (phone.access === null || (phone.access === "granted" && phone.state === "loading"))
    captions = ["loading..."];
  else if (phone.access === "granted")
    captions =
      phone.state === "error"
        ? ["Couldn't read phone steps"]
        : ["From your phone", ...(extra > 0 ? [`Includes ${extra.toLocaleString()} logged`] : [])];
  else if (phone.access === "unavailable")
    captions = [extra > 0 ? "Logged manually" : "Tap to log steps"];
  else captions = ["Not connected"];
  const figure = value === null ? "No steps yet" : `${value.toLocaleString()} steps`;
  return {
    value,
    captions,
    label: `Log steps. ${figure} for ${shortDayLabel(date)}. ${captions.join(". ")}.`,
  };
}

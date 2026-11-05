import { dayKey, parseDay } from "../calendar/dates.ts";
import { drinksMl } from "../daily/model.ts";
import type { WorkoutSession } from "../exercise/model.ts";
import type { FoodLogDocument } from "../food/log-model.ts";
import type { DayAmountDocument } from "../persistence/day-amount-log.ts";
import type { WeightEntry } from "../profile/weight-model.ts";
import { stepDayRange } from "../steps/summary.ts";
import type { DeviceHealth, HealthAccess } from "./device-health.ts";

/**
 * One record kept in the phone's health store. `id` is the app's own key for it, and `source`
 * holds the values it came from, so a record is rewritten only when they change. Times are epoch
 * milliseconds.
 */
export type HealthRecord = { id: string; source: string } & (
  | { kind: "workout"; title: string; start: number; end: number; strength: boolean }
  | { kind: "weight"; time: number; kg: number }
  | { kind: "water"; start: number; end: number; ml: number }
);
export type HealthKind = HealthRecord["kind"];
/** A record with the version that replaces any older copy under its ID. */
export type HealthWrite = HealthRecord & { version: number };

/** What the health store should hold: workouts, Body-weight measurements and water. */
export type HealthSources = {
  sessions: readonly WorkoutSession[];
  weights: readonly WeightEntry[];
  food: FoodLogDocument["days"];
  water: DayAmountDocument["days"];
};

/**
 * Every record the store should hold at `now`. Days after today wait until they come. Records
 * with only a date are placed at noon, or at `now` when that is earlier, so none is in the future.
 */
export function healthRecords(
  { sessions, weights, food, water }: HealthSources,
  now: number,
): HealthRecord[] {
  const today = dayKey(new Date(now));
  // shortcut: IDs aren't scoped to the account, so two accounts on one phone that log the same
  // date share that record. Prefix them per account if shared phones turn out to matter.
  const records: HealthRecord[] = [];
  for (const session of sessions) {
    // A workout without a Recorded duration (or a zero one) has no session to write.
    if (session.status !== "completed" || !session.durationSeconds || session.date > today)
      continue;
    const length = session.durationSeconds * 1000;
    // A timed workout starts when its timer did; a manual log has only its date.
    const start = Math.min(session.startedAt ?? parseDay(session.date).getTime(), now - length);
    const strength = session.exercises.some(({ exercise }) => exercise.tracking !== "cardio");
    records.push({
      kind: "workout",
      id: `workout:${session.id}`,
      source: JSON.stringify([session.name, session.date, session.startedAt, length, strength]),
      title: session.name,
      start,
      end: start + length,
      strength,
    });
  }
  for (const { date, kg } of weights) {
    if (date > today) continue;
    const time = Math.min(parseDay(date).getTime(), now);
    records.push({ kind: "weight", id: `weight:${date}`, source: String(kg), time, kg });
  }
  for (const date of new Set([...Object.keys(water), ...Object.keys(food)])) {
    // Manual water plus Drinks, as Daily activity counts it, from midnight to the day's end or now.
    const ml = (water[date] ?? 0) + drinksMl(food[date] ?? []);
    const range = stepDayRange(date, new Date(now));
    if (ml <= 0 || !range) continue;
    records.push({
      kind: "water",
      id: `water:${date}`,
      source: String(ml),
      start: range.start.getTime(),
      end: range.end.getTime(),
      ml,
    });
  }
  return records;
}

/** What this account last saved to the store on this device: each record's version and source. */
export type HealthLedger = Record<string, { version: number; source: string }>;

export function parseHealthLedger(raw: string | null): HealthLedger {
  if (raw === null) return {};
  const value: unknown = JSON.parse(raw);
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 1 ||
    !("records" in value) ||
    typeof value.records !== "object" ||
    value.records === null
  )
    throw new Error("Invalid health ledger");
  const ledger: HealthLedger = {};
  for (const [id, entry] of Object.entries(value.records)) {
    const { version, source } = (entry ?? {}) as { version?: unknown; source?: unknown };
    if (
      !/^(workout|weight|water):./.test(id) ||
      typeof source !== "string" ||
      typeof version !== "number" ||
      !Number.isSafeInteger(version)
    )
      throw new Error("Invalid health ledger");
    ledger[id] = { version, source };
  }
  return ledger;
}

export function serializeHealthLedger(ledger: HealthLedger): string {
  return JSON.stringify({ version: 1, records: ledger });
}

export const healthKind = (id: string) => id.slice(0, id.indexOf(":")) as HealthKind;

/**
 * The saves and removals that make the store match `records`. A record saves when it's new or its
 * source changed, with a version above its last one; one the app no longer has is removed.
 */
export function healthWrites(
  records: readonly HealthRecord[],
  ledger: HealthLedger,
  now: number,
): { save: HealthWrite[]; remove: string[] } {
  const save = records
    .filter(({ id, source }) => ledger[id]?.source !== source)
    .map((record) => ({
      ...record,
      version: Math.max(now, (ledger[record.id]?.version ?? 0) + 1),
    }));
  const kept = new Set(records.map(({ id }) => id));
  return { save, remove: Object.keys(ledger).filter((id) => !kept.has(id)) };
}

/**
 * What Settings says under the switch while it's on, worded like Phone steps: why nothing is being
 * saved and the fix offered. Null when there's nothing to say.
 */
export function healthStatus({
  name,
  enabled,
  access,
  failed,
}: {
  name: NonNullable<DeviceHealth["name"]>;
  enabled: boolean | null;
  access: HealthAccess | null;
  failed: boolean;
}): {
  status: string;
  action: { label: string; kind: "connect" | "openSettings" | "retry" } | null;
} | null {
  if (!enabled || access === null) return null;
  switch (access) {
    case "granted":
      return failed
        ? { status: `Couldn't save to ${name}.`, action: { label: "Try again", kind: "retry" } }
        : null;
    case "undetermined":
      return { status: "Not connected", action: { label: "Allow access", kind: "connect" } };
    case "denied":
      return {
        status: `Access to ${name} is off.`,
        action: { label: "Open settings", kind: "openSettings" },
      };
    case "install":
      return {
        status: "Install Health Connect to save your workouts, weight and water.",
        action: { label: "Get Health Connect", kind: "openSettings" },
      };
    case "unavailable":
      return { status: `${name} isn't available on this device.`, action: null };
  }
}

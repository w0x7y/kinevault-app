import { parseDay } from "../calendar/dates.ts";
import { limitText, unitName, type UnitSystem } from "../units/units.ts";

export type WeightEntry = { date: string; kg: number };
export type SaveWeightInput = WeightEntry & { previousDate?: string };

export function validateWeightDate(date: unknown): string {
  if (typeof date !== "string") throw new Error("Enter a date as YYYY-MM-DD.");
  try {
    parseDay(date);
  } catch {
    throw new Error("Enter a valid date as YYYY-MM-DD.");
  }
  return date;
}

function validateWeightKg(kg: unknown): number {
  if (typeof kg !== "number" || !Number.isFinite(kg) || kg < 1 || kg > 500)
    throw new Error("Enter a weight between 1 and 500 kg.");
  if (Math.abs(kg * 100 - Math.round(kg * 100)) > 0.00000001)
    throw new Error("Enter a weight in kg with up to two decimal places.");
  return kg;
}

export function validateWeightEntry(date: unknown, kg: unknown): WeightEntry {
  return { date: validateWeightDate(date), kg: validateWeightKg(kg) };
}

/** Saved kilogram text as a Body-weight measurement; messages name the limits in `units`. */
export function weightFromInput(value: string, units: UnitSystem = "metric"): number {
  const text = value.trim();
  if (text.length > 16 || !/^\d+(?:[.,]\d{1,2})?$/.test(text))
    throw new Error(
      units === "metric"
        ? "Enter a weight in kg with up to two decimal places."
        : "Enter a weight in lb with up to one decimal place.",
    );
  const kg = Number(text.replace(",", "."));
  if (kg < 1 || kg > 500)
    throw new Error(
      `Enter a weight between ${limitText("bodyWeight", 1, units, "min")} and ${limitText("bodyWeight", 500, units, "max")} ${unitName("bodyWeight", units)}.`,
    );
  return validateWeightKg(kg);
}

/** A dated history read by `read`, at most one entry per date, oldest first. */
export function parseDatedEntries<T extends { date: string }>(
  value: unknown,
  read: (entry: object) => T,
): T[] {
  if (!Array.isArray(value) || value.length > 50000) throw new Error("Invalid measurement history");
  const dates = new Set<string>();
  const entries = value.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) throw new Error("Invalid measurement");
    const parsed = read(entry);
    if (dates.has(parsed.date)) throw new Error("Duplicate measurement date");
    dates.add(parsed.date);
    return parsed;
  });
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export function parseWeightEntries(value: unknown): WeightEntry[] {
  return parseDatedEntries(value, (entry) => {
    if (!("date" in entry) || !("kg" in entry)) throw new Error("Invalid weight measurement");
    return validateWeightEntry(entry.date, entry.kg);
  });
}

/** Saves `next` on its date, replacing any entry there and the one at `previousDate`. */
export function saveDatedEntry<T extends { date: string }>(
  entries: readonly T[],
  next: T,
  previousDate: string | undefined,
  parse: (value: unknown) => T[],
): T[] {
  if (previousDate !== undefined) {
    parseDay(previousDate);
    if (!entries.some((entry) => entry.date === previousDate))
      throw new Error("This measurement changed. Reopen it to edit.");
  }
  return parse([
    ...entries.filter((entry) => entry.date !== next.date && entry.date !== previousDate),
    next,
  ]);
}

export function saveWeightEntry(
  entries: readonly WeightEntry[],
  input: SaveWeightInput,
): WeightEntry[] {
  const next = validateWeightEntry(input.date, input.kg);
  return saveDatedEntry(entries, next, input.previousDate, parseWeightEntries);
}

export function removeDatedEntry<T extends { date: string }>(
  entries: readonly T[],
  date: string,
): T[] {
  parseDay(date);
  if (!entries.some((entry) => entry.date === date))
    throw new Error("This measurement changed. Reopen your history.");
  return entries.filter((entry) => entry.date !== date);
}

function calendarNumber(day: string): number {
  const parsed = parseDay(day);
  const utc = new Date(0);
  utc.setUTCFullYear(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  utc.setUTCHours(0, 0, 0, 0);
  return utc.getTime() / 86400000;
}

/** Chart points for dated values, spaced by calendar day. */
export function measurementTrend(entries: readonly { date: string; value: number }[]) {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (!ordered.length) return { points: [], minimum: 0, maximum: 1, change: null };
  const first = ordered[0]!;
  const latest = ordered.at(-1)!;
  const low = Math.min(...ordered.map((entry) => entry.value));
  const high = Math.max(...ordered.map((entry) => entry.value));
  const padding = Math.max(0.5, (high - low) * 0.15);
  const minimum = Math.max(0, low - padding),
    maximum = high + padding;
  const start = calendarNumber(first.date),
    span = calendarNumber(latest.date) - start;
  return {
    points: ordered.map((entry) => ({
      ...entry,
      x: span ? (calendarNumber(entry.date) - start) / span : 0.5,
      y: (entry.value - minimum) / (maximum - minimum),
    })),
    minimum,
    maximum,
    change: ordered.length > 1 ? Math.round((latest.value - first.value) * 100) / 100 : null,
  };
}

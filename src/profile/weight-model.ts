import { parseDay } from "../calendar/dates.ts";

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

export function weightFromInput(value: string): number {
  const text = value.trim();
  if (text.length > 16 || !/^\d+(?:[.,]\d{1,2})?$/.test(text))
    throw new Error("Enter a weight in kg with up to two decimal places.");
  return validateWeightKg(Number(text.replace(",", ".")));
}

export function parseWeightEntries(value: unknown): WeightEntry[] {
  if (!Array.isArray(value) || value.length > 50000) throw new Error("Invalid weight history");
  const dates = new Set<string>();
  const entries = value.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null || !("date" in entry) || !("kg" in entry))
      throw new Error("Invalid weight measurement");
    const parsed = validateWeightEntry(entry.date, entry.kg);
    if (dates.has(parsed.date)) throw new Error("Duplicate weight measurement date");
    dates.add(parsed.date);
    return parsed;
  });
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export function saveWeightEntry(
  entries: readonly WeightEntry[],
  input: SaveWeightInput,
): WeightEntry[] {
  const next = validateWeightEntry(input.date, input.kg);
  if (input.previousDate !== undefined) {
    parseDay(input.previousDate);
    if (!entries.some((entry) => entry.date === input.previousDate))
      throw new Error("This measurement changed. Reopen it to edit.");
  }
  return parseWeightEntries([
    ...entries.filter((entry) => entry.date !== next.date && entry.date !== input.previousDate),
    next,
  ]);
}

export function removeWeightEntry(entries: readonly WeightEntry[], date: string): WeightEntry[] {
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

export function weightTrend(entries: readonly WeightEntry[]) {
  const ordered = parseWeightEntries(entries);
  if (!ordered.length) return { points: [], minimum: 0, maximum: 1, change: null };
  const first = ordered[0]!;
  const latest = ordered.at(-1)!;
  const low = Math.min(...ordered.map((entry) => entry.kg));
  const high = Math.max(...ordered.map((entry) => entry.kg));
  const padding = Math.max(0.5, (high - low) * 0.15);
  const minimum = Math.max(0, low - padding),
    maximum = high + padding;
  const start = calendarNumber(first.date),
    span = calendarNumber(latest.date) - start;
  return {
    points: ordered.map((entry) => ({
      ...entry,
      x: span ? (calendarNumber(entry.date) - start) / span : 0.5,
      y: (entry.kg - minimum) / (maximum - minimum),
    })),
    minimum,
    maximum,
    change: ordered.length > 1 ? Math.round((latest.kg - first.kg) * 100) / 100 : null,
  };
}

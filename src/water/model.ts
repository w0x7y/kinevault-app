import { parseDay } from "../calendar/dates.ts";

export type WaterLogDocument = { version: 1; days: Record<string, number> };
export type SetWaterInput = { date: string; ml: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isTotal(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseWaterLog(raw: string | null): WaterLogDocument {
  if (raw === null) return { version: 1, days: {} };
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.days))
    throw new Error("Unsupported water log");
  const days: WaterLogDocument["days"] = {};
  for (const [date, total] of Object.entries(value.days)) {
    parseDay(date);
    if (!isTotal(total)) throw new Error("Invalid water total");
    days[date] = total;
  }
  return { version: 1, days };
}

export function setWater(
  document: WaterLogDocument,
  { date, ml }: SetWaterInput,
): WaterLogDocument {
  parseDay(date);
  if (!isTotal(ml)) throw new RangeError("Invalid water amount");
  return { version: 1, days: { ...document.days, [date]: ml } };
}

// Daily totals may exceed the limit for a single drink or the former incremental entry.
export function manualWaterAmountFromText(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const ml = Number(text.trim());
  return isTotal(ml) ? ml : null;
}

export function waterAmountFromText(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const ml = Number(text.trim());
  return Number.isSafeInteger(ml) && ml >= 1 && ml <= 10000 ? ml : null;
}

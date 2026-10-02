import { parseDay } from "../calendar/dates.ts";

export type WaterLogDocument = { version: 1; days: Record<string, number> };
export type AddWaterInput = { date: string; ml: number };

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

export function addWater(document: WaterLogDocument, { date, ml }: AddWaterInput): WaterLogDocument {
  parseDay(date);
  if (!Number.isSafeInteger(ml) || ml < 1 || ml > 10000)
    throw new RangeError("Invalid water amount");
  const total = (document.days[date] ?? 0) + ml;
  if (!isTotal(total)) throw new RangeError("Invalid water total");
  return { version: 1, days: { ...document.days, [date]: total } };
}

export function waterAmountFromText(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const ml = Number(text.trim());
  return Number.isSafeInteger(ml) && ml >= 1 && ml <= 10000 ? ml : null;
}

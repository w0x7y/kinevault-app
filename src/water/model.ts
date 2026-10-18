import { parseDayAmounts, type DayAmountDocument } from "../persistence/day-amount-log.ts";

export type WaterLogDocument = DayAmountDocument;

export function parseWaterLog(raw: string | null): WaterLogDocument {
  return parseDayAmounts(raw, "water log");
}

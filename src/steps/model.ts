import { parseDayAmounts, type DayAmountDocument } from "../persistence/day-amount-log.ts";

/** Steps logged by hand, per day. Phone steps are read from the device, never stored. */
export type StepsLogDocument = DayAmountDocument;

export function parseStepsLog(raw: string | null): StepsLogDocument {
  return parseDayAmounts(raw, "steps log");
}

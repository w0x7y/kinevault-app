import { createDayAmountEdit, type DayAmountStore } from "../persistence/day-amount-log.ts";

// A Manual water edit replaces one date's amount, captured when the edit is created.
// Daily totals may exceed the limit for a single drink or the former incremental entry.
export function createManualWaterEdit({ log, date }: { log: DayAmountStore; date: string }) {
  return createDayAmountEdit({
    log,
    date,
    invalid: "Enter a whole number of milliliters, 0 or more.",
    failure: "Couldn't save your water log. Try again.",
  });
}

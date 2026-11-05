import { createDayAmountEdit, type DayAmountStore } from "../persistence/day-amount-log.ts";
import type { UnitSystem } from "../units/units.ts";

// A Manual water edit replaces one date's amount, captured when the edit is created.
// Daily totals may exceed the limit for a single drink or the former incremental entry.
// The draft is saved milliliter text; `units` words its message.
export function createManualWaterEdit({
  log,
  date,
  units = "metric",
}: {
  log: DayAmountStore;
  date: string;
  units?: UnitSystem;
}) {
  return createDayAmountEdit({
    log,
    date,
    invalid: `Enter a whole number of ${units === "metric" ? "milliliters" : "fluid ounces"}, 0 or more.`,
    failure: "Couldn't save your water log. Try again.",
  });
}

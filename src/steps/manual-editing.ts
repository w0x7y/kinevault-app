import { createDayAmountEdit, type DayAmountStore } from "../persistence/day-amount-log.ts";

// Replaces one date's logged steps, like a Manual water edit.
export function createManualStepsEdit({ log, date }: { log: DayAmountStore; date: string }) {
  return createDayAmountEdit({
    log,
    date,
    invalid: "Enter a whole number of steps, 0 or more.",
    failure: "Couldn't save your steps. Try again.",
  });
}

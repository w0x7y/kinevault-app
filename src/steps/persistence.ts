import { createDayAmountLog } from "../persistence/day-amount-log.ts";
import type { DurableSnapshot, DurableStorage } from "../persistence/durable-write.ts";
import { parseStepsLog, type StepsLogDocument } from "./model.ts";

export const stepsLogStorageKey = "kinevault-track.steps-log.v1";
export type StepsLogStorage = DurableStorage;
export type StepsLogSnapshot = DurableSnapshot<StepsLogDocument>;

export function createStepsLogPersistence({ storage }: { storage: StepsLogStorage }) {
  return createDayAmountLog({
    storage,
    key: stepsLogStorageKey,
    parse: parseStepsLog,
    failure: "Couldn't save your steps. Try again.",
  });
}

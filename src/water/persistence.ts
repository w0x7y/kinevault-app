import { createDayAmountLog } from "../persistence/day-amount-log.ts";
import type { DurableSnapshot, DurableStorage } from "../persistence/durable-write.ts";
import { parseWaterLog, type WaterLogDocument } from "./model.ts";

export const waterLogStorageKey = "kinevault-track.water-log.v1";
export type WaterLogStorage = DurableStorage;
export type WaterLogSnapshot = DurableSnapshot<WaterLogDocument>;

export function createWaterLogPersistence({ storage }: { storage: WaterLogStorage }) {
  return createDayAmountLog({
    storage,
    key: waterLogStorageKey,
    parse: parseWaterLog,
    failure: "Couldn't save your water log. Try again.",
  });
}

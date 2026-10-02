import { createDurableWrite, type DurableSnapshot, type DurableStorage } from "../persistence/durable-write.ts";
import { setWater, parseWaterLog, type SetWaterInput, type WaterLogDocument } from "./model.ts";

export const waterLogStorageKey = "kinevault-track.water-log.v1";
export type WaterLogStorage = DurableStorage;
export type WaterLogSnapshot = DurableSnapshot<WaterLogDocument>;

export function createWaterLogPersistence({ storage }: { storage: WaterLogStorage }) {
  const { update, ...lifecycle } = createDurableWrite({ storage, key: waterLogStorageKey, parse: parseWaterLog });
  return {
    ...lifecycle,
    async set(input: SetWaterInput): Promise<boolean> {
      return await update(document => ({ document: setWater(document, input), value: true }),
        "Couldn't save your water log. Try again.") === true;
    },
  };
}

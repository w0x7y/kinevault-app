import {
  createDurableWrite,
  type DurableSnapshot,
  type DurableStorage,
} from "../persistence/durable-write.ts";
import { parseWaterGoal, type WaterGoalDocument } from "./goal-model.ts";

export const waterGoalStorageKey = "kinevault-track.water-goal.v1";
export type WaterGoalStorage = DurableStorage;
export type WaterGoalSnapshot = DurableSnapshot<WaterGoalDocument>;

export function createWaterGoalPersistence({ storage }: { storage: WaterGoalStorage }) {
  const {
    update,
    remove: _remove,
    ...lifecycle
  } = createDurableWrite({ storage, key: waterGoalStorageKey, parse: parseWaterGoal });
  return {
    ...lifecycle,
    async setGoal(dailyMl: number): Promise<boolean> {
      return (
        (await update(() => {
          if (
            typeof dailyMl !== "number" ||
            !Number.isSafeInteger(dailyMl) ||
            dailyMl < 1 ||
            dailyMl > 10000
          )
            throw new RangeError("Invalid water goal");
          return { document: { version: 1, dailyMl }, value: true };
        }, "Couldn't save your water goal. Try again.")) === true
      );
    },
  };
}

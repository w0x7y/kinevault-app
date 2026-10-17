import {
  createDurableWrite,
  type DurableSnapshot,
  type DurableStorage,
} from "../persistence/durable-write.ts";
import { parseStepsLog, setSteps, type SetStepsInput, type StepsLogDocument } from "./model.ts";

// Device-only: the cloud accepts a fixed list of documents, so this one isn't in
// accountTrackingDocuments. Account storage keeps it scoped to the signed-in account.
export const stepsLogStorageKey = "kinevault-track.steps-log.v1";
export type StepsLogStorage = DurableStorage;
export type StepsLogSnapshot = DurableSnapshot<StepsLogDocument>;

export function createStepsLogPersistence({ storage }: { storage: StepsLogStorage }) {
  const {
    update,
    remove: _remove,
    ...lifecycle
  } = createDurableWrite({ storage, key: stepsLogStorageKey, parse: parseStepsLog });
  return {
    ...lifecycle,
    async set(input: SetStepsInput): Promise<boolean> {
      return (
        (await update(
          (document) => ({ document: setSteps(document, input), value: true }),
          "Couldn't save your steps. Try again.",
        )) === true
      );
    },
  };
}

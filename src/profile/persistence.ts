import {
  createDurableWrite,
  type DurableSnapshot,
  type DurableStorage,
} from "../persistence/durable-write.ts";
import { parseProfile, type ProfileDocument } from "./model.ts";
import { saveMeasurementEntry, type SaveMeasurementInput } from "./measurement-model.ts";
import { removeDatedEntry, saveWeightEntry, type SaveWeightInput } from "./weight-model.ts";

export const profileStorageKey = "kinevault-track.profile.v1";
export type ProfileSnapshot = DurableSnapshot<ProfileDocument>;
export type ProfileStorage = DurableStorage & {
  removeItem(key: string): Promise<void>;
};

export function createProfilePersistence(storage: ProfileStorage) {
  const { update, remove, ...lifecycle } = createDurableWrite({
    storage,
    key: profileStorageKey,
    parse: parseProfile,
  });
  return {
    ...lifecycle,
    async save(document: ProfileDocument): Promise<boolean> {
      return (
        (await update(
          (current) => ({
            document: {
              ...document,
              // Answer editors cannot replace history captured before a newer log save.
              weightEntries: current.weightEntries,
              bodyMeasurements: current.bodyMeasurements,
            },
            value: true,
          }),
          "Couldn't save your answers. Try again.",
        )) === true
      );
    },
    async saveWeight(input: SaveWeightInput): Promise<boolean> {
      return (
        (await update((document) => {
          try {
            return {
              document: {
                ...document,
                weightEntries: saveWeightEntry(document.weightEntries ?? [], input),
              },
              value: true,
            };
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : "Check your weight and date.",
            };
          }
        }, "Couldn't save your weight. Your values are still here. Try again.")) === true
      );
    },
    async removeWeight(date: string): Promise<boolean> {
      return (
        (await update((document) => {
          try {
            return {
              document: {
                ...document,
                weightEntries: removeDatedEntry(document.weightEntries ?? [], date),
              },
              value: true,
            };
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : "Check your measurement date.",
            };
          }
        }, "Couldn't delete your weight. Your history hasn't changed. Try again.")) === true
      );
    },
    async saveMeasurement(input: SaveMeasurementInput): Promise<boolean> {
      return (
        (await update((document) => {
          try {
            return {
              document: {
                ...document,
                bodyMeasurements: saveMeasurementEntry(document.bodyMeasurements ?? [], input),
              },
              value: true,
            };
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : "Check your measurements and date.",
            };
          }
        }, "Couldn't save your measurements. Your values are still here. Try again.")) === true
      );
    },
    async removeMeasurement(date: string): Promise<boolean> {
      return (
        (await update((document) => {
          try {
            return {
              document: {
                ...document,
                bodyMeasurements: removeDatedEntry(document.bodyMeasurements ?? [], date),
              },
              value: true,
            };
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : "Check your measurement date.",
            };
          }
        }, "Couldn't delete your measurements. Your history hasn't changed. Try again.")) === true
      );
    },
    async reset(): Promise<void> {
      await remove("Couldn't reset your profile. Try again.");
    },
  };
}

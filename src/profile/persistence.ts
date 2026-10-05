import { createDurableWrite, type DurableSnapshot, type DurableStorage } from "../persistence/durable-write.ts";
import { parseProfile, type ProfileDocument } from "./model.ts";

export const profileStorageKey = "kinevault-track.profile.v1";
export type ProfileSnapshot = DurableSnapshot<ProfileDocument>;
export type ProfileStorage = DurableStorage & {
  removeItem(key: string): Promise<void>;
};

export function createProfilePersistence(storage: ProfileStorage) {
  const { update, remove, ...lifecycle } = createDurableWrite({ storage, key: profileStorageKey, parse: parseProfile });
  return {
    ...lifecycle,
    async save(document: ProfileDocument): Promise<boolean> {
      return await update(() => ({ document, value: true }), "Couldn't save your answers. Try again.") === true;
    },
    async reset(): Promise<void> {
      await remove("Couldn't reset your profile. Try again.");
    },
  };
}

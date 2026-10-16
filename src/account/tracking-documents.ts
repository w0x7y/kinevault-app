import { parseProfile } from "../profile/model.ts";
import { profileStorageKey } from "../profile/persistence.ts";
import { parseExerciseDocument } from "../exercise/model.ts";
import { exerciseStorageKey } from "../exercise/persistence.ts";
import { parseFoodLog } from "../food/log-model.ts";
import { foodLogStorageKey } from "../food/log-persistence.ts";
import { parseCustomFoods } from "../food/custom-model.ts";
import { customFoodStorageKey } from "../food/custom-persistence.ts";
import { parseWaterLog } from "../water/model.ts";
import { waterLogStorageKey } from "../water/persistence.ts";
import { parseWaterGoal } from "../water/goal-model.ts";
import { waterGoalStorageKey } from "../water/goal-persistence.ts";

/** One saved Account tracking document, as account storage syncs it and Settings names it. */
export type AccountTrackingDocument = {
  /** The storage key; also the cloud document key. */
  key: string;
  /** Parses a saved payload, throwing when it is invalid. */
  parse(raw: string | null): unknown;
  /** How Settings names the document, e.g. in a Cloud conflict. */
  name: string;
};

/** Every synced Account tracking document, in sync order. Profile media stays on the device. */
export const accountTrackingDocuments: readonly AccountTrackingDocument[] = [
  { key: profileStorageKey, parse: parseProfile, name: "Profile and goals" },
  { key: exerciseStorageKey, parse: parseExerciseDocument, name: "Exercises and workout history" },
  { key: foodLogStorageKey, parse: parseFoodLog, name: "Food log" },
  { key: customFoodStorageKey, parse: parseCustomFoods, name: "Saved foods and meals" },
  { key: waterLogStorageKey, parse: parseWaterLog, name: "Water log" },
  { key: waterGoalStorageKey, parse: parseWaterGoal, name: "Water goal" },
];

export function accountTrackingDocument(key: string): AccountTrackingDocument | undefined {
  return accountTrackingDocuments.find((document) => document.key === key);
}

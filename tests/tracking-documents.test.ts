import assert from "node:assert/strict";
import test from "node:test";
import {
  accountTrackingDocument,
  accountTrackingDocuments,
} from "../src/account/tracking-documents.ts";
import { accountDocumentKeys } from "../src/account/storage.ts";
import { historyKeys } from "../src/account/history-partitions.ts";
import { profileStorageKey } from "../src/profile/persistence.ts";
import { exerciseStorageKey } from "../src/exercise/persistence.ts";
import { foodLogStorageKey } from "../src/food/log-persistence.ts";
import { customFoodStorageKey } from "../src/food/custom-persistence.ts";
import { waterLogStorageKey } from "../src/water/persistence.ts";
import { waterGoalStorageKey } from "../src/water/goal-persistence.ts";

// Saved on devices and in the cloud: these keys must never change.
const persisted = [
  "kinevault-track.profile.v1",
  "kinevault-track.exercise.v1",
  "kinevault-track.food-log.v1",
  "kinevault-track.custom-foods.v1",
  "kinevault-track.water-log.v1",
  "kinevault-track.water-goal.v1",
];

test("Account tracking documents keep their persisted keys, in sync order", () => {
  const keys = accountTrackingDocuments.map((document) => document.key);
  assert.deepEqual(keys, persisted);
  assert.deepEqual(keys, [
    profileStorageKey,
    exerciseStorageKey,
    foodLogStorageKey,
    customFoodStorageKey,
    waterLogStorageKey,
    waterGoalStorageKey,
  ]);
  assert.deepEqual(accountDocumentKeys, persisted);
  assert.deepEqual(historyKeys, ["kinevault-track.food-log.v1", "kinevault-track.exercise.v1"]);
});

test("Settings names each Account tracking document by its key", () => {
  assert.deepEqual(
    persisted.map((key) => accountTrackingDocument(key)?.name),
    [
      "Profile and goals",
      "Exercises and workout history",
      "Food log",
      "Saved foods and meals",
      "Water log",
      "Water goal",
    ],
  );
  assert.equal(accountTrackingDocument("kinevault-track.profile-media.v1"), undefined);
});

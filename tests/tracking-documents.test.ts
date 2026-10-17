import assert from "node:assert/strict";
import test from "node:test";
import { accountTrackingDocuments } from "../src/account/tracking-documents.ts";
import { accountDocumentKeys } from "../src/account/storage.ts";
import { historyKeys } from "../src/account/history-partitions.ts";

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
  assert.deepEqual(accountDocumentKeys, persisted);
  assert.deepEqual(historyKeys, ["kinevault-track.food-log.v1", "kinevault-track.exercise.v1"]);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseDefinition } from "../src/exercise/model.ts";
import type { CatalogExercise } from "../src/exercise/demo/catalog.ts";
import type { DemoCatalogState } from "../src/exercise/demo/catalog-store.ts";
import {
  applyCatalogLink,
  demoStatus,
  resolveDemoLink,
  withoutCatalogLink,
} from "../src/exercise/demo/demo-link.ts";

const pressId = "3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192";
const link = { id: pressId, slug: "dumbbell-shoulder-press" };
const entry: CatalogExercise = {
  id: pressId,
  slug: "dumbbell-shoulder-press",
  name: "Dumbbell shoulder press",
  aliases: [],
  muscleGroup: "Shoulders",
  equipment: "Dumbbell",
  status: "published",
  videoPath: `${pressId}/0123456789abcdef.mp4`,
  posterPath: `${pressId}/fedcba9876543210.webp`,
  credit: "Demonstration: KineVault.",
};
const ready = (entries: CatalogExercise[]): DemoCatalogState => ({
  kind: "ready",
  entries,
  byId: new Map(entries.map((item) => [item.id, item])),
  fetchedAt: 0,
});
const base: ExerciseDefinition = {
  id: "press",
  name: "Press",
  muscleGroup: "",
  equipment: "",
  notes: "",
  tracking: "single",
};

test("the library's current link wins over the saved copy", () => {
  const linkedSnapshot = { ...base, catalog: link };
  assert.deepEqual(resolveDemoLink([{ ...base, catalog: link }], base), link);
  assert.equal(resolveDemoLink([base], linkedSnapshot), null);
  assert.deepEqual(resolveDemoLink([], linkedSnapshot), link);
  assert.equal(resolveDemoLink([], base), null);
});

test("player status follows the catalog and media state", () => {
  const status = (state: DemoCatalogState, mediaFailed = false, offline = false) =>
    demoStatus({ state, link, mediaFailed, offline }).kind;
  assert.equal(status({ kind: "loading" }), "loading");
  assert.equal(status({ kind: "failed" }), "connect");
  assert.equal(status(ready([])), "unavailable");
  assert.equal(
    status(ready([{ ...entry, status: "withdrawn", videoPath: null, posterPath: null }])),
    "unavailable",
  );
  assert.equal(status(ready([entry])), "ready");
  assert.deepEqual(demoStatus({ state: ready([entry]), link, mediaFailed: true, offline: true }), {
    kind: "failed",
    offline: true,
  });
  const result = demoStatus({ state: ready([entry]), link, mediaFailed: false, offline: false });
  assert.equal(result.kind === "ready" && result.videoPath, entry.videoPath);
});

test("linking fills only blank fields; unlinking removes the link", () => {
  const typed = {
    name: "Overhead press",
    muscleGroup: "  ",
    equipment: "Bench",
    notes: "",
    tracking: "single" as const,
  };
  const linked = applyCatalogLink(typed, entry);
  assert.deepEqual(linked, { ...typed, catalog: link, muscleGroup: "Shoulders" });
  const unlinked = withoutCatalogLink(linked);
  assert.equal("catalog" in unlinked, false);
  assert.equal(unlinked.name, "Overhead press");
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseDefinition } from "../src/exercise/model.ts";
import type { CatalogExercise } from "../src/exercise/demo/catalog.ts";
import type { DemoCatalogState } from "../src/exercise/demo/catalog-store.ts";
import {
  applyCatalogLink,
  demoNotice,
  demoPlayback,
  demoStatus,
  initialDemoPlayback,
  resolveDemoLink,
  withoutCatalogLink,
  type DemoPlayback,
  type DemoPlaybackEvent,
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
  assert.equal(status({ kind: "failed" }, false, true), "connect");
  assert.equal(status({ kind: "failed" }, false, false), "catalog-unavailable");
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

test("the notice names each status and what Retry retries", () => {
  const connect = "Connect to load this demonstration.";
  assert.deepEqual(demoNotice(null), { text: "Demonstration unavailable." });
  assert.deepEqual(demoNotice({ kind: "unavailable" }), { text: "Demonstration unavailable." });
  assert.deepEqual(demoNotice({ kind: "loading" }), { text: "Loading demonstration." });
  assert.deepEqual(demoNotice({ kind: "connect" }), { text: connect, retry: "catalog" });
  assert.deepEqual(demoNotice({ kind: "catalog-unavailable" }), {
    text: "KineVault demos aren't available right now. Try again later.",
    retry: "catalog",
  });
  // Offline, a failed clip reads like a failed catalog but retries the clip.
  assert.deepEqual(demoNotice({ kind: "failed", offline: true }), {
    text: connect,
    retry: "media",
  });
  assert.deepEqual(demoNotice({ kind: "failed", offline: false }), {
    text: "Couldn't load this demonstration. Check your connection and try again.",
    retry: "media",
  });
  const status = demoStatus({ state: ready([entry]), link, mediaFailed: false, offline: false });
  assert.equal(demoNotice(status), null);
});

const play = (...events: DemoPlaybackEvent[]): DemoPlayback =>
  events.reduce(demoPlayback, initialDemoPlayback);

test("a tapped clip starts from the poster and plays once ready", () => {
  assert.deepEqual(initialDemoPlayback, { phase: "poster", failed: false, attempt: 0 });
  assert.equal(play("play").phase, "starting");
  assert.equal(play("play", "started").phase, "playing");
  // A clip that is already playing ignores another tap and a repeated start.
  assert.equal(play("play", "started", "play", "started").phase, "playing");
  assert.equal(play("started").phase, "poster");
});

test("a clip that never starts fails on the timeout; one that started doesn't", () => {
  assert.equal(play("play", "timed-out").failed, true);
  assert.equal(play("play", "started", "timed-out").failed, false);
  assert.equal(play("timed-out").failed, false);
  // A player or poster error fails the media whether or not the clip started.
  assert.equal(play("failed").failed, true);
  assert.equal(play("play", "started", "failed").failed, true);
  const failed = play("play", "timed-out");
  assert.equal(demoPlayback(failed, "failed"), failed);
  assert.equal(demoPlayback(failed, "timed-out"), failed);
});

test("leaving the screen returns to the poster and keeps a failure", () => {
  assert.equal(play("play", "started", "blurred").phase, "poster");
  assert.equal(play("play", "blurred", "timed-out").failed, false);
  assert.deepEqual(play("play", "failed", "blurred"), {
    phase: "poster",
    failed: true,
    attempt: 0,
  });
  assert.equal(demoPlayback(initialDemoPlayback, "blurred"), initialDemoPlayback);
});

test("retry clears the failure and remounts the media from the poster", () => {
  assert.deepEqual(play("play", "started", "failed", "retry"), {
    phase: "poster",
    failed: false,
    attempt: 1,
  });
  assert.equal(play("failed", "retry", "failed", "retry").attempt, 2);
  const retried = play("play", "timed-out", "retry", "play");
  assert.deepEqual(retried, { phase: "starting", failed: false, attempt: 1 });
  assert.equal(demoPlayback(retried, "timed-out").failed, true);
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

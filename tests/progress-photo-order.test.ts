import assert from "node:assert/strict";
import test from "node:test";
import type { ProgressPhoto } from "../src/profile/media-model.ts";
import { progressPhotoTimeline } from "../src/profile/progress-photo-order.ts";

function photo(id: string, date: string): ProgressPhoto {
  return {
    id, date, note: "",
    image: { id: `image-${id}`, width: 100, height: 100 },
  };
}

test("timeline compares the earliest and latest dates across the entire saved gallery", () => {
  const saved = [
    photo("middle", "2026-05-01"),
    photo("latest", "2026-10-01"),
    photo("first", "2025-12-31"),
    photo("between", "2026-08-01"),
  ];
  const original = [...saved];
  const timeline = progressPhotoTimeline(saved);
  assert.deepEqual(timeline.photos.map(({ id }) => id), ["first", "middle", "between", "latest"]);
  assert.equal(timeline.first, saved[2]);
  assert.equal(timeline.latest, saved[1]);
  assert.deepEqual(saved, original);
});

test("same-day entries have a stable ID tie-break independent of saved order", () => {
  const saved = [photo("z", "2026-10-01"), photo("a", "2026-10-01"), photo("m", "2026-10-01")];
  for (const order of [saved, [...saved].reverse()]) {
    const timeline = progressPhotoTimeline(order);
    assert.deepEqual(timeline.photos.map(({ id }) => id), ["a", "m", "z"]);
    assert.equal(timeline.first?.id, "a");
    assert.equal(timeline.latest?.id, "z");
  }
});

test("empty and single-photo galleries keep their truthful comparison endpoints", () => {
  assert.deepEqual(progressPhotoTimeline([]), { photos: [], first: undefined, latest: undefined });
  const only = photo("only", "2026-10-01");
  assert.deepEqual(progressPhotoTimeline([only]), { photos: [only], first: only, latest: only });
});

test("date edits and removal recompute both endpoints from the current gallery", () => {
  const first = photo("first", "2026-01-01"),
    middle = photo("middle", "2026-05-01"),
    latest = photo("latest", "2026-10-01");
  const edited = { ...middle, date: "2025-12-31" };
  assert.equal(progressPhotoTimeline([first, edited, latest]).first, edited);
  const afterRemoval = progressPhotoTimeline([first, edited]);
  assert.equal(afterRemoval.first, edited);
  assert.equal(afterRemoval.latest, first);
});

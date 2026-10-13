import assert from "node:assert/strict";
import test from "node:test";
import {
  anatomyCredit,
  buildSourceExercises,
  checkMedia,
  demoCredit,
  mediaPath,
  planCatalogPublish,
  publishCatalog,
} from "./publish-catalog.mjs";

const press = "3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192";
const raise = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const retired = "11111111-2222-4333-8444-555555555555";
const mp4 = (fill) => Uint8Array.from([0, 0, 0, 24, ...Buffer.from("ftypisom"), fill]);
const webp = (fill) =>
  Uint8Array.from([...Buffer.from("RIFF"), 4, 0, 0, 0, ...Buffer.from("WEBP"), fill]);
function media(content, group, kind, extra = {}) {
  return {
    content_id: content,
    scene_id: "scene-press",
    asset_group_id: group,
    kind,
    storage_bucket: "exercise-public",
    storage_path: `submissions/${group}/demo.${kind === "poster" ? "webp" : kind}`,
    camera_angle: "front",
    character_presentation: "neutral",
    license_name: "CC BY-SA 4.0",
    source_credit: null,
    created_at: "2026-10-05T10:00:00Z",
    ...extra,
  };
}
function raw() {
  return {
    exercises: [
      {
        id: press,
        slug: "dumbbell-shoulder-press",
        status: "published",
        current_content_id: "content-press",
        published_at: "2026-10-05T10:00:00+00:00",
      },
      {
        id: raise,
        slug: "cable-lateral-raise",
        status: "published",
        current_content_id: "content-raise",
        published_at: null,
      },
    ],
    contents: [
      { id: "content-press", name: "Dumbbell shoulder press" },
      { id: "content-raise", name: "Cable lateral raise" },
    ],
    aliases: [
      { content_id: "content-press", alias: "DB overhead press" },
      { content_id: "content-press", alias: "dumbbell shoulder press" },
      { content_id: "content-press", alias: " DB overhead press " },
    ],
    exerciseMuscles: [
      { content_id: "content-press", muscle_id: "anterior-deltoid", role: "primary" },
      { content_id: "content-press", muscle_id: "lateral-deltoid", role: "primary" },
      { content_id: "content-press", muscle_id: "triceps", role: "secondary" },
    ],
    muscles: [
      { id: "shoulders", name: "Shoulders", parent_id: null },
      { id: "anterior-deltoid", name: "Anterior deltoid", parent_id: "shoulders" },
      { id: "lateral-deltoid", name: "Lateral deltoid", parent_id: "shoulders" },
      { id: "triceps", name: "Triceps", parent_id: null },
    ],
    exerciseEquipment: [
      { content_id: "content-press", equipment_id: "dumbbell", role: "required" },
      { content_id: "content-press", equipment_id: "bench", role: "optional" },
    ],
    equipment: [
      { id: "dumbbell", name: "Dumbbell" },
      { id: "bench", name: "Bench" },
    ],
    scenes: [{ id: "scene-press", content_id: "content-press", default_camera_angle: "side" }],
    media: [
      media("content-press", "group-front", "mp4"),
      media("content-press", "group-front", "poster"),
      media("content-press", "group-side", "mp4", {
        camera_angle: "side",
        created_at: "2026-10-01T10:00:00Z",
      }),
      media("content-press", "group-side", "poster", { camera_angle: "side" }),
      media("content-raise", "group-raise", "mp4"),
    ],
    replacements: [
      {
        storage_bucket: "exercise-public",
        original_path: "submissions/group-side/demo.mp4",
        replacement_path: "submissions/group-side/z-anatomy-v7/demo.mp4",
        license_name: "CC BY-SA 4.0",
        source_credit: "Z-Anatomy — Gauthier Kervyn and contributors",
        created_at: "2026-10-06T10:00:00Z",
      },
      {
        storage_bucket: "exercise-public",
        original_path: "submissions/group-side/demo.mp4",
        replacement_path: "submissions/group-side/z-anatomy-v8/demo.mp4",
        license_name: "CC BY-SA 4.0",
        source_credit: "Z-Anatomy — Gauthier Kervyn and contributors",
        created_at: "2026-10-07T10:00:00Z",
      },
    ],
  };
}

test("published exercises use the default-angle render, newest replacement and top-level muscles", () => {
  const { sources, skipped } = buildSourceExercises(raw());
  assert.deepEqual(sources, [
    {
      id: press,
      slug: "dumbbell-shoulder-press",
      name: "Dumbbell shoulder press",
      aliases: ["DB overhead press"],
      muscleGroup: "Shoulders",
      equipment: "Dumbbell",
      publishedAt: "2026-10-05T10:00:00+00:00",
      video: { bucket: "exercise-public", path: "submissions/group-side/z-anatomy-v8/demo.mp4" },
      poster: { bucket: "exercise-public", path: "submissions/group-side/demo.webp" },
      credit:
        "Demonstration: KineVault. Z-Anatomy — Gauthier Kervyn and contributors. License: CC BY-SA 4.0.",
    },
  ]);
  assert.deepEqual(skipped, [
    { slug: "cable-lateral-raise", reason: "no complete MP4 and poster" },
  ]);
});

test("credits add the anatomy notice when the source credit lacks it", () => {
  assert.equal(
    demoCredit({ licenseName: "CC BY-SA 4.0", sourceCredit: null }),
    `Demonstration: KineVault. ${anatomyCredit} License: CC BY-SA 4.0.`,
  );
});

test("media checks accept MP4 and WebP and reject anything else", () => {
  checkMedia(mp4(1), "video");
  checkMedia(webp(1), "poster");
  assert.throws(() => checkMedia(webp(1), "video"), /MP4/);
  assert.throws(() => checkMedia(mp4(1), "poster"), /WebP/);
  assert.throws(() => checkMedia(new Uint8Array(), "video"), /size/);
  assert.throws(() => checkMedia(new Uint8Array(10 * 1024 * 1024 + 1), "video"), /size/);
});

test("media paths are content addressed under the exercise ID", () => {
  assert.equal(mediaPath(press, mp4(1), "mp4"), mediaPath(press, mp4(1), "mp4"));
  assert.notEqual(mediaPath(press, mp4(1), "mp4"), mediaPath(press, mp4(2), "mp4"));
  assert.match(mediaPath(press, mp4(1), "mp4"), new RegExp(`^${press}/[0-9a-f]{16}\\.mp4$`));
});

const located = {
  id: press,
  slug: "dumbbell-shoulder-press",
  name: "Dumbbell shoulder press",
  aliases: [],
  muscleGroup: "Shoulders",
  equipment: "Dumbbell",
  publishedAt: "2026-10-05T10:00:00.000Z",
  credit: "Demonstration: KineVault.",
  videoPath: `${press}/0123456789abcdef.mp4`,
  posterPath: `${press}/fedcba9876543210.webp`,
};
const stored = {
  id: press,
  slug: "dumbbell-shoulder-press",
  name: "Dumbbell shoulder press",
  aliases: [],
  muscle_group: "Shoulders",
  equipment: "Dumbbell",
  status: "published",
  video_path: located.videoPath,
  poster_path: located.posterPath,
  credit: "Demonstration: KineVault.",
  published_at: "2026-10-05T10:00:00+00:00",
};

test("the plan writes new or changed rows and withdraws rows KineVault no longer publishes", () => {
  const now = "2026-10-13T12:00:00.000Z";
  assert.deepEqual(planCatalogPublish({ sources: [located], current: [stored], now }), {
    upserts: [],
    withdrawals: [],
  });
  const renamed = planCatalogPublish({
    sources: [{ ...located, name: "DB shoulder press" }],
    current: [stored],
    now,
  });
  assert.deepEqual(
    renamed.upserts.map((row) => [row.name, row.updated_at]),
    [["DB shoulder press", now]],
  );
  const fresh = planCatalogPublish({ sources: [located], current: [], now });
  assert.equal(fresh.upserts[0].status, "published");
  const withdrawn = {
    ...stored,
    id: retired,
    slug: "old",
    status: "withdrawn",
    video_path: null,
    poster_path: null,
  };
  const gone = planCatalogPublish({
    sources: [],
    current: [stored, withdrawn],
    now,
  });
  assert.deepEqual(gone, { upserts: [], withdrawals: [press] });
});

function ports({ current = [], existing = [] } = {}) {
  const calls = [];
  return {
    calls,
    kinevault: {
      readRaw: async () => raw(),
      download: async ({ path }) => (path.endsWith(".webp") ? webp(path.length) : mp4(path.length)),
    },
    track: {
      readRows: async () => current,
      listObjects: async () => new Set(existing),
      upload: async (file) => calls.push(["upload", file.path, file.contentType]),
      upsertRows: async (rows) => calls.push(["upsert", rows.map((row) => row.slug)]),
      withdraw: async (ids) => calls.push(["withdraw", ids]),
    },
  };
}

test("a dry run writes nothing and reports the plan", async () => {
  const fake = ports();
  const logs = [];
  const result = await publishCatalog({
    ...fake,
    apply: false,
    now: () => "now",
    log: (text) => logs.push(text),
  });
  assert.deepEqual(fake.calls, []);
  assert.equal(result.plan.upserts.length, 1);
  assert.equal(result.uploads.length, 2);
  assert.match(logs[0], /^Dry run: 1 catalog rows to write, 0 to withdraw, 2 files to upload\./);
  assert.match(logs[0], /skip cable-lateral-raise: no complete MP4 and poster/);
  assert.match(logs[0], /Nothing was written/);
});

test("applying uploads missing files first, then rows, then withdrawals", async () => {
  const video = mediaPath(press, mp4("submissions/group-side/z-anatomy-v8/demo.mp4".length), "mp4");
  const poster = mediaPath(press, webp("submissions/group-side/demo.webp".length), "webp");
  const fake = ports({
    current: [{ ...stored, id: retired, slug: "retired" }],
    existing: [poster],
  });
  await publishCatalog({ ...fake, apply: true, now: () => "now", log: () => {} });
  assert.deepEqual(fake.calls, [
    ["upload", video, "video/mp4"],
    ["upsert", ["dumbbell-shoulder-press"]],
    ["withdraw", [retired]],
  ]);
});

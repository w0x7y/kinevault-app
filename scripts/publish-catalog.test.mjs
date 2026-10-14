import assert from "node:assert/strict";
import test from "node:test";
import {
  anatomyCredit,
  buildSourceExercises,
  checkMedia,
  demoCredit,
  describePlan,
  mediaPath,
  planCatalogPublish,
  publishCatalog,
  readAll,
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
      credit: `Demonstration: KineVault. Z-Anatomy — Gauthier Kervyn and contributors. License: CC BY-SA 4.0. ${anatomyCredit}`,
    },
  ]);
  assert.deepEqual(skipped, [
    { slug: "cable-lateral-raise", reason: "no complete MP4 and poster" },
  ]);
});

test("credits put the source credit and license before the anatomy notice", () => {
  assert.equal(
    demoCredit({ licenseName: "CC BY-SA 4.0", sourceCredit: null }),
    `Demonstration: KineVault. License: CC BY-SA 4.0. ${anatomyCredit}`,
  );
  assert.equal(
    demoCredit({ licenseName: null, sourceCredit: "Rendered by the KineVault studio" }),
    `Demonstration: KineVault. Rendered by the KineVault studio. ${anatomyCredit}`,
  );
  assert.equal(
    demoCredit({ licenseName: "CC BY-SA 4.0", sourceCredit: "Z-Anatomy — Gauthier Kervyn." }),
    `Demonstration: KineVault. Z-Anatomy — Gauthier Kervyn. License: CC BY-SA 4.0. ${anatomyCredit}`,
  );
});

test("credits omit the anatomy notice only when the source credit names both anatomy sources", () => {
  const sourceCredit =
    "Z-Anatomy — Gauthier Kervyn and contributors; BodyParts3D © The Database Center for Life Science (CC BY-SA 2.1 Japan). Adapted geometry, materials and posing.";
  assert.equal(
    demoCredit({ licenseName: "CC BY-SA 4.0", sourceCredit }),
    `Demonstration: KineVault. ${sourceCredit} License: CC BY-SA 4.0.`,
  );
  assert.equal(
    demoCredit({ licenseName: "CC BY-SA 4.0", sourceCredit: "BodyParts3D © DBCLS" }),
    `Demonstration: KineVault. BodyParts3D © DBCLS. License: CC BY-SA 4.0. ${anatomyCredit}`,
  );
});

test("aliases are cut to fifty in a stable order", () => {
  const source = raw();
  source.aliases = Array.from({ length: 60 }, (_, index) => ({
    content_id: "content-press",
    alias: `Alias ${String(59 - index).padStart(2, "0")}`,
  }));
  const [press] = buildSourceExercises(source).sources;
  assert.equal(press.aliases.length, 50);
  assert.deepEqual(press.aliases.slice(0, 2), ["Alias 00", "Alias 01"]);
  assert.equal(press.aliases.at(-1), "Alias 49");
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

test("the plan inserts new rows, updates changed rows and withdraws rows KineVault no longer publishes", () => {
  const now = "2026-10-13T12:00:00.000Z";
  assert.deepEqual(planCatalogPublish({ sources: [located], current: [stored], now }), {
    inserts: [],
    updates: [],
    withdrawals: [],
  });
  const renamed = planCatalogPublish({
    sources: [{ ...located, name: "DB shoulder press" }],
    current: [stored],
    now,
  });
  assert.deepEqual(renamed.inserts, []);
  assert.deepEqual(
    renamed.updates.map((row) => [row.name, row.updated_at]),
    [["DB shoulder press", now]],
  );
  const fresh = planCatalogPublish({ sources: [located], current: [], now });
  assert.deepEqual(fresh.updates, []);
  assert.equal(fresh.inserts[0].status, "published");
  const republished = planCatalogPublish({
    sources: [located],
    current: [{ ...stored, status: "withdrawn" }],
    now,
  });
  assert.deepEqual(republished.inserts, []);
  assert.deepEqual(
    republished.updates.map((row) => row.status),
    ["published"],
  );
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
  assert.deepEqual(gone, {
    inserts: [],
    updates: [],
    withdrawals: [{ id: press, slug: "dumbbell-shoulder-press" }],
  });
});

test("the plan leaves a row alone while KineVault still publishes its exercise", () => {
  const now = "2026-10-13T12:00:00.000Z";
  assert.deepEqual(
    planCatalogPublish({ sources: [], current: [stored], now, publishedIds: new Set([press]) }),
    { inserts: [], updates: [], withdrawals: [] },
  );
});

test("the report names inserts, updates, withdrawals, uploads and skips", () => {
  const plan = {
    inserts: [{ slug: "new-one" }],
    updates: [{ slug: "changed-one" }],
    withdrawals: [{ id: retired, slug: "gone-one" }],
  };
  const uploads = [{ path: `${press}/0123456789abcdef.mp4`, bytes: new Uint8Array(3) }];
  const skipped = [{ slug: "unfinished", reason: "no complete MP4 and poster" }];
  assert.equal(
    describePlan({ plan, uploads, skipped, apply: true }),
    [
      "Publishing: 1 rows to insert, 1 to update, 1 to withdraw, 1 files to upload.",
      "  insert new-one",
      "  update changed-one",
      "  withdraw gone-one",
      `  upload ${press}/0123456789abcdef.mp4 (3 bytes)`,
      "  skip unfinished: no complete MP4 and poster",
    ].join("\n"),
  );
});

function ports({ current = [], existing = [], source = raw() } = {}) {
  const calls = [];
  return {
    calls,
    kinevault: {
      readRaw: async () => source,
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
  assert.equal(result.plan.inserts.length, 1);
  assert.equal(result.plan.updates.length, 0);
  assert.equal(result.uploads.length, 2);
  assert.match(
    logs[0],
    /^Dry run: 1 rows to insert, 0 to update, 0 to withdraw, 2 files to upload\./,
  );
  assert.match(logs[0], /insert dumbbell-shoulder-press/);
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

test("applying writes inserts then updates in one call", async () => {
  const source = raw();
  source.media.push(media("content-raise", "group-raise", "poster", { scene_id: "scene-raise" }));
  const fake = ports({ current: [{ ...stored, name: "Old name" }], source });
  await publishCatalog({ ...fake, apply: true, now: () => "now", log: () => {} });
  assert.deepEqual(
    fake.calls.filter(([kind]) => kind !== "upload"),
    [["upsert", ["cable-lateral-raise", "dumbbell-shoulder-press"]]],
  );
});

test("an exercise KineVault still publishes but skips keeps its Track row", async () => {
  const source = raw();
  source.media = source.media.filter((item) => item.content_id !== "content-press");
  const fake = ports({ current: [stored], source });
  const logs = [];
  const result = await publishCatalog({
    ...fake,
    apply: true,
    now: () => "now",
    log: (text) => logs.push(text),
  });
  assert.deepEqual(fake.calls, []);
  assert.deepEqual(result.plan, { inserts: [], updates: [], withdrawals: [] });
  assert.match(logs[0], /skip dumbbell-shoulder-press: no complete MP4 and poster/);
});

test("an empty KineVault read never withdraws the Track catalog", async () => {
  const source = { ...raw(), exercises: [] };
  for (const apply of [false, true]) {
    const fake = ports({ current: [stored], source });
    const logs = [];
    await assert.rejects(
      publishCatalog({ ...fake, apply, now: () => "now", log: (text) => logs.push(text) }),
      /KineVault reports no published exercises; refusing to withdraw every Track demo/,
    );
    assert.deepEqual(fake.calls, []);
    assert.deepEqual(logs, []);
  }
});

test("an empty KineVault read is fine while Track has nothing published", async () => {
  const source = { ...raw(), exercises: [] };
  const fake = ports({ current: [{ ...stored, status: "withdrawn" }], source });
  const result = await publishCatalog({ ...fake, apply: true, now: () => "now", log: () => {} });
  assert.deepEqual(fake.calls, []);
  assert.deepEqual(result.plan, { inserts: [], updates: [], withdrawals: [] });
});

function fakeTable(rows, cap) {
  const ranges = [];
  return {
    ranges,
    build: () => ({
      range: async (from, to) => {
        ranges.push([from, to]);
        return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null };
      },
    }),
  };
}

test("paging reads every row even when the server caps a page below the page size", async () => {
  const rows = Array.from({ length: 7 }, (_, index) => ({ id: index }));
  const table = fakeTable(rows, 3);
  assert.deepEqual(await readAll(table.build, "widgets"), rows);
  assert.deepEqual(table.ranges, [
    [0, 999],
    [3, 1002],
    [6, 1005],
    [7, 1006],
  ]);
});

test("paging stops on the first empty page", async () => {
  const empty = fakeTable([], 1000);
  assert.deepEqual(await readAll(empty.build, "widgets"), []);
  assert.equal(empty.ranges.length, 1);
  const rows = Array.from({ length: 1000 }, (_, index) => ({ id: index }));
  const full = fakeTable(rows, 1000);
  assert.equal((await readAll(full.build, "widgets")).length, 1000);
  assert.deepEqual(full.ranges, [
    [0, 999],
    [1000, 1999],
  ]);
});

test("a failed page names what couldn't be read", async () => {
  const build = () => ({ range: async () => ({ data: null, error: { message: "boom" } }) });
  await assert.rejects(readAll(build, "widgets"), /Couldn't read widgets: boom/);
});

test("a slug held by another Track row stops the run before any write", async () => {
  const clash = { ...stored, id: retired };
  for (const apply of [false, true]) {
    const fake = ports({ current: [clash] });
    const logs = [];
    let downloads = 0;
    const download = fake.kinevault.download;
    fake.kinevault.download = async (item) => {
      downloads++;
      return download(item);
    };
    await assert.rejects(
      publishCatalog({ ...fake, apply, now: () => "now", log: (text) => logs.push(text) }),
      (error) => {
        assert.match(error.message, /dumbbell-shoulder-press/);
        assert.ok(error.message.includes(press), "names the KineVault exercise ID");
        assert.ok(error.message.includes(retired), "names the Track row ID");
        return true;
      },
    );
    assert.deepEqual(fake.calls, []);
    assert.deepEqual(logs, []);
    assert.equal(downloads, 0);
  }
});

test("a Track row that holds the slug under the same ID is not a conflict", async () => {
  for (const current of [[stored], [{ ...stored, status: "withdrawn" }]]) {
    const fake = ports({ current });
    await publishCatalog({ ...fake, apply: true, now: () => "now", log: () => {} });
  }
});

test("a withdrawn Track row still holds its slug", async () => {
  const fake = ports({ current: [{ ...stored, id: retired, status: "withdrawn" }] });
  await assert.rejects(
    publishCatalog({ ...fake, apply: true, now: () => "now", log: () => {} }),
    /dumbbell-shoulder-press/,
  );
  assert.deepEqual(fake.calls, []);
});

function twoExercises() {
  const source = raw();
  source.media.push(media("content-raise", "group-raise", "poster", { scene_id: "scene-raise" }));
  return source;
}

test("a download failure for one exercise writes nothing", async () => {
  for (const apply of [false, true]) {
    const fake = ports({ source: twoExercises() });
    const download = fake.kinevault.download;
    fake.kinevault.download = async (item) => {
      if (item.path.includes("group-raise")) throw new Error("Couldn't download raise");
      return download(item);
    };
    const logs = [];
    await assert.rejects(
      publishCatalog({ ...fake, apply, now: () => "now", log: (text) => logs.push(text) }),
      /Couldn't download raise/,
    );
    assert.deepEqual(fake.calls, []);
    assert.deepEqual(logs, []);
  }
});

test("a media format failure for one exercise writes nothing", async () => {
  for (const [name, bytes, message] of [
    ["demo.mp4", webp(1), /not an MP4/],
    ["demo.webp", mp4(1), /not a WebP/],
    ["demo.mp4", new Uint8Array(), /size/],
  ]) {
    const fake = ports({ source: twoExercises() });
    const download = fake.kinevault.download;
    fake.kinevault.download = async (item) =>
      item.path.includes("group-raise") && item.path.endsWith(name) ? bytes : download(item);
    const logs = [];
    await assert.rejects(
      publishCatalog({ ...fake, apply: true, now: () => "now", log: (text) => logs.push(text) }),
      message,
    );
    assert.deepEqual(fake.calls, []);
    assert.deepEqual(logs, []);
  }
});

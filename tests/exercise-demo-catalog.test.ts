import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalogRow, parseCatalogRows } from "../src/exercise/demo/catalog.ts";
import { demoCatalogConfigFrom, demoObjectUrl } from "../src/exercise/demo/config.ts";

const id = "3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192";
const row = {
  id,
  slug: "dumbbell-shoulder-press",
  name: "Dumbbell shoulder press",
  aliases: ["DB overhead press"],
  muscle_group: "Shoulders",
  equipment: "Dumbbell",
  status: "published",
  video_path: `${id}/0123456789abcdef.mp4`,
  poster_path: `${id}/fedcba9876543210.webp`,
  credit: "Demonstration: KineVault.",
};

test("a published row becomes a catalog exercise", () => {
  assert.deepEqual(parseCatalogRow(row), {
    id,
    slug: "dumbbell-shoulder-press",
    name: "Dumbbell shoulder press",
    aliases: ["DB overhead press"],
    muscleGroup: "Shoulders",
    equipment: "Dumbbell",
    status: "published",
    videoPath: `${id}/0123456789abcdef.mp4`,
    posterPath: `${id}/fedcba9876543210.webp`,
    credit: "Demonstration: KineVault.",
  });
});

test("withdrawn rows may lack media; published rows may not", () => {
  const withdrawn = parseCatalogRow({
    ...row,
    status: "withdrawn",
    video_path: null,
    poster_path: null,
  });
  assert.equal(withdrawn.videoPath, null);
  assert.throws(() => parseCatalogRow({ ...row, poster_path: null }), /media/);
});

test("media must live under the row's own ID with the right extension", () => {
  const other = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
  assert.throws(() => parseCatalogRow({ ...row, video_path: `${other}/0123456789abcdef.mp4` }));
  assert.throws(() => parseCatalogRow({ ...row, video_path: `${id}/0123456789abcdef.webm` }));
  assert.throws(() => parseCatalogRow({ ...row, poster_path: `${id}/../x/fedcba9876543210.webp` }));
});

test("bad aliases are dropped and at most 50 are kept", () => {
  const aliases = [
    "",
    "  ",
    7,
    "x".repeat(401),
    ...Array.from({ length: 60 }, (_, i) => `alias ${i}`),
  ];
  const parsed = parseCatalogRow({ ...row, aliases });
  assert.equal(parsed.aliases.length, 50);
  assert.equal(parsed.aliases[0], "alias 0");
});

test("one invalid row is dropped without hiding the others", () => {
  const rows = parseCatalogRows([row, { ...row, id: "bad" }, { ...row, slug: "Bad Slug" }]);
  assert.deepEqual(
    rows.map((entry) => entry.id),
    [id],
  );
  assert.throws(() => parseCatalogRows({ rows: [] }), /response/);
});

test("demo config accepts HTTPS or local HTTP and keeps only the origin", () => {
  assert.deepEqual(demoCatalogConfigFrom(" https://abc.supabase.co/ ", " key "), {
    url: "https://abc.supabase.co",
    key: "key",
  });
  assert.deepEqual(
    demoCatalogConfigFrom("http://127.0.0.1:54321", "key")?.url,
    "http://127.0.0.1:54321",
  );
  assert.equal(demoCatalogConfigFrom("http://abc.supabase.co", "key"), null);
  assert.equal(demoCatalogConfigFrom("https://abc.supabase.co", ""), null);
  assert.equal(demoCatalogConfigFrom(undefined, "key"), null);
  assert.equal(demoCatalogConfigFrom("not a url", "key"), null);
});

test("public object URLs point at the demo bucket", () => {
  assert.equal(
    demoObjectUrl({ url: "https://abc.supabase.co", key: "key" }, `${id}/0123456789abcdef.mp4`),
    `https://abc.supabase.co/storage/v1/object/public/exercise-demos/${id}/0123456789abcdef.mp4`,
  );
});

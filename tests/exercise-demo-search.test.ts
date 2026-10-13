import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogExercise } from "../src/exercise/demo/catalog.ts";
import { createDemoCatalogSearch, demoSearchWords } from "../src/exercise/demo/catalog-search.ts";

let next = 0;
function entry(name: string, extra: Partial<CatalogExercise> = {}): CatalogExercise {
  const id = `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
  return {
    id,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    aliases: [],
    muscleGroup: "",
    equipment: "",
    status: "published",
    videoPath: `${id}/0123456789abcdef.mp4`,
    posterPath: `${id}/fedcba9876543210.webp`,
    credit: "Demonstration: KineVault.",
    ...extra,
  };
}
const curl = entry("Curl");
const dumbbellCurl = entry("Dumbbell curl");
const press = entry("Dumbbell shoulder press", { aliases: ["DB overhead press"] });
const developpe = entry("Développé couché");
const withdrawn = entry("Cable lateral raise", {
  status: "withdrawn",
  videoPath: null,
  posterPath: null,
});
const search = createDemoCatalogSearch([dumbbellCurl, press, developpe, withdrawn, curl]);
const names = (query: string, limit?: number) => search(query, limit).map((item) => item.name);

test("words are accent-folded, lowercased and singular", () => {
  assert.deepEqual(demoSearchWords("Développé Couchés"), ["developpe", "couche"]);
  assert.deepEqual(demoSearchWords("Press"), ["press"]);
  assert.deepEqual(demoSearchWords("  "), []);
});

test("an exact name ranks before a prefix match", () => {
  assert.deepEqual(names("curls"), ["Curl", "Dumbbell curl"]);
});

test("aliases and word prefixes in any order match", () => {
  assert.deepEqual(names("overhead"), ["Dumbbell shoulder press"]);
  assert.deepEqual(names("press sho"), ["Dumbbell shoulder press"]);
  assert.deepEqual(names("developpe"), ["Développé couché"]);
});

test("one typo is allowed only in words of five or more letters", () => {
  assert.deepEqual(names("sholder"), ["Dumbbell shoulder press"]);
  assert.deepEqual(names("crul"), []);
});

test("withdrawn exercises, blank queries and limits", () => {
  assert.deepEqual(names("lateral"), []);
  assert.deepEqual(names("   "), []);
  assert.deepEqual(names("d", 1), ["Développé couché"]);
});

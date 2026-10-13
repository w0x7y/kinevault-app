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

function find(entries: CatalogExercise[], query: string): string[] {
  return createDemoCatalogSearch(entries)(query).map((item) => item.name);
}

test("hyphenated, joined and plural spellings find a hyphenated name", () => {
  const pushUp = entry("Push-up");
  for (const query of ["push-ups", "push ups", "pushups", "pushup", "push up", "push"])
    assert.deepEqual(find([pushUp], query), ["Push-up"], query);
  const others = [entry("Pull-up"), entry("Sit-up"), entry("Chin-up")];
  for (const [query, name] of [
    ["pull-ups", "Pull-up"],
    ["pullups", "Pull-up"],
    ["sit-ups", "Sit-up"],
    ["situps", "Sit-up"],
    ["chin-ups", "Chin-up"],
  ] as const)
    assert.deepEqual(find(others, query), [name], query);
});

test("a split or joined compound word finds the other spelling", () => {
  assert.deepEqual(find([entry("Lat pulldown")], "lat pull-down"), ["Lat pulldown"]);
  assert.deepEqual(find([entry("Lat pulldown")], "lat pull down"), ["Lat pulldown"]);
  assert.deepEqual(find([entry("Lat pull-down")], "lat pulldown"), ["Lat pull-down"]);
});

test("aliases match hyphenated and plural spellings", () => {
  const aliased = entry("Floor push-up", { aliases: ["Press-up"] });
  for (const query of ["pressups", "press-ups", "press ups", "pressup"])
    assert.deepEqual(find([aliased], query), ["Floor push-up"], query);
});

test("joined and plural matches keep their ranking tiers", () => {
  const pushUp = entry("Push-up");
  const pushUpRow = entry("Push-up row");
  const byAlias = entry("Floor press", { aliases: ["Press-up"] });
  const byAliasPrefix = entry("Wall press", { aliases: ["Press-up hold"] });
  // Exact after normalization outranks a name prefix.
  assert.deepEqual(find([pushUpRow, pushUp], "pushups"), ["Push-up", "Push-up row"]);
  assert.deepEqual(find([pushUpRow, pushUp], "push ups"), ["Push-up", "Push-up row"]);
  // A joined spelling that only prefixes the name ranks as a prefix, below an exact alias.
  assert.deepEqual(find([pushUpRow, byAlias], "pressups"), ["Floor press"]);
  assert.deepEqual(find([byAliasPrefix, byAlias], "pressups"), ["Floor press", "Wall press"]);
  assert.deepEqual(find([byAlias, pushUp, pushUpRow], "pushup"), ["Push-up", "Push-up row"]);
});

test("joined matching adds no false positives", () => {
  const entries = [entry("Push-up"), entry("Pull-up"), entry("Lat pulldown"), entry("Curl")];
  assert.deepEqual(find(entries, "crul"), []);
  assert.deepEqual(find(entries, "pushdown"), []);
  assert.deepEqual(find(entries, "pullup push"), []);
  assert.deepEqual(find(entries, "pull ups push"), []);
});

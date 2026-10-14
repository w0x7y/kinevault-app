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

test("a joined query finds a run of words that starts mid-name", () => {
  const pulldown = entry("Lat pulldown");
  const hyphenated = entry("Lat pull-down");
  const aliased = entry("Cable station", { aliases: ["Wide pull-down"] });
  for (const query of ["pull down", "pull-down", "pulldown", "pull downs"]) {
    assert.deepEqual(find([pulldown], query), ["Lat pulldown"], query);
    assert.deepEqual(find([hyphenated], query), ["Lat pull-down"], query);
    assert.deepEqual(find([aliased], query), ["Cable station"], query);
  }
  assert.deepEqual(find([entry("Dumbbell shoulder press")], "shoulder press"), [
    "Dumbbell shoulder press",
  ]);
});

test("a mid-name joined run ranks as a prefix unless it is the whole name", () => {
  const lat = entry("Lat pull-down");
  const plain = entry("Pull-down");
  const viaName = entry("Zed pull-down");
  const viaAlias = entry("Alpha row", { aliases: ["Seated pull-down"] });
  assert.deepEqual(find([lat, plain], "pull down"), ["Pull-down", "Lat pull-down"]);
  assert.deepEqual(find([lat, plain], "pulldown"), ["Pull-down", "Lat pull-down"]);
  assert.deepEqual(find([viaAlias, viaName], "pull down"), ["Zed pull-down", "Alpha row"]);
  const exactAlias = entry("Alpha row", { aliases: ["Pull-down"] });
  const prefixName = entry("Zed pull-down");
  assert.deepEqual(find([exactAlias, prefixName], "pull down"), ["Alpha row", "Zed pull-down"]);
});

test("a mid-name joined run adds no false positives", () => {
  const entries = [entry("Lat pulldown"), entry("Curl")];
  assert.deepEqual(find(entries, "pull up"), []);
  assert.deepEqual(find(entries, "down pull"), []);
  assert.deepEqual(find(entries, "pull curl"), []);
  assert.deepEqual(find(entries, "pull dawn"), []);
});

test("letters without a Unicode decomposition are folded", () => {
  assert.deepEqual(demoSearchWords("Ørn Ł Đ Kırmızı"), ["orn", "l", "d", "kirmizi"]);
  assert.deepEqual(demoSearchWords("ØRN ŁÓDŹ ĐOKOVIĆ"), ["orn", "lodz", "dokovic"]);
  assert.deepEqual(demoSearchWords("Æble Œuvre Straße"), ["aeble", "oeuvre", "strasse"]);
  assert.deepEqual(demoSearchWords("Weiß"), ["weiss"]);
  assert.deepEqual(demoSearchWords("STRAẞE"), ["strasse"]);
  const entries = [entry("Søren hold"), entry("Łuk raise"), entry("Straße carry")];
  assert.deepEqual(find(entries, "soren"), ["Søren hold"]);
  assert.deepEqual(find(entries, "SØREN"), ["Søren hold"]);
  assert.deepEqual(find(entries, "luk"), ["Łuk raise"]);
  assert.deepEqual(find(entries, "strasse carry"), ["Straße carry"]);
  assert.deepEqual(find([entry("Aeble press"), entry("Oeuvre row")], "æble"), ["Aeble press"]);
  assert.deepEqual(find([entry("Aeble press"), entry("Oeuvre row")], "œuvre"), ["Oeuvre row"]);
});

test("typographic apostrophes are dropped like the plain one", () => {
  const farmer = entry("Farmer's walk");
  for (const mark of ["'", "’", "‘", "ʼ", "ʻ", "`"]) {
    assert.deepEqual(demoSearchWords(`Farmer${mark}s walk`), ["farmer", "walk"], mark);
    assert.deepEqual(find([farmer], `farmer${mark}s walk`), ["Farmer's walk"], mark);
    assert.deepEqual(find([entry(`Farmer${mark}s carry`)], "farmers carry"), [
      `Farmer${mark}s carry`,
    ]);
  }
});

test("a negative or zero limit returns nothing", () => {
  assert.deepEqual(names("d", 0), []);
  assert.deepEqual(names("d", -1), []);
  assert.deepEqual(names("d", -100), []);
});

test("an exact name ranks before an exact alias", () => {
  const armCurl = entry("Arm curl", { aliases: ["Curl"] });
  const plain = entry("Curl");
  assert.deepEqual(find([armCurl, plain], "curl"), ["Curl", "Arm curl"]);
});

test("a name prefix ranks before an alias prefix", () => {
  const byAlias = entry("Alpha row", { aliases: ["Curl bar"] });
  const byName = entry("Zed curler");
  assert.deepEqual(find([byAlias, byName], "curl"), ["Zed curler", "Alpha row"]);
});

test("a prefix ranks before a typo", () => {
  const typo = entry("Barbel");
  const prefix = entry("Zercher barbell squat");
  assert.deepEqual(find([typo, prefix], "barbell"), ["Zercher barbell squat", "Barbel"]);
  assert.deepEqual(find([typo], "barbell"), ["Barbel"]);
});

test("a typo name ranks before a typo alias", () => {
  const byAlias = entry("Alpha row", { aliases: ["Barbel"] });
  const byName = entry("Zed barbel");
  assert.deepEqual(find([byAlias, byName], "barbell"), ["Zed barbel", "Alpha row"]);
});

test("the typo gate needs five letters in the query and in the word", () => {
  const curlOnly = [entry("Curl")];
  assert.deepEqual(find(curlOnly, "curk"), []);
  assert.deepEqual(find(curlOnly, "curt"), []);
  assert.deepEqual(find(curlOnly, "curly"), []);
  assert.deepEqual(find([entry("Squat")], "squad"), ["Squat"]);
  assert.deepEqual(find([entry("Squad")], "squat"), ["Squad"]);
  assert.deepEqual(find([entry("Lunge")], "lungs"), ["Lunge"]);
});

test("words ending in ss, us or is keep their ending", () => {
  assert.deepEqual(demoSearchWords("Press"), ["press"]);
  assert.deepEqual(demoSearchWords("Gluteus medius"), ["gluteus", "medius"]);
  assert.deepEqual(demoSearchWords("Analysis"), ["analysis"]);
  assert.deepEqual(demoSearchWords("Abs"), ["abs"]);
  assert.deepEqual(demoSearchWords("Lift-off"), ["lift", "off"]);
  assert.deepEqual(demoSearchWords("Biceps"), ["bicep"]);
  assert.deepEqual(demoSearchWords("Bicep"), ["bicep"]);
});

test("press and presses still find Press, and biceps matches either spelling", () => {
  const press = [entry("Press")];
  assert.deepEqual(find(press, "press"), ["Press"]);
  assert.deepEqual(find(press, "presses"), ["Press"]);
  assert.deepEqual(find([entry("Biceps curl")], "bicep"), ["Biceps curl"]);
  assert.deepEqual(find([entry("Bicep curl")], "biceps"), ["Bicep curl"]);
  assert.deepEqual(find([entry("Abs")], "abs"), ["Abs"]);
  assert.deepEqual(find([entry("Gluteus medius")], "gluteus"), ["Gluteus medius"]);
});

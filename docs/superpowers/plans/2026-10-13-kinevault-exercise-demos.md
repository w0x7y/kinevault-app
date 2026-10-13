# KineVault Exercise Demos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show KineVault's rendered exercise demonstration clips in Track for exercises the user links to a KineVault exercise.

**Architecture:** A publish script copies published KineVault exercises (MP4, WebP poster, credit, name, aliases, muscle group, equipment) from the owner's local KineVault Supabase into a public table and a public Storage bucket in Track's hosted project. The app downloads that small catalog, caches it on the device, stores an optional `catalog: { id, slug }` link on each exercise definition, and plays the clip with `expo-video` in the workout detail, template detail and exercise form, with poster thumbnails in search.

**Tech Stack:** Expo SDK 57, React Native 0.86, `expo-video` ~57.0.5, `expo-image`, AsyncStorage, Supabase (PostgREST + Storage), `@supabase/supabase-js` 2.117 in a Node 24 script, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-kinevault-exercise-demos-design.md`

## Global Constraints

- Work in the `Application` repo on branch `feat/kinevault-exercise-demos`. Make no change to the `KineVault` repo.
- Commit subjects are concise and imperative. Never mention AI tools or assistants in commits, code or docs.
- Pure modules that `node:test` imports use explicit `.ts` import extensions and no React Native imports. React components import without extensions, matching existing files.
- KineVault exercise IDs are lowercase UUIDs: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 200 characters.
- Table `public.catalog_exercises`; bucket `exercise-demos` (public, 10 MB limit, `video/mp4` and `image/webp`); object paths `<exercise id>/<16 hex chars>.mp4|.webp`; uploads use `cacheControl: "31536000"`.
- Device cache key `kinevault-track.demo-catalog.v1`; refresh when older than 24 hours; fetch pages of 500, at most 5,000 rows.
- Text limits: name, aliases, muscle group, equipment 400 characters; at most 50 aliases; credit 1–1000 characters.
- Player: 4:3 frame, `muted` color well, `radius.panel`, poster first with a 44px Play control, clip plays muted and looping only after a tap, native controls with fullscreen enabled, credit line underneath.
- User-facing copy, exactly: "Loading demonstration.", "Demonstration unavailable.", "Connect to load this demonstration.", "Couldn't load this demonstration. Check your connection and try again.", "Connect to search KineVault demos.", "Find in KineVault", "Link demo", "KineVault demo".
- No storage bucket or table names in user-facing text. No medical claims.
- Code paths use "demo", not "catalog", for module names (`src/exercise/demo/`), because `CONTEXT.md` uses "catalog" for Custom foods. The exercise field stays `catalog` as the spec defines.
- Before claiming a task done, run `npm run lint`, `npm run typecheck` and the task's tests.

## File Structure

**Create**

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20261013120000_exercise_demo_catalog.sql` | Table, grants, RLS policy, public bucket |
| `supabase/tests/exercise-demo-catalog.sql` | Transactional SQL assertions |
| `scripts/validate-demo-catalog-postgres.sh` | Runs the migration and SQL test on a private cluster |
| `scripts/publish-catalog.mjs` | Publish script: pure planning plus KineVault and Track ports |
| `scripts/publish-catalog.test.mjs` | Unit tests for the publish script |
| `src/exercise/demo/catalog.ts` | `CatalogExercise` type and row parsing |
| `src/exercise/demo/config.ts` | Supabase URL/key config and public object URLs |
| `src/exercise/demo/catalog-search.ts` | On-device search over names and aliases |
| `src/exercise/demo/catalog-store.ts` | Fetch, device cache, refresh rules |
| `src/exercise/demo/demo-link.ts` | Link resolution, player status, form link updates |
| `src/exercise/demo/provider.tsx` | `DemoCatalogProvider`, `useDemoCatalog` |
| `src/exercise/demo/exercise-demo.tsx` | `ExerciseDemo`, `DemoThumbnail`, `ExerciseDemoSlot` |
| `src/exercise/demo/demo-picker.tsx` | `KineVaultDemoSection` for the exercise form |
| `tests/exercise-catalog-link.test.ts` | Model link tests |
| `tests/exercise-demo-catalog.test.ts` | Row parsing and config tests |
| `tests/exercise-demo-search.test.ts` | Search tests |
| `tests/exercise-demo-store.test.ts` | Store tests |
| `tests/exercise-demo-link.test.ts` | Link resolution and status tests |
| `tests/exercise-demo.browser.mjs` | End-to-end web flows |
| `tests/fixtures/demo-clip.webm`, `tests/fixtures/demo-poster.webp` | Tiny media fixtures |
| `docs/exercise-demos.md` | How demos work and how to publish |

**Modify**

| File | Change |
| --- | --- |
| `src/exercise/model.ts` | `CatalogLink`, optional `catalog`, `parseCatalogLink` |
| `src/exercise/controls.tsx` | `ExerciseField` gains `autoFocus` |
| `src/exercise/workout-editing.ts` | `WorkoutView` exercise kind gains `linkDemo` and `returnTo` |
| `src/app/(tabs)/exercise.tsx` | Pass `linkDemo`; return to `returnTo` on close |
| `src/app/(tabs)/_layout.tsx` | Mount `DemoCatalogProvider` |
| `src/exercise/session-editor.tsx` | Demo slot with "Link demo" replaces the caption |
| `src/exercise/library-forms.tsx` | Template demo slot; KineVault section in `ExerciseForm` |
| `src/exercise/search-results.tsx` | Poster thumbnail; remove caption |
| `tests/helpers/account-fixture.mjs` | Serve catalog rows and demo media |
| `tests/exercise.browser.mjs` | Old caption assertions |
| `package.json`, `package-lock.json` | `expo-video`, `catalog:publish` script |
| `CONTEXT.md`, `TODO.md`, `PRODUCT.md`, `README.md`, `DESIGN.md` | Docs |

---

### Task 0: Branch and spec

**Files:**
- Add: `docs/superpowers/specs/2026-10-13-kinevault-exercise-demos-design.md`, `docs/superpowers/plans/2026-10-13-kinevault-exercise-demos.md`

- [ ] **Step 1: Create the branch**

Run: `git switch -c feat/kinevault-exercise-demos`
Expected: `Switched to a new branch 'feat/kinevault-exercise-demos'`

- [ ] **Step 2: Commit the spec and plan**

```bash
git add docs/superpowers/specs/2026-10-13-kinevault-exercise-demos-design.md docs/superpowers/plans/2026-10-13-kinevault-exercise-demos.md
git commit -m "Add KineVault exercise demo design and plan"
```

---

### Task 1: Exercise link in the model

**Files:**
- Modify: `src/exercise/model.ts:3-10` (type), after `seconds()` at `:62-66` (parser), `:68-80` (`parseExerciseDefinition`)
- Test: `tests/exercise-catalog-link.test.ts`

**Interfaces:**
- Produces: `type CatalogLink = { id: string; slug: string }`; `ExerciseDefinition.catalog?: CatalogLink`; `parseCatalogLink(value: unknown): CatalogLink`. `SaveExerciseInput` (derived from `ExerciseDefinition`) accepts `catalog` automatically.

- [ ] **Step 1: Write the failing test**

Create `tests/exercise-catalog-link.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseExerciseDefinition,
  parseExerciseDocument,
  type ExerciseDefinition,
  type ExerciseDocument,
} from "../src/exercise/model.ts";
import { createExerciseCommands } from "../src/exercise/commands.ts";

const link = { id: "3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192", slug: "dumbbell-shoulder-press" };
const press: ExerciseDefinition = {
  id: "press",
  name: "Shoulder press",
  muscleGroup: "Shoulders",
  equipment: "Dumbbells",
  notes: "",
  tracking: "single",
  catalog: link,
};
const empty = (): ExerciseDocument => ({ version: 1, exercises: [], workouts: [], sessions: [] });
function commands() {
  let sequence = 0;
  return createExerciseCommands({ createId: () => `id-${++sequence}`, now: () => 0 });
}

test("an exercise keeps a valid KineVault link", () => {
  assert.deepEqual(parseExerciseDefinition(press).catalog, link);
});

test("an exercise without a link has no catalog field", () => {
  const { catalog: _catalog, ...plain } = press;
  assert.equal("catalog" in parseExerciseDefinition(plain), false);
  assert.equal("catalog" in parseExerciseDefinition({ ...plain, catalog: undefined }), false);
});

test("malformed KineVault links are rejected", () => {
  for (const catalog of [
    null,
    "dumbbell-shoulder-press",
    { id: "not-a-uuid", slug: link.slug },
    { id: link.id.toUpperCase(), slug: link.slug },
    { id: link.id, slug: "Bad Slug" },
    { id: link.id, slug: "a".repeat(201) },
  ])
    assert.throws(() => parseExerciseDefinition({ ...press, catalog }), /Invalid/);
});

test("saved exercises, templates, planned workouts and stored documents carry the link", () => {
  const exerciseCommands = commands();
  const saved = exerciseCommands.saveExercise(empty(), { ...press, id: undefined });
  assert.deepEqual(saved.document.exercises[0]!.catalog, link);
  const workout = exerciseCommands.saveWorkout(saved.document, {
    name: "Upper",
    exerciseIds: [saved.value],
  });
  assert.deepEqual(workout.document.workouts[0]!.exercises[0]!.catalog, link);
  const planned = exerciseCommands.planWorkout(workout.document, {
    date: "2026-10-13",
    workoutId: workout.value,
  });
  assert.deepEqual(planned.document.sessions[0]!.exercises[0]!.exercise.catalog, link);
  const stored = parseExerciseDocument(JSON.stringify(planned.document));
  assert.deepEqual(stored.exercises[0]!.catalog, link);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/exercise-catalog-link.test.ts`
Expected: FAIL. `parseExerciseDefinition(press).catalog` is `undefined`, and the malformed-link test reports "Missing expected exception".

- [ ] **Step 3: Implement**

In `src/exercise/model.ts`, replace the `ExerciseDefinition` type (lines 3–10) with:

```ts
export type CatalogLink = { id: string; slug: string };
export type ExerciseDefinition = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  notes: string;
  tracking: "single" | "sides";
  /** The KineVault exercise whose demonstration this exercise shows. */
  catalog?: CatalogLink;
};
```

After the `seconds()` function, add:

```ts
const catalogIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const catalogSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function parseCatalogLink(value: unknown): CatalogLink {
  const item = record(value);
  if (typeof item.id !== "string" || !catalogIdPattern.test(item.id))
    throw new Error("Invalid catalog link");
  if (
    typeof item.slug !== "string" ||
    item.slug.length > 200 ||
    !catalogSlugPattern.test(item.slug)
  )
    throw new Error("Invalid catalog link");
  return { id: item.id, slug: item.slug };
}
```

Replace `parseExerciseDefinition` with:

```ts
export function parseExerciseDefinition(value: unknown): ExerciseDefinition {
  const item = record(value);
  if (item.tracking !== "single" && item.tracking !== "sides")
    throw new Error("Invalid exercise tracking");
  const definition: ExerciseDefinition = {
    id: id(item.id),
    name: text(item.name, 400, true),
    muscleGroup: text(item.muscleGroup, 400),
    equipment: text(item.equipment, 400),
    notes: text(item.notes, 4000),
    tracking: item.tracking,
  };
  if (item.catalog !== undefined) definition.catalog = parseCatalogLink(item.catalog);
  return definition;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test tests/exercise-catalog-link.test.ts tests/exercise.test.ts tests/workout.test.ts tests/history-partitions.test.ts tests/workout-import.test.ts`
Expected: PASS, no failures.

- [ ] **Step 5: Lint, typecheck, commit**

Run: `npm run lint && npm run typecheck`
Expected: both exit 0.

```bash
git add src/exercise/model.ts tests/exercise-catalog-link.test.ts
git commit -m "Store an optional KineVault link on exercise definitions"
```

---

### Task 2: Demo catalog rows and URLs

**Files:**
- Create: `src/exercise/demo/catalog.ts`, `src/exercise/demo/config.ts`
- Test: `tests/exercise-demo-catalog.test.ts`

**Interfaces:**
- Produces:
  - `type CatalogExercise = { id: string; slug: string; name: string; aliases: string[]; muscleGroup: string; equipment: string; status: "published" | "withdrawn"; videoPath: string | null; posterPath: string | null; credit: string }`
  - `catalogColumns: string`, `parseCatalogRow(value: unknown): CatalogExercise`, `parseCatalogRows(value: unknown): CatalogExercise[]`
  - `type DemoCatalogConfig = { url: string; key: string }`, `demoBucket = "exercise-demos"`, `demoCatalogConfigFrom(url?: string, key?: string): DemoCatalogConfig | null`, `demoCatalogConfig: DemoCatalogConfig | null`, `demoObjectUrl(config: DemoCatalogConfig, path: string): string`

- [ ] **Step 1: Write the failing test**

Create `tests/exercise-demo-catalog.test.ts`:

```ts
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
  const withdrawn = parseCatalogRow({ ...row, status: "withdrawn", video_path: null, poster_path: null });
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
  const aliases = ["", "  ", 7, "x".repeat(401), ...Array.from({ length: 60 }, (_, i) => `alias ${i}`)];
  const parsed = parseCatalogRow({ ...row, aliases });
  assert.equal(parsed.aliases.length, 50);
  assert.equal(parsed.aliases[0], "alias 0");
});

test("one invalid row is dropped without hiding the others", () => {
  const rows = parseCatalogRows([row, { ...row, id: "bad" }, { ...row, slug: "Bad Slug" }]);
  assert.deepEqual(rows.map((entry) => entry.id), [id]);
  assert.throws(() => parseCatalogRows({ rows: [] }), /response/);
});

test("demo config accepts HTTPS or local HTTP and keeps only the origin", () => {
  assert.deepEqual(demoCatalogConfigFrom(" https://abc.supabase.co/ ", " key "), {
    url: "https://abc.supabase.co",
    key: "key",
  });
  assert.deepEqual(demoCatalogConfigFrom("http://127.0.0.1:54321", "key")?.url, "http://127.0.0.1:54321");
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/exercise-demo-catalog.test.ts`
Expected: FAIL with `Cannot find module` for `src/exercise/demo/catalog.ts`.

- [ ] **Step 3: Implement `catalog.ts`**

Create `src/exercise/demo/catalog.ts`:

```ts
// KineVault exercises mirrored into Track's `catalog_exercises` table by
// scripts/publish-catalog.mjs. Rows are untrusted network data.
export type CatalogExercise = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  muscleGroup: string;
  equipment: string;
  status: "published" | "withdrawn";
  videoPath: string | null;
  posterPath: string | null;
  credit: string;
};

/** Columns requested from `catalog_exercises`, in PostgREST `select` syntax. */
export const catalogColumns =
  "id,slug,name,aliases,muscle_group,equipment,status,video_path,poster_path,credit";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid catalog row");
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, required = false): string {
  if (typeof value !== "string" || value.length > limit || (required && !value.trim()))
    throw new Error("Invalid catalog text");
  return value;
}
function objectPath(value: unknown, id: string, extension: "mp4" | "webp"): string | null {
  if (value === null) return null;
  // `id` is a validated UUID, so it is safe inside the pattern.
  if (typeof value !== "string" || !new RegExp(`^${id}/[0-9a-f]{16}\\.${extension}$`).test(value))
    throw new Error("Invalid catalog media path");
  return value;
}

export function parseCatalogRow(value: unknown): CatalogExercise {
  const row = record(value);
  const id = text(row.id, 36);
  if (!idPattern.test(id)) throw new Error("Invalid catalog ID");
  const slug = text(row.slug, 200);
  if (!slugPattern.test(slug)) throw new Error("Invalid catalog slug");
  if (row.status !== "published" && row.status !== "withdrawn")
    throw new Error("Invalid catalog status");
  if (!Array.isArray(row.aliases)) throw new Error("Invalid catalog aliases");
  const aliases = row.aliases
    .filter((alias): alias is string => typeof alias === "string" && alias.trim() !== "")
    .filter((alias) => alias.length <= 400)
    .slice(0, 50);
  const videoPath = objectPath(row.video_path, id, "mp4");
  const posterPath = objectPath(row.poster_path, id, "webp");
  if (row.status === "published" && (!videoPath || !posterPath))
    throw new Error("Published catalog row without media");
  return {
    id,
    slug,
    name: text(row.name, 400, true),
    aliases,
    muscleGroup: text(row.muscle_group, 400),
    equipment: text(row.equipment, 400),
    status: row.status,
    videoPath,
    posterPath,
    credit: text(row.credit, 1000, true),
  };
}

/** Parses a response page. One invalid row hides only its own demo. */
export function parseCatalogRows(value: unknown): CatalogExercise[] {
  if (!Array.isArray(value)) throw new Error("Invalid catalog response");
  const entries: CatalogExercise[] = [];
  for (const row of value) {
    try {
      entries.push(parseCatalogRow(row));
    } catch {
      // Skip this row; the others still load.
    }
  }
  return entries;
}
```

Of the test's aliases `["", "  ", 7, "x"×401, alias 0…59]`, the blank, non-string and over-long items are dropped and `slice(0, 50)` keeps `alias 0` to `alias 49`.

- [ ] **Step 4: Implement `config.ts`**

Create `src/exercise/demo/config.ts`:

```ts
// Demo clips and the catalog list come from the same Supabase project as accounts.
export type DemoCatalogConfig = { url: string; key: string };
export const demoBucket = "exercise-demos";

/** The project that serves demos, or null when this build isn't configured for one. */
export function demoCatalogConfigFrom(
  url: string | undefined,
  key: string | undefined,
): DemoCatalogConfig | null {
  const base = url?.trim();
  const apiKey = key?.trim();
  if (!base || !apiKey) return null;
  try {
    const parsed = new URL(base);
    const local =
      parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !local) return null;
    return { url: parsed.origin, key: apiKey };
  } catch {
    return null;
  }
}

// Expo inlines EXPO_PUBLIC_* only for direct `process.env.NAME` references.
export const demoCatalogConfig = demoCatalogConfigFrom(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export function demoObjectUrl(config: DemoCatalogConfig, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${config.url}/storage/v1/object/public/${demoBucket}/${encoded}`;
}
```

- [ ] **Step 5: Run the test**

Run: `node --experimental-strip-types --test tests/exercise-demo-catalog.test.ts`
Expected: PASS.

- [ ] **Step 6: Lint, typecheck, commit**

Run: `npm run lint && npm run typecheck`

```bash
git add src/exercise/demo/catalog.ts src/exercise/demo/config.ts tests/exercise-demo-catalog.test.ts
git commit -m "Parse KineVault demo catalog rows and build demo URLs"
```

---

### Task 3: Demo catalog search

**Files:**
- Create: `src/exercise/demo/catalog-search.ts`
- Test: `tests/exercise-demo-search.test.ts`

**Interfaces:**
- Consumes: `CatalogExercise` from Task 2.
- Produces: `demoSearchWords(text: string): string[]`; `createDemoCatalogSearch(entries: readonly CatalogExercise[]): (query: string, limit?: number) => CatalogExercise[]` (default limit 8, published entries only).

- [ ] **Step 1: Write the failing test**

Create `tests/exercise-demo-search.test.ts`:

```ts
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
const withdrawn = entry("Cable lateral raise", { status: "withdrawn", videoPath: null, posterPath: null });
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
```

`names("d", 1)`: every published entry has a word starting with "d" except "Curl", all at prefix rank 2, so ties sort by name and "Développé couché" sorts first under `localeCompare` ("De" before "Du").

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/exercise-demo-search.test.ts`
Expected: FAIL with `Cannot find module` for `catalog-search.ts`.

- [ ] **Step 3: Implement**

Create `src/exercise/demo/catalog-search.ts`:

```ts
import type { CatalogExercise } from "./catalog.ts";

/** Accent-folded lowercase words; a trailing plural "s" is dropped so "curls" finds "curl". */
export function demoSearchWords(text: string): string[] {
  return (
    text
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/['’]/gu, "")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).map((word) =>
    word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word) ? word.slice(0, -1) : word,
  );
}

function withinOneEdit(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let a = 0;
  let b = 0;
  let edits = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) {
      a++;
      b++;
      continue;
    }
    if (++edits > 1) return false;
    if (left.length > right.length) a++;
    else if (right.length > left.length) b++;
    else {
      a++;
      b++;
    }
  }
  return edits + (left.length - a) + (right.length - b) <= 1;
}

// Lower is better: exact name 0, exact alias 1, name prefix 2, alias prefix 3,
// name with a typo 4, alias with a typo 5.
function rank(terms: readonly string[], target: readonly string[], alias: boolean): number | null {
  const offset = alias ? 1 : 0;
  if (terms.length === target.length && terms.every((term, index) => term === target[index]))
    return offset;
  let typo = false;
  for (const term of terms) {
    if (target.some((word) => word.startsWith(term))) continue;
    if (term.length >= 5 && target.some((word) => word.length >= 5 && withinOneEdit(term, word))) {
      typo = true;
      continue;
    }
    return null;
  }
  return (typo ? 4 : 2) + offset;
}

export function createDemoCatalogSearch(entries: readonly CatalogExercise[]) {
  const indexed = entries
    .filter((entry) => entry.status === "published")
    .map((entry) => ({
      entry,
      name: demoSearchWords(entry.name),
      aliases: entry.aliases.map(demoSearchWords),
    }));
  return (query: string, limit = 8): CatalogExercise[] => {
    const terms = demoSearchWords(query);
    if (!terms.length) return [];
    const matches: { entry: CatalogExercise; rank: number }[] = [];
    for (const item of indexed) {
      const ranks = [
        rank(terms, item.name, false),
        ...item.aliases.map((alias) => rank(terms, alias, true)),
      ].filter((value): value is number => value !== null);
      if (ranks.length) matches.push({ entry: item.entry, rank: Math.min(...ranks) });
    }
    return matches
      .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name))
      .slice(0, limit)
      .map((match) => match.entry);
  };
}
```

- [ ] **Step 4: Run the test**

Run: `node --experimental-strip-types --test tests/exercise-demo-search.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add src/exercise/demo/catalog-search.ts tests/exercise-demo-search.test.ts
git commit -m "Search KineVault demos by name and alias on the device"
```

---

### Task 4: Demo catalog store

**Files:**
- Create: `src/exercise/demo/catalog-store.ts`
- Test: `tests/exercise-demo-store.test.ts`

**Interfaces:**
- Consumes: `catalogColumns`, `parseCatalogRows`, `CatalogExercise` (Task 2); `DemoCatalogConfig` (Task 2).
- Produces:
  - `type DemoCatalogState = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; entries: CatalogExercise[]; byId: ReadonlyMap<string, CatalogExercise>; fetchedAt: number }`
  - `type CatalogFetch = (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; json(): Promise<unknown> }>`
  - `type CatalogStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }`
  - `demoCatalogStorageKey`, `demoCatalogMaxAgeMs`
  - `createDemoCatalogStore({ config, fetch, storage, now }) => { getSnapshot(): DemoCatalogState; subscribe(listener: () => void): () => void; start(): Promise<void>; refreshIfStale(): Promise<void>; retry(): Promise<void> }`

- [ ] **Step 1: Write the failing test**

Create `tests/exercise-demo-store.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  createDemoCatalogStore,
  demoCatalogMaxAgeMs,
  demoCatalogStorageKey,
  type CatalogFetch,
} from "../src/exercise/demo/catalog-store.ts";

const config = { url: "https://abc.supabase.co", key: "publishable" };
function row(index: number) {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  return {
    id,
    slug: `exercise-${index}`,
    name: `Exercise ${index}`,
    aliases: [],
    muscle_group: "",
    equipment: "",
    status: "published",
    video_path: `${id}/0123456789abcdef.mp4`,
    poster_path: `${id}/fedcba9876543210.webp`,
    credit: "Demonstration: KineVault.",
  };
}
function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
function fakeFetch(pages: unknown[][] | "fail") {
  const urls: string[] = [];
  const headers: Record<string, string>[] = [];
  const fetch: CatalogFetch = async (url, init) => {
    urls.push(url);
    headers.push(init.headers);
    if (pages === "fail") return { ok: false, json: async () => ({}) };
    const page = pages[urls.length - 1] ?? [];
    return { ok: true, json: async () => page };
  };
  return { fetch, urls, headers };
}
function store({
  pages = [[row(1)]] as unknown[][] | "fail",
  storage = memoryStorage(),
  now = 1_000_000,
  configured = true,
} = {}) {
  const transport = fakeFetch(pages);
  const clock = { now };
  const catalog = createDemoCatalogStore({
    config: configured ? config : null,
    fetch: transport.fetch,
    storage,
    now: () => clock.now,
  });
  return { catalog, transport, storage, clock };
}

test("the first refresh downloads, caches and exposes the catalog", async () => {
  const { catalog, transport, storage } = store();
  assert.equal(catalog.getSnapshot().kind, "loading");
  await catalog.refreshIfStale();
  const state = catalog.getSnapshot();
  assert.equal(state.kind, "ready");
  assert.equal(state.kind === "ready" && state.byId.get(row(1).id)?.name, "Exercise 1");
  assert.equal(
    transport.urls[0],
    "https://abc.supabase.co/rest/v1/catalog_exercises?select=id,slug,name,aliases,muscle_group,equipment,status,video_path,poster_path,credit&order=id.asc&limit=500&offset=0",
  );
  assert.deepEqual(transport.headers[0], { apikey: "publishable", Accept: "application/json" });
  const saved = JSON.parse(storage.values.get(demoCatalogStorageKey)!);
  assert.deepEqual(saved, { version: 1, fetchedAt: 1_000_000, rows: [row(1)] });
});

test("a fresh cached copy is used without a request; a stale one is refreshed", async () => {
  const cached = JSON.stringify({ version: 1, fetchedAt: 1_000_000, rows: [row(2)] });
  const fresh = store({ storage: memoryStorage({ [demoCatalogStorageKey]: cached }) });
  await fresh.catalog.refreshIfStale();
  assert.equal(fresh.transport.urls.length, 0);
  assert.equal(fresh.catalog.getSnapshot().kind, "ready");
  const stale = store({
    storage: memoryStorage({ [demoCatalogStorageKey]: cached }),
    now: 1_000_000 + demoCatalogMaxAgeMs,
  });
  await stale.catalog.refreshIfStale();
  assert.equal(stale.transport.urls.length, 1);
});

test("a cached copy from the future counts as stale", async () => {
  const cached = JSON.stringify({ version: 1, fetchedAt: 9_000_000, rows: [row(2)] });
  const { catalog, transport } = store({ storage: memoryStorage({ [demoCatalogStorageKey]: cached }) });
  await catalog.refreshIfStale();
  assert.equal(transport.urls.length, 1);
});

test("full pages are followed by the next page, up to 5,000 rows", async () => {
  const full = Array.from({ length: 500 }, (_, index) => row(index + 1));
  const paged = store({ pages: [full, [row(501)]] });
  await paged.catalog.refreshIfStale();
  assert.equal(paged.transport.urls.length, 2);
  assert.match(paged.transport.urls[1]!, /offset=500$/);
  const endless = store({ pages: Array.from({ length: 20 }, () => full) });
  await endless.catalog.refreshIfStale();
  assert.equal(endless.transport.urls.length, 10);
});

test("a failed first load is reported; a failed refresh keeps the saved copy", async () => {
  const failed = store({ pages: "fail" });
  await failed.catalog.refreshIfStale();
  assert.equal(failed.catalog.getSnapshot().kind, "failed");
  const cached = JSON.stringify({ version: 1, fetchedAt: 0, rows: [row(3)] });
  const kept = store({
    pages: "fail",
    storage: memoryStorage({ [demoCatalogStorageKey]: cached }),
    now: demoCatalogMaxAgeMs + 1,
  });
  await kept.catalog.refreshIfStale();
  assert.equal(kept.transport.urls.length, 1);
  const state = kept.catalog.getSnapshot();
  assert.equal(state.kind === "ready" && state.entries[0]?.name, "Exercise 3");
});

test("concurrent refreshes share one request", async () => {
  const { catalog, transport } = store();
  await Promise.all([catalog.refreshIfStale(), catalog.refreshIfStale(), catalog.retry()]);
  assert.equal(transport.urls.length, 1);
});

test("an unconfigured build fails without a request; a corrupt cache is ignored", async () => {
  const unconfigured = store({ configured: false });
  await unconfigured.catalog.refreshIfStale();
  assert.equal(unconfigured.catalog.getSnapshot().kind, "failed");
  assert.equal(unconfigured.transport.urls.length, 0);
  const corrupt = store({ storage: memoryStorage({ [demoCatalogStorageKey]: "{not json" }) });
  await corrupt.catalog.refreshIfStale();
  assert.equal(corrupt.transport.urls.length, 1);
  assert.equal(corrupt.catalog.getSnapshot().kind, "ready");
});

test("subscribers hear state changes", async () => {
  const { catalog } = store();
  const kinds: string[] = [];
  const unsubscribe = catalog.subscribe(() => kinds.push(catalog.getSnapshot().kind));
  await catalog.refreshIfStale();
  unsubscribe();
  assert.deepEqual(kinds, ["ready"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/exercise-demo-store.test.ts`
Expected: FAIL with `Cannot find module` for `catalog-store.ts`.

- [ ] **Step 3: Implement**

Create `src/exercise/demo/catalog-store.ts`:

```ts
import { catalogColumns, parseCatalogRows, type CatalogExercise } from "./catalog.ts";
import type { DemoCatalogConfig } from "./config.ts";

export type DemoCatalogState =
  | { kind: "loading" }
  | { kind: "failed" }
  | {
      kind: "ready";
      entries: CatalogExercise[];
      byId: ReadonlyMap<string, CatalogExercise>;
      fetchedAt: number;
    };
export type CatalogFetch = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
export type CatalogStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

// A device cache of public data, kept across sign-out.
export const demoCatalogStorageKey = "kinevault-track.demo-catalog.v1";
export const demoCatalogMaxAgeMs = 24 * 60 * 60 * 1000;
const pageSize = 500;
const rowLimit = 5000;

function readyState(rows: unknown[], fetchedAt: number): DemoCatalogState {
  const entries = parseCatalogRows(rows);
  return {
    kind: "ready",
    entries,
    byId: new Map(entries.map((entry) => [entry.id, entry])),
    fetchedAt,
  };
}

function parseCache(raw: string | null): { rows: unknown[]; fetchedAt: number } | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { version, fetchedAt, rows } = value as Record<string, unknown>;
    if (version !== 1 || typeof fetchedAt !== "number" || !Number.isFinite(fetchedAt)) return null;
    return Array.isArray(rows) ? { rows, fetchedAt } : null;
  } catch {
    return null;
  }
}

export function createDemoCatalogStore({
  config,
  fetch,
  storage,
  now,
}: {
  config: DemoCatalogConfig | null;
  fetch: CatalogFetch;
  storage: CatalogStorage;
  now: () => number;
}) {
  let state: DemoCatalogState = { kind: "loading" };
  let started: Promise<void> | null = null;
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  function set(next: DemoCatalogState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  async function download(): Promise<unknown[]> {
    if (!config) throw new Error("Demos aren't configured for this build");
    const rows: unknown[] = [];
    for (let offset = 0; offset < rowLimit; offset += pageSize) {
      const response = await fetch(
        `${config.url}/rest/v1/catalog_exercises?select=${catalogColumns}&order=id.asc&limit=${pageSize}&offset=${offset}`,
        { headers: { apikey: config.key, Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("Catalog request failed");
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error("Invalid catalog response");
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }

  function start(): Promise<void> {
    started ??= (async () => {
      try {
        const saved = parseCache(await storage.getItem(demoCatalogStorageKey));
        if (saved && state.kind === "loading") set(readyState(saved.rows, saved.fetchedAt));
      } catch {
        // An unreadable cache is replaced by the next download.
      }
    })();
    return started;
  }

  function refresh(): Promise<void> {
    inFlight ??= (async () => {
      try {
        await start();
        const rows = await download();
        const fetchedAt = now();
        set(readyState(rows, fetchedAt));
        try {
          await storage.setItem(
            demoCatalogStorageKey,
            JSON.stringify({ version: 1, fetchedAt, rows }),
          );
        } catch {
          // The in-memory copy still works; the next launch downloads again.
        }
      } catch {
        if (state.kind !== "ready") set({ kind: "failed" });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function refreshIfStale(): Promise<void> {
    await start();
    if (state.kind === "ready") {
      const age = now() - state.fetchedAt;
      if (age >= 0 && age < demoCatalogMaxAgeMs) return;
    }
    return refresh();
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    refreshIfStale,
    retry: refresh,
  };
}
```

- [ ] **Step 4: Run the test**

Run: `node --experimental-strip-types --test tests/exercise-demo-store.test.ts`
Expected: PASS. If "subscribers hear state changes" reports `["ready"]` plus extra entries, the store is emitting unchanged states; fix the emitter, not the test.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add src/exercise/demo/catalog-store.ts tests/exercise-demo-store.test.ts
git commit -m "Cache the KineVault demo catalog on the device"
```

---

### Task 5: Demo link rules

**Files:**
- Create: `src/exercise/demo/demo-link.ts`
- Test: `tests/exercise-demo-link.test.ts`

**Interfaces:**
- Consumes: `CatalogLink`, `ExerciseDefinition` (Task 1); `CatalogExercise` (Task 2); `DemoCatalogState` (Task 4).
- Produces:
  - `resolveDemoLink(library: readonly ExerciseDefinition[], exercise: ExerciseDefinition): CatalogLink | null`
  - `type DemoStatus = { kind: "loading" } | { kind: "connect" } | { kind: "unavailable" } | { kind: "failed"; offline: boolean } | { kind: "ready"; entry: CatalogExercise; videoPath: string; posterPath: string }`
  - `demoStatus({ state, link, mediaFailed, offline }): DemoStatus`
  - `type ExerciseFields = Omit<ExerciseDefinition, "id">`
  - `applyCatalogLink(fields: ExerciseFields, entry: CatalogExercise): ExerciseFields`
  - `withoutCatalogLink(fields: ExerciseFields): ExerciseFields`

- [ ] **Step 1: Write the failing test**

Create `tests/exercise-demo-link.test.ts`:

```ts
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
  const typed = { name: "Overhead press", muscleGroup: "  ", equipment: "Bench", notes: "", tracking: "single" as const };
  const linked = applyCatalogLink(typed, entry);
  assert.deepEqual(linked, { ...typed, catalog: link, muscleGroup: "Shoulders" });
  const unlinked = withoutCatalogLink(linked);
  assert.equal("catalog" in unlinked, false);
  assert.equal(unlinked.name, "Overhead press");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/exercise-demo-link.test.ts`
Expected: FAIL with `Cannot find module` for `demo-link.ts`.

- [ ] **Step 3: Implement**

Create `src/exercise/demo/demo-link.ts`:

```ts
import type { CatalogLink, ExerciseDefinition } from "../model.ts";
import type { CatalogExercise } from "./catalog.ts";
import type { DemoCatalogState } from "./catalog-store.ts";

/**
 * The demo for a template or workout exercise. The library's current definition
 * decides, so linking or unlinking applies to existing workouts; a deleted
 * library exercise falls back to the copy saved in the workout.
 */
export function resolveDemoLink(
  library: readonly ExerciseDefinition[],
  exercise: ExerciseDefinition,
): CatalogLink | null {
  const current = library.find((item) => item.id === exercise.id);
  return (current ?? exercise).catalog ?? null;
}

export type DemoStatus =
  | { kind: "loading" }
  | { kind: "connect" }
  | { kind: "unavailable" }
  | { kind: "failed"; offline: boolean }
  | { kind: "ready"; entry: CatalogExercise; videoPath: string; posterPath: string };

export function demoStatus({
  state,
  link,
  mediaFailed,
  offline,
}: {
  state: DemoCatalogState;
  link: CatalogLink;
  mediaFailed: boolean;
  offline: boolean;
}): DemoStatus {
  if (state.kind === "loading") return { kind: "loading" };
  if (state.kind === "failed") return { kind: "connect" };
  const entry = state.byId.get(link.id);
  if (!entry || entry.status !== "published" || !entry.videoPath || !entry.posterPath)
    return { kind: "unavailable" };
  if (mediaFailed) return { kind: "failed", offline };
  return { kind: "ready", entry, videoPath: entry.videoPath, posterPath: entry.posterPath };
}

export type ExerciseFields = Omit<ExerciseDefinition, "id">;

/** Links a KineVault exercise and fills only the fields the user left blank. */
export function applyCatalogLink(fields: ExerciseFields, entry: CatalogExercise): ExerciseFields {
  return {
    ...fields,
    catalog: { id: entry.id, slug: entry.slug },
    name: fields.name.trim() ? fields.name : entry.name,
    muscleGroup: fields.muscleGroup.trim() ? fields.muscleGroup : entry.muscleGroup,
    equipment: fields.equipment.trim() ? fields.equipment : entry.equipment,
  };
}

export function withoutCatalogLink(fields: ExerciseFields): ExerciseFields {
  const { catalog: _catalog, ...rest } = fields;
  return rest;
}
```

- [ ] **Step 4: Run the test**

Run: `node --experimental-strip-types --test tests/exercise-demo-link.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npm run lint && npm run typecheck
git add src/exercise/demo/demo-link.ts tests/exercise-demo-link.test.ts
git commit -m "Resolve exercise demo links and player states"
```

---

### Task 6: Track backend migration

**Files:**
- Create: `supabase/migrations/20261013120000_exercise_demo_catalog.sql`, `supabase/tests/exercise-demo-catalog.sql`, `scripts/validate-demo-catalog-postgres.sh`

**Interfaces:**
- Produces: table `public.catalog_exercises` with columns `id, slug, name, aliases, muscle_group, equipment, status, video_path, poster_path, credit, published_at, updated_at`; bucket `exercise-demos`.

This task needs PostgreSQL binaries. If `initdb` isn't installed, use Docker (start the daemon first, e.g. `sudo systemctl start docker`):

```bash
docker run --rm -u postgres -v "$PWD":/repo:ro -e PG_BINDIR=/usr/lib/postgresql/17/bin postgres:17 \
  bash /repo/scripts/validate-demo-catalog-postgres.sh
```

- [ ] **Step 1: Write the runner and the failing SQL test**

Create `scripts/validate-demo-catalog-postgres.sh` and make it executable (`chmod +x`):

```bash
#!/usr/bin/env bash
# Private PostgreSQL cluster for the demo catalog migration; never connects to an existing database.
set -euo pipefail
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
pg_bin=${PG_BINDIR:-}
if [[ -n "$pg_bin" ]]; then export PATH="$pg_bin:$PATH"; fi
for tool in initdb pg_ctl psql; do
  command -v "$tool" >/dev/null || { echo "Missing $tool; set PG_BINDIR to PostgreSQL's bin directory." >&2; exit 1; }
done
task_dir=$(mktemp -d "${TMPDIR:-/tmp}/kinevault-demo-catalog-pg.XXXXXX")
cleanup() {
  pg_ctl -D "$task_dir/data" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf "$task_dir"
}
trap cleanup EXIT
initdb -D "$task_dir/data" --auth-local=trust --auth-host=reject --no-locale -E UTF8 >/dev/null
pg_ctl -D "$task_dir/data" -l "$task_dir/server.log" -o "-k $task_dir -c listen_addresses='' -c max_connections=12" -w start >/dev/null
export PGHOST="$task_dir" PGPORT=5432 PGDATABASE=postgres PGUSER="$(id -un)"
unset PGSERVICE PGSERVICEFILE PGOPTIONS PGHOSTADDR
# Stand-ins for the Supabase roles and the Storage table this migration touches.
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
create role anon; create role authenticated; create role service_role bypassrls;
create schema storage;
create table storage.buckets(id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
SQL
psql -X -v ON_ERROR_STOP=1 -q -f "$repo_dir/supabase/migrations/20261013120000_exercise_demo_catalog.sql"
psql -X -v ON_ERROR_STOP=1 -q -f "$repo_dir/supabase/tests/exercise-demo-catalog.sql"
echo "Demo catalog SQL checks passed."
```

Create `supabase/tests/exercise-demo-catalog.sql`:

```sql
-- Transactional assertions for the demo catalog; run by scripts/validate-demo-catalog-postgres.sh.
begin;
do $$
begin
  if not has_table_privilege('anon', 'public.catalog_exercises', 'SELECT') then
    raise exception 'Anonymous read grant absent';
  end if;
  if not has_table_privilege('authenticated', 'public.catalog_exercises', 'SELECT') then
    raise exception 'Authenticated read grant absent';
  end if;
  if has_table_privilege('anon', 'public.catalog_exercises', 'INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Anonymous write grant leaked';
  end if;
  if has_table_privilege('authenticated', 'public.catalog_exercises', 'INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Authenticated write grant leaked';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.catalog_exercises'::regclass) then
    raise exception 'Row level security disabled';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'exercise-demos' and public and file_size_limit = 10485760
      and allowed_mime_types = array['video/mp4', 'image/webp']
  ) then
    raise exception 'Demo bucket misconfigured';
  end if;
end;
$$;

insert into public.catalog_exercises (id, slug, name, aliases, status, video_path, poster_path, credit) values
  ('3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192', 'dumbbell-shoulder-press', 'Dumbbell shoulder press',
   '{DB overhead press}', 'published',
   '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192/0123456789abcdef.mp4',
   '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192/fedcba9876543210.webp', 'Demonstration: KineVault.'),
  ('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', 'cable-lateral-raise', 'Cable lateral raise', '{}',
   'withdrawn', null, null, 'Demonstration: KineVault.');

do $$
begin
  begin
    insert into public.catalog_exercises (id, slug, name, status, credit)
    values ('11111111-2222-4333-8444-555555555555', 'no-media', 'No media', 'published', 'Credit');
    raise exception 'Published row without media accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.catalog_exercises (id, slug, name, status, video_path, poster_path, credit)
    values ('11111111-2222-4333-8444-555555555555', 'foreign-media', 'Foreign media', 'published',
      '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192/0123456789abcdef.mp4',
      '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192/fedcba9876543210.webp', 'Credit');
    raise exception 'Media under another exercise accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.catalog_exercises (id, slug, name, status, credit)
    values ('11111111-2222-4333-8444-555555555555', 'Bad Slug', 'Bad slug', 'withdrawn', 'Credit');
    raise exception 'Invalid slug accepted';
  exception when check_violation then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  if (select count(*) from public.catalog_exercises) <> 2 then
    raise exception 'Anonymous readers cannot see the catalog';
  end if;
  begin
    update public.catalog_exercises set name = 'Changed';
    raise exception 'Anonymous update accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role authenticated;
do $$
begin
  if (select count(*) from public.catalog_exercises) <> 2 then
    raise exception 'Signed-in readers cannot see the catalog';
  end if;
  begin
    delete from public.catalog_exercises;
    raise exception 'Authenticated delete accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash scripts/validate-demo-catalog-postgres.sh` (or the Docker command above)
Expected: FAIL with `psql: error: .../20261013120000_exercise_demo_catalog.sql: No such file or directory`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261013120000_exercise_demo_catalog.sql`:

```sql
-- KineVault exercise demonstrations, mirrored from the owner's local KineVault
-- stack by scripts/publish-catalog.mjs. Published demos are public; only the
-- service role writes rows or objects.
create table public.catalog_exercises (
  id uuid primary key,
  slug text not null unique
    check (char_length(slug) <= 200 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) <= 400 and btrim(name) <> ''),
  aliases text[] not null default '{}'
    check (cardinality(aliases) <= 50 and array_position(aliases, null) is null),
  muscle_group text not null default '' check (char_length(muscle_group) <= 400),
  equipment text not null default '' check (char_length(equipment) <= 400),
  status text not null check (status in ('published', 'withdrawn')),
  video_path text check (video_path ~ '^[0-9a-f-]{36}/[0-9a-f]{16}\.mp4$'),
  poster_path text check (poster_path ~ '^[0-9a-f-]{36}/[0-9a-f]{16}\.webp$'),
  credit text not null check (char_length(credit) between 1 and 1000),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint catalog_exercises_media_owner check (
    (video_path is null or starts_with(video_path, id::text || '/'))
    and (poster_path is null or starts_with(poster_path, id::text || '/'))),
  constraint catalog_exercises_published_media check (
    status <> 'published' or (video_path is not null and poster_path is not null))
);

alter table public.catalog_exercises enable row level security;
-- Do not rely on project-dependent default Data API grants.
revoke all on public.catalog_exercises from public, anon, authenticated;
grant select on public.catalog_exercises to anon, authenticated;
grant all on public.catalog_exercises to service_role;
create policy catalog_exercises_read on public.catalog_exercises
  for select to anon, authenticated using (true);

-- Public bucket: objects are served from /storage/v1/object/public without
-- signing. No storage.objects policies are added, so clients cannot write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-demos', 'exercise-demos', true, 10485760, array['video/mp4', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

- [ ] **Step 4: Run the SQL checks**

Run: `bash scripts/validate-demo-catalog-postgres.sh` (or the Docker command)
Expected: `Demo catalog SQL checks passed.`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261013120000_exercise_demo_catalog.sql supabase/tests/exercise-demo-catalog.sql scripts/validate-demo-catalog-postgres.sh
git commit -m "Add the public exercise demo catalog table and bucket"
```

Do not apply this migration to the hosted project here. Task 12 does that after the user confirms.

---

### Task 7: Publish script

**Files:**
- Create: `scripts/publish-catalog.mjs`, `scripts/publish-catalog.test.mjs`, `docs/exercise-demos.md`
- Modify: `package.json` (`scripts`)

**Interfaces:**
- Consumes: the Task 6 table and bucket (at run time only).
- Produces (exports of `scripts/publish-catalog.mjs`): `anatomyCredit`, `demoCredit({ licenseName, sourceCredit })`, `buildSourceExercises(raw) => { sources, skipped }`, `checkMedia(bytes, kind)`, `mediaPath(id, bytes, extension)`, `planCatalogPublish({ sources, current, now }) => { upserts, withdrawals }`, `describePlan({ plan, uploads, skipped, apply })`, `publishCatalog({ kinevault, track, apply, now, log })`, `kinevaultPort(url, key)`, `trackPort(url, serviceKey)`.

- [ ] **Step 1: Write the failing test**

Create `scripts/publish-catalog.test.mjs`:

```js
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
const webp = (fill) => Uint8Array.from([...Buffer.from("RIFF"), 4, 0, 0, 0, ...Buffer.from("WEBP"), fill]);
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
      { id: press, slug: "dumbbell-shoulder-press", status: "published", current_content_id: "content-press", published_at: "2026-10-05T10:00:00+00:00" },
      { id: raise, slug: "cable-lateral-raise", status: "published", current_content_id: "content-raise", published_at: null },
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
      media("content-press", "group-side", "mp4", { camera_angle: "side", created_at: "2026-10-01T10:00:00Z" }),
      media("content-press", "group-side", "poster", { camera_angle: "side" }),
      media("content-raise", "group-raise", "mp4"),
    ],
    replacements: [
      { storage_bucket: "exercise-public", original_path: "submissions/group-side/demo.mp4", replacement_path: "submissions/group-side/z-anatomy-v7/demo.mp4", license_name: "CC BY-SA 4.0", source_credit: "Z-Anatomy — Gauthier Kervyn and contributors", created_at: "2026-10-06T10:00:00Z" },
      { storage_bucket: "exercise-public", original_path: "submissions/group-side/demo.mp4", replacement_path: "submissions/group-side/z-anatomy-v8/demo.mp4", license_name: "CC BY-SA 4.0", source_credit: "Z-Anatomy — Gauthier Kervyn and contributors", created_at: "2026-10-07T10:00:00Z" },
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
      credit: "Demonstration: KineVault. Z-Anatomy — Gauthier Kervyn and contributors. License: CC BY-SA 4.0.",
    },
  ]);
  assert.deepEqual(skipped, [{ slug: "cable-lateral-raise", reason: "no complete MP4 and poster" }]);
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
  assert.deepEqual(planCatalogPublish({ sources: [located], current: [stored], now }), { upserts: [], withdrawals: [] });
  const renamed = planCatalogPublish({ sources: [{ ...located, name: "DB shoulder press" }], current: [stored], now });
  assert.deepEqual(renamed.upserts.map((row) => [row.name, row.updated_at]), [["DB shoulder press", now]]);
  const fresh = planCatalogPublish({ sources: [located], current: [], now });
  assert.equal(fresh.upserts[0].status, "published");
  const withdrawn = { ...stored, id: retired, slug: "old", status: "withdrawn", video_path: null, poster_path: null };
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
  const result = await publishCatalog({ ...fake, apply: false, now: () => "now", log: (text) => logs.push(text) });
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/publish-catalog.test.mjs`
Expected: FAIL with `Cannot find module` for `./publish-catalog.mjs`.

- [ ] **Step 3: Implement the script**

Create `scripts/publish-catalog.mjs`:

```js
// Mirrors published KineVault exercise demonstrations into Track's Supabase
// project. Dry run by default; pass --apply to write. KineVault is read only
// with its publishable key, so the script sees what a published page sees.
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const demoBucket = "exercise-demos";
export const anatomyCredit =
  "Anatomy: Z-Anatomy (CC BY-SA 4.0); BodyParts3D © DBCLS (CC BY-SA 2.1 JP).";
const maxMediaBytes = 10 * 1024 * 1024;
const textLimit = 400;
const catalogColumns =
  "id,slug,name,aliases,muscle_group,equipment,status,video_path,poster_path,credit,published_at";
const comparedFields = [
  "slug",
  "name",
  "aliases",
  "muscle_group",
  "equipment",
  "status",
  "video_path",
  "poster_path",
  "credit",
  "published_at",
];

const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

export function demoCredit({ licenseName, sourceCredit }) {
  const credit = sourceCredit?.trim() ?? "";
  const parts = ["Demonstration: KineVault."];
  if (credit) parts.push(sentence(credit));
  if (!/z-anatomy/i.test(credit)) parts.push(anatomyCredit);
  if (licenseName?.trim()) parts.push(`License: ${sentence(licenseName.trim())}`);
  return parts.join(" ").slice(0, 1000);
}

function joinNames(names) {
  const unique = [...new Set(names.filter(Boolean).map((name) => name.trim()).filter(Boolean))];
  let text = "";
  for (const name of unique.sort((a, b) => a.localeCompare(b))) {
    const next = text ? `${text}, ${name}` : name;
    if (next.length > textLimit) break;
    text = next;
  }
  return text;
}

function rootName(muscles, id) {
  let muscle = muscles.get(id);
  const seen = new Set();
  while (muscle?.parent_id && muscles.has(muscle.parent_id) && !seen.has(muscle.id)) {
    seen.add(muscle.id);
    muscle = muscles.get(muscle.parent_id);
  }
  return muscle?.name;
}

function newestReplacements(replacements) {
  const newest = new Map();
  const ordered = [...replacements].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const item of ordered) {
    const key = `${item.storage_bucket}/${item.original_path}`;
    if (!newest.has(key)) newest.set(key, item);
  }
  return newest;
}

function chooseMediaGroup(media, scenes) {
  const groups = new Map();
  for (const item of media) {
    if (item.kind !== "mp4" && item.kind !== "poster") continue;
    const group = groups.get(item.asset_group_id) ?? {};
    group[item.kind] = item;
    groups.set(item.asset_group_id, group);
  }
  const score = ({ mp4 }) => [
    mp4.camera_angle && mp4.camera_angle === scenes.get(mp4.scene_id)?.default_camera_angle ? 1 : 0,
    mp4.character_presentation === "neutral" ? 1 : 0,
    Date.parse(mp4.created_at),
  ];
  const complete = [...groups.values()].filter((group) => group.mp4 && group.poster);
  complete.sort((a, b) => {
    const [left, right] = [score(a), score(b)];
    return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
  });
  return complete[0] ?? null;
}

function resolved(item, replacements) {
  const replacement = replacements.get(`${item.storage_bucket}/${item.storage_path}`);
  return {
    bucket: item.storage_bucket,
    path: replacement?.replacement_path ?? item.storage_path,
    licenseName: replacement?.license_name ?? item.license_name,
    sourceCredit: replacement?.source_credit ?? item.source_credit,
  };
}

export function buildSourceExercises(raw) {
  const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
  const contents = byId(raw.contents);
  const muscles = byId(raw.muscles);
  const equipment = byId(raw.equipment);
  const scenes = byId(raw.scenes);
  const replacements = newestReplacements(raw.replacements);
  const sources = [];
  const skipped = [];
  for (const exercise of raw.exercises) {
    if (exercise.status !== "published") continue;
    const content = contents.get(exercise.current_content_id);
    const name = content?.name?.trim();
    if (!name || name.length > textLimit) {
      skipped.push({ slug: exercise.slug, reason: "no usable current content" });
      continue;
    }
    const own = (rows) => rows.filter((row) => row.content_id === content.id);
    const group = chooseMediaGroup(own(raw.media), scenes);
    if (!group) {
      skipped.push({ slug: exercise.slug, reason: "no complete MP4 and poster" });
      continue;
    }
    const video = resolved(group.mp4, replacements);
    const poster = resolved(group.poster, replacements);
    const aliases = [...new Set(own(raw.aliases).map((row) => row.alias.trim()))]
      .filter((alias) => alias && alias.length <= textLimit)
      .filter((alias) => alias.toLowerCase() !== name.toLowerCase())
      .slice(0, 50);
    sources.push({
      id: exercise.id,
      slug: exercise.slug,
      name,
      aliases,
      muscleGroup: joinNames(
        own(raw.exerciseMuscles)
          .filter((row) => row.role === "primary")
          .map((row) => rootName(muscles, row.muscle_id)),
      ),
      equipment: joinNames(
        own(raw.exerciseEquipment)
          .filter((row) => row.role === "required")
          .map((row) => equipment.get(row.equipment_id)?.name),
      ),
      publishedAt: exercise.published_at ?? null,
      video: { bucket: video.bucket, path: video.path },
      poster: { bucket: poster.bucket, path: poster.path },
      credit: demoCredit(video),
    });
  }
  return { sources, skipped };
}

export function checkMedia(bytes, kind) {
  if (bytes.byteLength === 0 || bytes.byteLength > maxMediaBytes)
    throw new Error(`The ${kind} size is outside 1 byte to 10 MB.`);
  const ascii = (start, end) => Buffer.from(bytes.subarray(start, end)).toString("latin1");
  if (kind === "video" && ascii(4, 8) !== "ftyp") throw new Error("The video is not an MP4 file.");
  if (kind === "poster" && (ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WEBP"))
    throw new Error("The poster is not a WebP file.");
}

export function mediaPath(id, bytes, extension) {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return `${id}/${hash}.${extension}`;
}

const comparable = (field, value) =>
  field === "published_at" && value ? Date.parse(value) : JSON.stringify(value ?? null);

export function planCatalogPublish({ sources, current, now }) {
  const currentById = new Map(current.map((row) => [row.id, row]));
  const upserts = [];
  for (const source of sources) {
    const row = {
      id: source.id,
      slug: source.slug,
      name: source.name,
      aliases: source.aliases,
      muscle_group: source.muscleGroup,
      equipment: source.equipment,
      status: "published",
      video_path: source.videoPath,
      poster_path: source.posterPath,
      credit: source.credit,
      published_at: source.publishedAt,
    };
    const existing = currentById.get(source.id);
    const changed =
      !existing ||
      comparedFields.some(
        (field) => comparable(field, existing[field]) !== comparable(field, row[field]),
      );
    if (changed) upserts.push({ ...row, updated_at: now });
  }
  const live = new Set(sources.map((source) => source.id));
  const withdrawals = current
    .filter((row) => row.status === "published" && !live.has(row.id))
    .map((row) => row.id);
  return { upserts, withdrawals };
}

export function describePlan({ plan, uploads, skipped, apply }) {
  const lines = [
    `${apply ? "Publishing:" : "Dry run:"} ${plan.upserts.length} catalog rows to write, ${plan.withdrawals.length} to withdraw, ${uploads.length} files to upload.`,
  ];
  for (const row of plan.upserts) lines.push(`  write ${row.slug}`);
  for (const id of plan.withdrawals) lines.push(`  withdraw ${id}`);
  for (const file of uploads) lines.push(`  upload ${file.path} (${file.bytes.byteLength} bytes)`);
  for (const item of skipped) lines.push(`  skip ${item.slug}: ${item.reason}`);
  if (!apply) lines.push("Nothing was written. Run again with --apply to publish.");
  return lines.join("\n");
}

export async function publishCatalog({
  kinevault,
  track,
  apply = false,
  now = () => new Date().toISOString(),
  log = console.log,
}) {
  const { sources, skipped } = buildSourceExercises(await kinevault.readRaw());
  const located = [];
  const files = [];
  // A download or format failure stops the run before anything is written, so
  // a temporary problem can't withdraw a demo.
  for (const source of sources) {
    const video = await kinevault.download(source.video);
    const poster = await kinevault.download(source.poster);
    checkMedia(video, "video");
    checkMedia(poster, "poster");
    const videoPath = mediaPath(source.id, video, "mp4");
    const posterPath = mediaPath(source.id, poster, "webp");
    located.push({ ...source, videoPath, posterPath });
    files.push(
      { path: videoPath, bytes: video, contentType: "video/mp4" },
      { path: posterPath, bytes: poster, contentType: "image/webp" },
    );
  }
  const current = await track.readRows();
  const existing = await track.listObjects(located.map((source) => source.id));
  const uploads = files.filter((file) => !existing.has(file.path));
  const plan = planCatalogPublish({ sources: located, current, now: now() });
  log(describePlan({ plan, uploads, skipped, apply }));
  if (apply) {
    // Files first, so a written row never points at a missing object.
    for (const file of uploads) await track.upload(file);
    if (plan.upserts.length) await track.upsertRows(plan.upserts);
    if (plan.withdrawals.length) await track.withdraw(plan.withdrawals, now());
  }
  return { plan, uploads, skipped };
}

const pageSize = 1000;
async function readAll(build, label) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new Error(`Couldn't read ${label}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
async function readIn(client, table, columns, column, values) {
  const unique = [...new Set(values)];
  const rows = [];
  for (let start = 0; start < unique.length; start += 200) {
    const part = unique.slice(start, start + 200);
    rows.push(
      ...(await readAll(() => client.from(table).select(columns).in(column, part).order(column), table)),
    );
  }
  return rows;
}
const serverClient = (url, key) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

export function kinevaultPort(url, key) {
  const client = serverClient(url, key);
  return {
    async readRaw() {
      const exercises = await readAll(
        () =>
          client
            .from("exercises")
            .select("id,slug,status,current_content_id,published_at")
            .eq("status", "published")
            .order("id"),
        "exercises",
      );
      const ids = exercises.map((row) => row.current_content_id).filter(Boolean);
      const [contents, aliases, exerciseMuscles, exerciseEquipment, scenes, media, muscles, equipment] =
        await Promise.all([
          readIn(client, "exercise_content", "id,name", "id", ids),
          readIn(client, "exercise_aliases", "content_id,alias", "content_id", ids),
          readIn(client, "exercise_muscles", "content_id,muscle_id,role", "content_id", ids),
          readIn(client, "exercise_equipment", "content_id,equipment_id,role", "content_id", ids),
          readIn(client, "exercise_scenes", "id,content_id,default_camera_angle", "content_id", ids),
          readIn(
            client,
            "exercise_media",
            "content_id,scene_id,asset_group_id,kind,storage_bucket,storage_path,camera_angle,character_presentation,license_name,source_credit,created_at",
            "content_id",
            ids,
          ),
          readAll(() => client.from("muscles").select("id,name,parent_id").order("id"), "muscles"),
          readAll(() => client.from("equipment").select("id,name").order("id"), "equipment"),
        ]);
      const replacements = await readIn(
        client,
        "media_render_replacements",
        "storage_bucket,original_path,replacement_path,license_name,source_credit,created_at",
        "original_path",
        media.map((row) => row.storage_path),
      );
      return { exercises, contents, aliases, exerciseMuscles, exerciseEquipment, scenes, media, muscles, equipment, replacements };
    },
    async download({ bucket, path }) {
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error) throw new Error(`Couldn't download ${bucket}/${path}: ${error.message}`);
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}

export function trackPort(url, serviceKey) {
  const client = serverClient(url, serviceKey);
  return {
    readRows: () =>
      readAll(() => client.from("catalog_exercises").select(catalogColumns).order("id"), "catalog_exercises"),
    async listObjects(ids) {
      const paths = new Set();
      for (const id of ids) {
        const { data, error } = await client.storage.from(demoBucket).list(id, { limit: 1000 });
        if (error) throw new Error(`Couldn't list ${demoBucket}/${id}: ${error.message}`);
        for (const object of data) paths.add(`${id}/${object.name}`);
      }
      return paths;
    },
    async upload({ path, bytes, contentType }) {
      const { error } = await client.storage
        .from(demoBucket)
        .upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });
      if (error) throw new Error(`Couldn't upload ${path}: ${error.message}`);
    },
    async upsertRows(rows) {
      const { error } = await client.from("catalog_exercises").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Couldn't write catalog rows: ${error.message}`);
    },
    async withdraw(ids, at) {
      const { error } = await client
        .from("catalog_exercises")
        .update({ status: "withdrawn", updated_at: at })
        .in("id", ids);
      if (error) throw new Error(`Couldn't withdraw catalog rows: ${error.message}`);
    },
  };
}

const requiredEnvironment = [
  "KINEVAULT_SUPABASE_URL",
  "KINEVAULT_SUPABASE_PUBLISHABLE_KEY",
  "TRACK_SUPABASE_URL",
  "TRACK_SUPABASE_SERVICE_ROLE_KEY",
];
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  const missing = requiredEnvironment.filter((name) => !env[name]?.trim());
  if (missing.length) {
    console.error(`Set ${missing.join(", ")}. See docs/exercise-demos.md.`);
    process.exitCode = 1;
  } else {
    // Keys are never logged.
    publishCatalog({
      kinevault: kinevaultPort(env.KINEVAULT_SUPABASE_URL, env.KINEVAULT_SUPABASE_PUBLISHABLE_KEY),
      track: trackPort(env.TRACK_SUPABASE_URL, env.TRACK_SUPABASE_SERVICE_ROLE_KEY),
      apply: process.argv.slice(2).includes("--apply"),
    }).catch((error) => {
      console.error(error instanceof Error ? error.message : "Publishing failed.");
      process.exitCode = 1;
    });
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test scripts/publish-catalog.test.mjs`
Expected: PASS. If the dry-run test reports a different upload count, check that `existing` defaults to an empty set.

- [ ] **Step 5: Add the npm script**

In `package.json` `scripts`, after `"foods:import"`, add:

```json
    "catalog:publish": "node --env-file-if-exists=.env.catalog.local scripts/publish-catalog.mjs",
```

`.env.catalog.local` is already ignored by `.env*.local` in `.gitignore`.

- [ ] **Step 6: Write `docs/exercise-demos.md`**

```markdown
# Exercise demos

Track shows KineVault's demonstration clips for exercises the user links to a
KineVault exercise. The design is in
[the spec](superpowers/specs/2026-10-13-kinevault-exercise-demos-design.md).

## How the clips reach Track

KineVault renders each approved exercise to MP4, WebM and WebP files on its own
local Supabase stack. `scripts/publish-catalog.mjs` copies the published ones
into Track's hosted project:

- `public.catalog_exercises`: one row per KineVault exercise. Anyone with the
  publishable key can read it; only the service role writes.
- `exercise-demos`: a public Storage bucket holding `<exercise id>/<hash>.mp4`
  and `<exercise id>/<hash>.webp`. Each name is a content hash, so a new render
  gets a new link and device caches stay correct.

The app (`src/exercise/demo/`) downloads the catalog list, keeps it on the
device for 24 hours, and links exercises through `ExerciseDefinition.catalog`.

## Publishing

1. Start KineVault's local Supabase stack (see KineVault's `LOCAL_USE.md`).
2. Create `.env.catalog.local` in this directory. Git ignores it.

   ```
   KINEVAULT_SUPABASE_URL=http://127.0.0.1:15421
   KINEVAULT_SUPABASE_PUBLISHABLE_KEY=<NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from KineVault/.env.local>
   TRACK_SUPABASE_URL=https://kkywpvkckxniriatelta.supabase.co
   TRACK_SUPABASE_SERVICE_ROLE_KEY=<Track's service role key>
   ```

3. `npm run catalog:publish` prints what would change and writes nothing.
4. `npm run catalog:publish -- --apply` uploads new files, then writes rows,
   then withdraws exercises KineVault no longer publishes.

Run it again after KineVault approves or re-renders exercises. Withdrawn rows
keep their files, so linked exercises show "Demonstration unavailable." instead
of breaking. A failed download stops the run before anything is written.

The script reads these KineVault tables: `exercises`, `exercise_content`,
`exercise_aliases`, `exercise_muscles`, `muscles`, `exercise_equipment`,
`equipment`, `exercise_scenes`, `exercise_media` and
`media_render_replacements`. If KineVault renames one, the dry run fails and
names it.

## Checking the migration

`scripts/validate-demo-catalog-postgres.sh` applies the migration and runs
`supabase/tests/exercise-demo-catalog.sql` on a private PostgreSQL cluster. Set
`PG_BINDIR` if PostgreSQL isn't on `PATH`, or use Docker:

```bash
docker run --rm -u postgres -v "$PWD":/repo:ro -e PG_BINDIR=/usr/lib/postgresql/17/bin postgres:17 \
  bash /repo/scripts/validate-demo-catalog-postgres.sh
```
```

- [ ] **Step 7: Run the full unit suite, lint and format**

Run: `npm test && npm run lint && npm run format:check`
Expected: all pass. Run `npm run format` first if `format:check` fails on the new files.

- [ ] **Step 8: Commit**

```bash
git add scripts/publish-catalog.mjs scripts/publish-catalog.test.mjs docs/exercise-demos.md package.json
git commit -m "Add a script that publishes KineVault demos to Track"
```

---

### Task 8: Player, provider and `expo-video`

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/app/(tabs)/_layout.tsx:36-120`
- Create: `src/exercise/demo/provider.tsx`, `src/exercise/demo/exercise-demo.tsx`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  - `DemoCatalogProvider({ children })`; `useDemoCatalog(): { state: DemoCatalogState; refreshIfStale(): Promise<void>; retry(): Promise<void> }`
  - `ExerciseDemo({ link: CatalogLink; label: string })` (testID `exercise-demo` when ready; Play control label `Play demonstration of ${label}`; Retry label `Retry loading the demonstration`)
  - `DemoThumbnail({ link: CatalogLink })` (testID `exercise-demo-thumbnail`)
  - `ExerciseDemoSlot({ exercise: ExerciseDefinition; label: string; disabled?: boolean; onLinkDemo?: (definition: ExerciseDefinition) => void })` ("Link demo" button with accessibility label `Link a KineVault demo to ${label}`)

UI components are verified by the browser tests in Tasks 9–11. This task's check is that the app type-checks, lints and bundles for web, iOS and Android.

- [ ] **Step 1: Install `expo-video`**

Run: `npx expo install expo-video`
Expected: `package.json` gains `"expo-video": "~57.0.5"` and `package-lock.json` updates. Do not add an `app.json` plugin entry; the plugin only configures background playback and picture-in-picture, which this feature doesn't use.

- [ ] **Step 2: Create the provider**

Create `src/exercise/demo/provider.tsx`:

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { useConnectivity } from "../../connectivity/provider";
import { createDemoCatalogStore, type DemoCatalogState } from "./catalog-store";
import { demoCatalogConfig } from "./config";

type DemoCatalogStore = ReturnType<typeof createDemoCatalogStore>;
const DemoCatalogContext = createContext<DemoCatalogStore | null>(null);

export function DemoCatalogProvider({ children }: PropsWithChildren) {
  const connectivity = useConnectivity();
  const [store] = useState(() =>
    createDemoCatalogStore({
      config: demoCatalogConfig,
      fetch: (url, init) => fetch(url, init),
      storage: AsyncStorage,
      now: Date.now,
    }),
  );
  useEffect(() => {
    void store.refreshIfStale();
  }, [store]);
  // A returning connection retries a failed first load or a stale copy.
  useEffect(() => {
    if (connectivity === "online") void store.refreshIfStale();
  }, [connectivity, store]);
  return <DemoCatalogContext.Provider value={store}>{children}</DemoCatalogContext.Provider>;
}

export function useDemoCatalog(): {
  state: DemoCatalogState;
  refreshIfStale: () => Promise<void>;
  retry: () => Promise<void>;
} {
  const store = useContext(DemoCatalogContext);
  if (!store) throw new Error("useDemoCatalog must be used inside DemoCatalogProvider");
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { state, refreshIfStale: store.refreshIfStale, retry: store.retry };
}
```

- [ ] **Step 3: Create the player components**

Create `src/exercise/demo/exercise-demo.tsx`:

```tsx
import { useEvent } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { AppButton } from "../../components/button";
import { Icon } from "../../components/icon";
import { AppText } from "../../components/ui";
import { useConnectivity } from "../../connectivity/provider";
import { useTheme } from "../../theme/provider";
import { radius, spacing } from "../../theme/tokens";
import type { CatalogLink, ExerciseDefinition } from "../model";
import { useExercises } from "../provider";
import { demoCatalogConfig, demoObjectUrl } from "./config";
import { demoStatus, resolveDemoLink } from "./demo-link";
import { useDemoCatalog } from "./provider";

function Frame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 4 / 3,
        borderRadius: radius.panel,
        overflow: "hidden",
        backgroundColor: colors.muted,
      }}
    >
      {children}
    </View>
  );
}

function DemoMessage({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View
      testID="exercise-demo-message"
      style={{
        borderRadius: radius.panel,
        backgroundColor: colors.muted,
        padding: spacing.layout,
        gap: spacing.sm,
      }}
    >
      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {text}
      </AppText>
      {onRetry && (
        <AppButton
          label="Retry"
          accessibilityLabel="Retry loading the demonstration"
          onPress={onRetry}
        />
      )}
    </View>
  );
}

function DemoVideo({ uri, label, onError }: { uri: string; label: string; onError: () => void }) {
  // Clips are cached on iOS and Android after the first view; the web build
  // relies on the browser's HTTP cache.
  const player = useVideoPlayer({ uri, useCaching: Platform.OS !== "web" }, (created) => {
    created.loop = true;
    created.muted = true;
    created.play();
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  useEffect(() => {
    if (status === "error") onError();
  }, [status, onError]);
  return (
    <VideoView
      testID="exercise-demo-video"
      player={player}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      accessibilityLabel={`Demonstration of ${label}`}
      style={{ flex: 1 }}
    />
  );
}

/** A KineVault demonstration: the poster first, then a muted loop after a tap. */
export function ExerciseDemo({ link, label }: { link: CatalogLink; label: string }) {
  const { colors } = useTheme();
  const catalog = useDemoCatalog();
  const offline = useConnectivity() === "offline";
  const [playing, setPlaying] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fail = useCallback(() => setMediaFailed(true), []);
  const config = demoCatalogConfig;
  if (!config) return <DemoMessage text="Demonstration unavailable." />;
  const status = demoStatus({ state: catalog.state, link, mediaFailed, offline });
  if (status.kind === "loading") return <DemoMessage text="Loading demonstration." />;
  if (status.kind === "connect")
    return (
      <DemoMessage text="Connect to load this demonstration." onRetry={() => void catalog.retry()} />
    );
  if (status.kind === "unavailable") return <DemoMessage text="Demonstration unavailable." />;
  if (status.kind === "failed")
    return (
      <DemoMessage
        text={
          status.offline
            ? "Connect to load this demonstration."
            : "Couldn't load this demonstration. Check your connection and try again."
        }
        onRetry={() => {
          setMediaFailed(false);
          setPlaying(false);
          setAttempt((value) => value + 1);
        }}
      />
    );
  return (
    <View testID="exercise-demo" style={{ gap: spacing.xs }}>
      <Frame>
        {playing ? (
          <DemoVideo
            key={`video-${attempt}`}
            uri={demoObjectUrl(config, status.videoPath)}
            label={label}
            onError={fail}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play demonstration of ${label}`}
            onPress={() => setPlaying(true)}
            style={{ flex: 1 }}
          >
            <Image
              key={`poster-${attempt}`}
              source={{ uri: demoObjectUrl(config, status.posterPath) }}
              cachePolicy="memory-disk"
              contentFit="contain"
              transition={0}
              accessible={false}
              onError={fail}
              style={{ flex: 1 }}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="play" size={18} color={colors.primaryForeground} />
              </View>
            </View>
          </Pressable>
        )}
      </Frame>
      <AppText variant="caption" muted>
        {status.entry.credit}
      </AppText>
    </View>
  );
}

/** A small 4:3 poster for search results; nothing when no published demo exists. */
export function DemoThumbnail({ link }: { link: CatalogLink }) {
  const { colors } = useTheme();
  const { state } = useDemoCatalog();
  const config = demoCatalogConfig;
  const entry = state.kind === "ready" ? state.byId.get(link.id) : undefined;
  if (!config || entry?.status !== "published" || !entry.posterPath) return null;
  return (
    <Image
      testID="exercise-demo-thumbnail"
      source={{ uri: demoObjectUrl(config, entry.posterPath) }}
      cachePolicy="memory-disk"
      contentFit="contain"
      transition={0}
      accessible={false}
      style={{ width: 64, height: 48, borderRadius: spacing.sm, backgroundColor: colors.muted }}
    />
  );
}

/**
 * The demo area of a workout or template exercise. Unlinked exercises show
 * "Link demo" only when the caller supports leaving for the exercise form and
 * the library definition still exists.
 */
export function ExerciseDemoSlot({
  exercise,
  label,
  disabled = false,
  onLinkDemo,
}: {
  exercise: ExerciseDefinition;
  label: string;
  disabled?: boolean;
  onLinkDemo?: (definition: ExerciseDefinition) => void;
}) {
  const store = useExercises();
  const library = store.state.kind === "ready" ? store.state.document.exercises : [];
  const link = resolveDemoLink(library, exercise);
  if (link) return <ExerciseDemo key={link.id} link={link} label={label} />;
  const definition = library.find((item) => item.id === exercise.id);
  if (!onLinkDemo || !definition) return null;
  return (
    <AppButton
      label="Link demo"
      accessibilityLabel={`Link a KineVault demo to ${label}`}
      accessibilityHint="Opens this exercise's form at its KineVault search"
      disabled={disabled}
      onPress={() => onLinkDemo(definition)}
    />
  );
}
```

`AppButton` accepts `accessibilityHint` (see `src/components/button.tsx:8`). If `VideoView` in `expo-video` 57 rejects `fullscreenOptions`, check `node_modules/expo-video/build/VideoView.types.d.ts` for the fullscreen prop name and use that; do not drop fullscreen.

- [ ] **Step 4: Mount the provider**

In `src/app/(tabs)/_layout.tsx`, add the import:

```tsx
import { DemoCatalogProvider } from "../../exercise/demo/provider";
```

and wrap `DayProvider` inside `ExerciseProvider`:

```tsx
              <ExerciseProvider>
                <DemoCatalogProvider>
                  <DayProvider>
                    {/* existing children unchanged */}
                  </DayProvider>
                </DemoCatalogProvider>
              </ExerciseProvider>
```

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run typecheck && npm test && npm run export:web`
Expected: all exit 0; the web export completes. Then run `npx expo export --platform ios --output-dir /tmp/kv-ios-check` and `npx expo export --platform android --output-dir /tmp/kv-android-check`; both must complete, matching what CI checks.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/exercise/demo/provider.tsx src/exercise/demo/exercise-demo.tsx "src/app/(tabs)/_layout.tsx"
git commit -m "Add the KineVault demo player and catalog provider"
```

---

### Task 9: Browser fixtures and workout placements

**Files:**
- Create: `tests/fixtures/demo-clip.webm`, `tests/fixtures/demo-poster.webp`, `tests/exercise-demo.browser.mjs`
- Modify: `tests/helpers/account-fixture.mjs:41-212`, `src/exercise/workout-editing.ts:14-19`, `src/app/(tabs)/exercise.tsx:128-133`, `src/exercise/session-editor.tsx:1-13,48-91`, `src/exercise/library-forms.tsx:371-373`, `src/exercise/search-results.tsx:40-55,142-147`, `tests/exercise.browser.mjs:1027-1060,1515-1531`

**Interfaces:**
- Consumes: `ExerciseDemoSlot`, `DemoThumbnail` (Task 8).
- Produces: `WorkoutView` exercise kind `{ kind: "exercise"; exercise?: ExerciseDefinition; linkDemo?: boolean; returnTo?: WorkoutView }` (Task 10 reads `linkDemo`); account fixture state gains `catalog: object[]`, `catalogFailure: boolean`, `demoMediaFailure: boolean`.

Browser tests run against a running web build. Start one before running them: `npm run web` (Metro on 8081), then in another terminal run the test command with `KINE_PREVIEW_URL=http://localhost:8081`.

- [ ] **Step 1: Create the media fixtures**

```bash
ffmpeg -y -f lavfi -i color=c=0x314e65:s=64x64:d=1:r=24 -c:v libvpx-vp9 -b:v 40k -an tests/fixtures/demo-clip.webm
ffmpeg -y -f lavfi -i color=c=0x94bdd7:s=64x64 -frames:v 1 -c:v libwebp tests/fixtures/demo-poster.webp
ls -l tests/fixtures/demo-clip.webm tests/fixtures/demo-poster.webp
```

Expected: two files, each under 10 KB. The clip is VP9 WebM even though the app requests `.mp4`: Playwright's Chromium may lack H.264, and Chromium sniffs the container, so it plays.

- [ ] **Step 2: Serve catalog rows and media from the account fixture**

In `tests/helpers/account-fixture.mjs`, add at the top:

```js
import { readFile } from "node:fs/promises";

// The clip is VP9 WebM because Playwright's Chromium may lack H.264.
const demoMedia = {
  webp: ["image/webp", new URL("../fixtures/demo-poster.webp", import.meta.url)],
  mp4: ["video/webm", new URL("../fixtures/demo-clip.webm", import.meta.url)],
};
```

In the `state` object inside `installAccountFixture`, add:

```js
    catalog: [],
    catalogFailure: false,
    demoMediaFailure: false,
```

Inside the `context.route(...)` handler, before the final `return json(route, { message: \`Unexpected fixture request: ...\` }, 404);`, add:

```js
    if (url.pathname === "/rest/v1/catalog_exercises") {
      if (state.catalogFailure) return json(route, { message: "Fixture catalog unavailable" }, 503);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 1000);
      return json(route, state.catalog.slice(offset, offset + limit));
    }
    if (url.pathname.startsWith("/storage/v1/object/public/exercise-demos/")) {
      const media = demoMedia[url.pathname.split(".").pop()];
      if (state.demoMediaFailure || !media) return json(route, { message: "Object not found" }, 404);
      return route.fulfill({
        status: 200,
        contentType: media[0],
        headers: { "cache-control": "no-store" },
        body: await readFile(media[1]),
      });
    }
```

- [ ] **Step 3: Write the failing workout browser tests**

Create `tests/exercise-demo.browser.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { installAccountFixture } from "./helpers/account-fixture.mjs";
import { launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const storageKey = "kinevault-track.exercise.v1";
const time = new Date("2026-10-04T12:00:00+03:00");
const answers = {
  name: "Demo fixture",
  goal: "maintain",
  activity: "moderate",
  age: "30",
  height: "180",
  weight: "80",
  sex: "male",
  estimateEnabled: true,
  eligible: true,
  customCalories: "",
};
const pressId = "3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192";
const raiseId = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const credit =
  "Demonstration: KineVault. Anatomy: Z-Anatomy (CC BY-SA 4.0); BodyParts3D © DBCLS (CC BY-SA 2.1 JP).";
const catalog = [
  {
    id: pressId,
    slug: "dumbbell-shoulder-press",
    name: "Dumbbell shoulder press",
    aliases: ["DB overhead press"],
    muscle_group: "Shoulders",
    equipment: "Dumbbell",
    status: "published",
    video_path: `${pressId}/0123456789abcdef.mp4`,
    poster_path: `${pressId}/fedcba9876543210.webp`,
    credit,
  },
  {
    id: raiseId,
    slug: "cable-lateral-raise",
    name: "Cable lateral raise",
    aliases: [],
    muscle_group: "Shoulders",
    equipment: "Cable",
    status: "withdrawn",
    video_path: null,
    poster_path: null,
    credit,
  },
];
const squat = {
  id: "squat",
  name: "Squat",
  muscleGroup: "Legs",
  equipment: "Barbell",
  notes: "",
  tracking: "single",
};
const press = {
  ...squat,
  id: "press",
  name: "Shoulder press",
  muscleGroup: "Shoulders",
  equipment: "Dumbbells",
  catalog: { id: pressId, slug: "dumbbell-shoulder-press" },
};
const raise = {
  ...squat,
  id: "raise",
  name: "Lateral raise",
  catalog: { id: raiseId, slug: "cable-lateral-raise" },
};
const historical = (exercises) => ({
  id: "history",
  date: "2026-10-04",
  name: "Historical workout",
  status: "completed",
  startedAt: null,
  durationSeconds: 1020,
  exercises: exercises.map((exercise) => ({
    id: `${exercise.id}-row`,
    exercise,
    sets: [{ id: `${exercise.id}-set`, kind: "single", reps: "5", weightKg: "40" }],
  })),
});
const documentWith = (exercises, extra = {}) => ({
  version: 1,
  exercises,
  workouts: [],
  sessions: [],
  developmentExamplesSeeded: true,
  ...extra,
});
const button = (scope, name) => scope.getByRole("button", { name, exact: true });
const field = (scope, name) => scope.getByRole("textbox", { name, exact: true });

async function open(t, document, fixtureState = {}) {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Jerusalem",
  });
  await context.addInitScript(
    ({ answers, key, raw }) => {
      if (!sessionStorage.getItem("demo-fixture-seeded")) {
        localStorage.setItem(
          "kinevault-track.profile.v1",
          JSON.stringify({ version: 1, kind: "complete", answers }),
        );
        localStorage.setItem(key, raw);
        sessionStorage.setItem("demo-fixture-seeded", "true");
      }
    },
    { answers, key: storageKey, raw: JSON.stringify(document) },
  );
  const fixture = await installAccountFixture(context);
  Object.assign(fixture, { catalog }, fixtureState);
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    // Deliberate 404/503 fixture responses are transport failures, not app errors.
    if (
      message.type() === "error" &&
      !(
        message.location().url.includes("kkywpvkckxniriatelta.supabase.co") &&
        message.text().startsWith("Failed to load resource:")
      )
    )
      runtimeErrors.push(message.text());
  });
  t.after(() => assert.deepEqual(runtimeErrors, [], "Demo flows should not emit runtime errors"));
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  await page.clock.install({ time });
  await page.goto(`${baseURL}/exercise`);
  await page.getByTestId("exercise-search-actions").waitFor();
  return { page, fixture };
}

async function openHistoricalWorkout(page) {
  await button(page, "Saved workouts").click();
  await button(page.getByTestId("workout-library"), "Edit logged workout Historical workout").click();
  await page.getByTestId("completed-workout-workspace").waitFor();
  return page.getByTestId("session-editor");
}

test("a linked exercise plays its demo from the workout detail", async (t) => {
  const { page } = await open(t, documentWith([press], { sessions: [historical([press])] }));
  const editor = await openHistoricalWorkout(page);
  await editor.getByText(credit, { exact: true }).waitFor();
  assert.equal(
    await editor.getByText("Exercise videos are upcoming with KineVault studio integration.").count(),
    0,
  );
  await button(editor, "Play demonstration of Shoulder press").click();
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    const source =
      video?.currentSrc || video?.src || video?.querySelector("source")?.src || "";
    return source.includes("/storage/v1/object/public/exercise-demos/");
  });
});

test("withdrawn demos are unavailable and failed media can be retried", async (t) => {
  const { page, fixture } = await open(
    t,
    documentWith([press, raise], { sessions: [historical([raise, press])] }),
    { demoMediaFailure: true },
  );
  const editor = await openHistoricalWorkout(page);
  await editor.getByText("Demonstration unavailable.", { exact: true }).waitFor();
  assert.equal(await button(editor, "Link a KineVault demo to Lateral raise").count(), 0);
  await button(editor, "Select exercise Shoulder press").click();
  await editor
    .getByText("Couldn't load this demonstration. Check your connection and try again.", {
      exact: true,
    })
    .waitFor();
  fixture.demoMediaFailure = false;
  await button(editor, "Retry loading the demonstration").click();
  await button(editor, "Play demonstration of Shoulder press").waitFor();
});

test("an unlinked exercise offers Link demo in the workout but not in the template", async (t) => {
  const template = { id: "upper", name: "Upper", exercises: [press, squat], setCounts: { press: 3, squat: 3 } };
  const { page } = await open(
    t,
    documentWith([press, squat], { workouts: [template], sessions: [historical([squat])] }),
  );
  const editor = await openHistoricalWorkout(page);
  await button(editor, "Link a KineVault demo to Squat").waitFor();
  await button(page, "Saved workouts").click();
  await button(page.getByTestId("workout-library"), "Edit workout Upper").click();
  const form = page.getByTestId("workout-form");
  await button(form, "Play demonstration of Shoulder press").waitFor();
  await button(form, "Select exercise Squat").click();
  assert.equal(await button(form, "Link a KineVault demo to Squat").count(), 0);
});

test("linked exercises show a poster thumbnail in search", async (t) => {
  const { page } = await open(t, documentWith([press, squat]));
  await field(page, "Search exercises").fill("s");
  await button(page, "Edit exercise Shoulder press").getByTestId("exercise-demo-thumbnail").waitFor();
  assert.equal(
    await button(page, "Edit exercise Squat").getByTestId("exercise-demo-thumbnail").count(),
    0,
  );
  assert.equal(
    await page.getByText("Exercise videos are upcoming with KineVault studio integration.").count(),
    0,
  );
});
```

- [ ] **Step 4: Run to verify they fail**

Run (with `npm run web` serving on 8081): `node --test tests/exercise-demo.browser.mjs`
Expected: FAIL. The workout tests time out waiting for the credit or the Play control, and the search test finds no thumbnail.

- [ ] **Step 5: Extend `WorkoutView`**

In `src/exercise/workout-editing.ts`, replace the `WorkoutView` type with:

```ts
export type WorkoutView =
  | {
      kind: "exercise";
      exercise?: ExerciseDefinition;
      /** Opened from "Link demo": focus the KineVault search. */
      linkDemo?: boolean;
      /** The workout to return to after Save or Cancel. */
      returnTo?: WorkoutView;
    }
  | { kind: "workout"; workout?: WorkoutTemplate }
  | { kind: "library"; date: string }
  | { kind: "session"; id: string; manual?: boolean; settings?: boolean }
  | { kind: "import"; source?: string };
```

- [ ] **Step 6: Return to the workout after the form closes**

In `src/app/(tabs)/exercise.tsx`, replace the `ExerciseForm` block with:

```tsx
          {content?.kind === "exercise" && (
            <ExerciseForm
              exercise={content.exercise}
              onClose={() =>
                content.returnTo
                  ? void open(content.returnTo)
                  : editing.closeView(panel.token)
              }
            />
          )}
```

- [ ] **Step 7: Session editor slot**

In `src/exercise/session-editor.tsx`, change the `workout-editing` import and add the slot import:

```tsx
import type { WorkoutEditing, WorkoutView } from "./workout-editing";
import { ExerciseDemoSlot } from "./demo/exercise-demo";
```

After the `useState` lines at the top of `SessionEditor`, add:

```tsx
  // Active workouts reopen on the default view; others reopen their panel.
  const returnTo: WorkoutView | undefined =
    session.status === "active" ? undefined : { kind: "session", id: session.id, manual };
```

In `renderExercise`, replace:

```tsx
        <AppText variant="caption" muted>
          Exercise videos are upcoming with KineVault studio integration.
        </AppText>
```

with:

```tsx
        <ExerciseDemoSlot
          exercise={row.exercise}
          label={rowLabel}
          disabled={busy}
          onLinkDemo={(definition) =>
            void editing.requestView({
              kind: "exercise",
              exercise: definition,
              linkDemo: true,
              returnTo,
            })
          }
        />
```

- [ ] **Step 8: Template detail slot**

In `src/exercise/library-forms.tsx`, add `import { ExerciseDemoSlot } from "./demo/exercise-demo";` and in `WorkoutForm` replace:

```tsx
            <AppText variant="caption" muted>
              Exercise videos are upcoming with KineVault studio integration.
            </AppText>
```

with:

```tsx
            {/* No "Link demo" here: leaving would discard unsaved template changes. */}
            <ExerciseDemoSlot exercise={selectedExercise} label={rowLabel} disabled={busy} />
```

- [ ] **Step 9: Search thumbnails**

In `src/exercise/search-results.tsx`, add `import { DemoThumbnail } from "./demo/exercise-demo";`. In `ExerciseResult`, insert before `<Icon name="user-pen" ... />`:

```tsx
        {exercise.catalog && <DemoThumbnail link={exercise.catalog} />}
```

In `ExerciseSearchResults`, delete:

```tsx
        <AppText variant="caption" muted>
          Exercise videos are upcoming with KineVault studio integration.
        </AppText>
```

- [ ] **Step 10: Update the old caption assertions**

In `tests/exercise.browser.mjs`, rename the test at line 1027 to `"exercise results keep long names readable without demo captions"` and change its caption assertion:

```js
    assert.equal(
      await page
        .getByText("Exercise videos are upcoming with KineVault studio integration.", {
          exact: true,
        })
        .count(),
      0,
    );
```

At lines 1525–1531, change the editor caption assertion to `0` and add after it:

```js
  assert.equal(await button(editor, "Link a KineVault demo to Squat").count(), 1);
```

- [ ] **Step 11: Run the browser tests**

Run: `node --test tests/exercise-demo.browser.mjs && node --test tests/exercise.browser.mjs`
Expected: PASS.

If the Play test fails because `expo-video` on web builds the `<video>` differently, inspect it with `await page.locator("video").evaluate((v) => v.outerHTML)`, and adjust only the source lookup in the test. If a test fails on an `expo-video` console message, fix its cause; widen the console filter only for a documented, harmless library message.

- [ ] **Step 12: Lint, typecheck, unit tests, commit**

```bash
npm run lint && npm run typecheck && npm test
git add tests/fixtures/demo-clip.webm tests/fixtures/demo-poster.webp tests/helpers/account-fixture.mjs tests/exercise-demo.browser.mjs tests/exercise.browser.mjs src/exercise/workout-editing.ts "src/app/(tabs)/exercise.tsx" src/exercise/session-editor.tsx src/exercise/library-forms.tsx src/exercise/search-results.tsx
git commit -m "Show KineVault demos in workouts, templates and search"
```

---

### Task 10: KineVault section in the exercise form

**Files:**
- Create: `src/exercise/demo/demo-picker.tsx`
- Modify: `src/exercise/controls.tsx:7-55`, `src/exercise/library-forms.tsx:23-127`, `src/app/(tabs)/exercise.tsx` (the `ExerciseForm` block)
- Test: `tests/exercise-demo.browser.mjs` (append)

**Interfaces:**
- Consumes: `createDemoCatalogSearch` (Task 3); `applyCatalogLink`, `withoutCatalogLink` (Task 5); `useDemoCatalog`, `ExerciseDemo`, `DemoThumbnail` (Task 8); `WorkoutView.linkDemo` and the `returnTo` flow (Task 9).
- Produces: `KineVaultDemoSection({ link, exerciseName, focusSearch, disabled, onLink, onUnlink })`; `ExerciseForm` prop `linkDemo?: boolean`; `ExerciseField` `autoFocus?: boolean`; result rows labelled `Link ${entry.name}`; buttons "Change KineVault demo", "Unlink KineVault demo", "Keep current demo", "Retry loading KineVault demos".

- [ ] **Step 1: Append the failing form tests**

Append to `tests/exercise-demo.browser.mjs`:

```js
test("linking from the form fills blank fields and saves the link", async (t) => {
  const { page } = await open(t, documentWith([squat]));
  await button(page, "Create Exercise").click();
  const form = page.getByTestId("exercise-form");
  await field(form, "Exercise name").fill("Overhead press");
  await field(form, "Find in KineVault").fill("db overhead");
  await form.getByText("1 KineVault exercise found.", { exact: true }).waitFor();
  await button(form, "Link Dumbbell shoulder press").click();
  assert.equal(await field(form, "Exercise name").inputValue(), "Overhead press");
  assert.equal(await field(form, "Muscle group (optional)").inputValue(), "Shoulders");
  assert.equal(await field(form, "Equipment (optional)").inputValue(), "Dumbbell");
  await form.getByText("Linked to Dumbbell shoulder press", { exact: true }).waitFor();
  await button(form, "Play demonstration of Overhead press").waitFor();
  await button(form, "Save exercise").click();
  await page.waitForFunction(
    (key) =>
      JSON.parse(window.accountFixture.getItem(key)).exercises.some(
        (exercise) => exercise.catalog?.slug === "dumbbell-shoulder-press",
      ),
    storageKey,
  );
});

test("Unlink removes the link and Change keeps it until another is chosen", async (t) => {
  const { page } = await open(t, documentWith([press]));
  await field(page, "Search exercises").fill("shoulder");
  await button(page, "Edit exercise Shoulder press").click();
  const form = page.getByTestId("exercise-form");
  await button(form, "Change KineVault demo").click();
  await button(form, "Keep current demo").click();
  await form.getByText("Linked to Dumbbell shoulder press", { exact: true }).waitFor();
  await button(form, "Unlink KineVault demo").click();
  await field(form, "Find in KineVault").waitFor();
  await button(form, "Save exercise").click();
  await page.waitForFunction(
    (key) => !("catalog" in JSON.parse(window.accountFixture.getItem(key)).exercises[0]),
    storageKey,
  );
});

test("Link demo opens the form at its search and returns to the workout", async (t) => {
  const { page } = await open(t, documentWith([squat], { sessions: [historical([squat])] }));
  const editor = await openHistoricalWorkout(page);
  await field(editor, "Squat set 1 reps").fill("6");
  await button(editor, "Link a KineVault demo to Squat").click();
  const form = page.getByTestId("exercise-form");
  const search = field(form, "Find in KineVault");
  await search.waitFor();
  assert.equal(await search.evaluate((element) => element === document.activeElement), true);
  await search.fill("shoulder press");
  await button(form, "Link Dumbbell shoulder press").click();
  assert.equal(await field(form, "Exercise name").inputValue(), "Squat");
  await button(form, "Save exercise").click();
  const returned = page.getByTestId("session-editor");
  await page.getByTestId("completed-workout-workspace").waitFor();
  assert.equal(await field(returned, "Squat set 1 reps").inputValue(), "6");
  await button(returned, "Play demonstration of Squat").waitFor();
});

test("a failed catalog load offers Retry in the form", async (t) => {
  const { page, fixture } = await open(t, documentWith([squat]), { catalogFailure: true });
  await button(page, "Create Exercise").click();
  const form = page.getByTestId("exercise-form");
  await form.getByText("Connect to search KineVault demos.", { exact: true }).waitFor();
  fixture.catalogFailure = false;
  await button(form, "Retry loading KineVault demos").click();
  await field(form, "Find in KineVault").waitFor();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/exercise-demo.browser.mjs`
Expected: the four new tests FAIL waiting for the "Find in KineVault" field or "Change KineVault demo"; the Task 9 tests still pass.

- [ ] **Step 3: Add `autoFocus` to `ExerciseField`**

In `src/exercise/controls.tsx`, add `autoFocus = false` to the destructured props, `autoFocus?: boolean;` to the prop type, and `autoFocus={autoFocus}` to the `TextInput`.

- [ ] **Step 4: Create the section**

Create `src/exercise/demo/demo-picker.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { AppButton, ButtonRow } from "../../components/button";
import { AppText } from "../../components/ui";
import { useTheme } from "../../theme/provider";
import { radius, spacing } from "../../theme/tokens";
import { ExerciseField } from "../controls";
import type { CatalogLink } from "../model";
import type { CatalogExercise } from "./catalog";
import { createDemoCatalogSearch } from "./catalog-search";
import { DemoThumbnail, ExerciseDemo } from "./exercise-demo";
import { useDemoCatalog } from "./provider";

function DemoResult({
  entry,
  disabled,
  onPress,
}: {
  entry: CatalogExercise;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const metadata = [entry.muscleGroup, entry.equipment].filter(Boolean).join(" · ");
  return (
    <Pressable
      testID="kinevault-demo-result"
      accessibilityRole="button"
      accessibilityLabel={`Link ${entry.name}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        padding: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        borderWidth: 1,
        borderRadius: radius.control,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.accent : colors.background,
      })}
    >
      <DemoThumbnail link={entry} />
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <AppText variant="label">{entry.name}</AppText>
        {Boolean(metadata) && (
          <AppText variant="caption" muted>
            {metadata}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

/** The exercise form's KineVault demo: search and link, or preview and unlink. */
export function KineVaultDemoSection({
  link,
  exerciseName,
  focusSearch = false,
  disabled,
  onLink,
  onUnlink,
}: {
  link: CatalogLink | undefined;
  exerciseName: string;
  focusSearch?: boolean;
  disabled: boolean;
  onLink: (entry: CatalogExercise) => void;
  onUnlink: () => void;
}) {
  const catalog = useDemoCatalog();
  const { refreshIfStale } = catalog;
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    void refreshIfStale();
  }, [refreshIfStale]);
  const entries = catalog.state.kind === "ready" ? catalog.state.entries : null;
  const search = useMemo(() => createDemoCatalogSearch(entries ?? []), [entries]);
  const results = query.trim() ? search(query) : [];
  const linked =
    link && catalog.state.kind === "ready" ? catalog.state.byId.get(link.id) : undefined;
  const label = exerciseName.trim() || "this exercise";
  const showLinked = link !== undefined && !changing;
  return (
    <View testID="kinevault-demo" style={{ gap: spacing.layout }}>
      <AppText variant="label">KineVault demo</AppText>
      {showLinked ? (
        <>
          <ExerciseDemo key={link.id} link={link} label={label} />
          <AppText variant="caption" muted>
            {`Linked to ${linked?.name ?? link.slug}`}
          </AppText>
          <ButtonRow>
            <AppButton
              label="Change"
              accessibilityLabel="Change KineVault demo"
              fill
              disabled={disabled}
              onPress={() => setChanging(true)}
            />
            <AppButton
              label="Unlink"
              accessibilityLabel="Unlink KineVault demo"
              fill
              disabled={disabled}
              onPress={onUnlink}
            />
          </ButtonRow>
        </>
      ) : catalog.state.kind === "failed" ? (
        <>
          <AppText variant="caption" muted accessibilityLiveRegion="polite">
            Connect to search KineVault demos.
          </AppText>
          <AppButton
            label="Retry"
            accessibilityLabel="Retry loading KineVault demos"
            onPress={() => void catalog.retry()}
          />
        </>
      ) : (
        <>
          <ExerciseField
            label="Find in KineVault"
            value={query}
            onChange={setQuery}
            disabled={disabled || catalog.state.kind === "loading"}
            autoFocus={focusSearch}
          />
          {query.trim() !== "" && (
            <AppText variant="caption" muted accessibilityLiveRegion="polite">
              {results.length
                ? `${results.length} KineVault ${results.length === 1 ? "exercise" : "exercises"} found.`
                : "No KineVault exercises found. Try another name."}
            </AppText>
          )}
          {results.map((entry) => (
            <DemoResult
              key={entry.id}
              entry={entry}
              disabled={disabled}
              onPress={() => {
                onLink(entry);
                setChanging(false);
                setQuery("");
              }}
            />
          ))}
        </>
      )}
      {link !== undefined && changing && (
        <AppButton
          label="Keep current demo"
          disabled={disabled}
          onPress={() => setChanging(false)}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 5: Wire it into `ExerciseForm`**

In `src/exercise/library-forms.tsx`:

1. Add imports:

```tsx
import { KineVaultDemoSection } from "./demo/demo-picker";
import { applyCatalogLink, withoutCatalogLink } from "./demo/demo-link";
```

2. Change the `ExerciseForm` signature:

```tsx
export function ExerciseForm({
  exercise,
  linkDemo = false,
  onClose,
}: {
  exercise?: ExerciseDefinition;
  /** Opened from "Link demo": focus the KineVault search. */
  linkDemo?: boolean;
  onClose: () => void;
}) {
```

3. After the tracking caption (`Leave weight blank for bodyweight. Changes apply to future workouts.`) and before `<ExerciseError message={error} />`, add:

```tsx
      <KineVaultDemoSection
        link={values.catalog}
        exerciseName={values.name}
        focusSearch={linkDemo}
        disabled={busy}
        onLink={(entry) => setValues((current) => applyCatalogLink(current, entry))}
        onUnlink={() => setValues(withoutCatalogLink)}
      />
```

`values` already has type `Omit<ExerciseDefinition, "id">`, which is `ExerciseFields`.

4. In `src/app/(tabs)/exercise.tsx`, pass the flag: add `linkDemo={content.linkDemo}` to the `ExerciseForm` element after `exercise={content.exercise}`.

- [ ] **Step 6: Run the browser tests**

Run: `node --test tests/exercise-demo.browser.mjs && node --test tests/exercise.browser.mjs`
Expected: PASS. If the Link demo round trip loses the "6" rep entry, the completed-workout draft is not surviving the panel change; investigate `requestView`'s flush for completed sessions in `src/exercise/workout-editing.ts` before changing the test.

- [ ] **Step 7: Lint, typecheck, unit tests, commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/exercise/demo/demo-picker.tsx src/exercise/controls.tsx src/exercise/library-forms.tsx "src/app/(tabs)/exercise.tsx" tests/exercise-demo.browser.mjs
git commit -m "Link KineVault demos from the exercise form"
```

---

### Task 11: Documentation

**Files:**
- Modify: `CONTEXT.md`, `TODO.md:26,109`, `PRODUCT.md:46-47,59,147`, `README.md:96-97,151`, `DESIGN.md:116-118`

- [ ] **Step 1: `CONTEXT.md` glossary**

After the **Exercise snapshot** entry, add:

```markdown
**Demo link**: An Exercise definition's optional reference to a published KineVault
exercise, chosen in the exercise form. Linking fills only blank name, muscle group
and equipment fields. Templates and logs show the library definition's current link,
or their saved copy's link when the library exercise was deleted.

**Exercise demo**: A linked exercise's muted KineVault clip, shown as a poster until
tapped, with its credit. A withdrawn KineVault exercise shows "Demonstration
unavailable." The demo list is public device data, cached for 24 hours and kept
across sign-out.
```

- [ ] **Step 2: `TODO.md`**

Line 26: change to `- [x] Integrate KineVault studio exercise videos: linked exercises play demos in workouts, templates and the exercise form, with search thumbnails. See docs/exercise-demos.md.`
Line 109: change to `12. [x] Exercise videos from the KineVault studio.`
Add under the open items near line 26: `- [ ] Apply the demo catalog migration to the hosted project, run the first catalog publish, and verify demo playback, fullscreen and offline replay on an iPhone and an Android device.`

- [ ] **Step 3: `PRODUCT.md`**

Replace `A compact caption identifies studio videos as upcoming;\nresults have no fake video tiles.` with `Exercises linked to KineVault show a small demo poster.`
Replace `with notes and an upcoming-video caption.` with `with notes and the exercise's KineVault demo, or a Link demo button.`
Replace `Timed holds, cardio, and the broader KineVault program integration remain future work.` with `KineVault demos come from published KineVault exercises (see docs/exercise-demos.md). Timed holds, cardio, coaching notes and the broader KineVault program integration remain future work.`

- [ ] **Step 4: `README.md` and `DESIGN.md`**

`README.md`: replace `Video playback\nand the friend's broader program features remain future work.` with `KineVault exercise demos are described in [Exercise demos](docs/exercise-demos.md); the friend's broader program features remain future work.` Replace `Search has a compact upcoming-studio caption; results have no fake video previews.` with `Exercises linked to KineVault show a demo poster thumbnail.`

`DESIGN.md`: replace `future catalog integration, which is not implemented in the Application.` with `the KineVault exercise demos in [docs/exercise-demos.md](docs/exercise-demos.md); the wider catalog is not part of the Application.`

- [ ] **Step 5: Format check and commit**

```bash
npm run format:check
git add CONTEXT.md TODO.md PRODUCT.md README.md DESIGN.md
git commit -m "Document KineVault exercise demos"
```

---

### Task 12: Full verification and rollout

Steps 3–6 change shared or external systems. Ask the user before each one and wait for an explicit yes.

- [ ] **Step 1: Full local checks**

Run: `npm run check && npm run export:web`
Then, with `npm run web` serving on 8081: `npm run test:browser`
Expected: all pass. Report failures with their output instead of skipping them.

- [ ] **Step 2: SQL checks**

Run: `bash scripts/validate-demo-catalog-postgres.sh` (or the Docker command from Task 6)
Expected: `Demo catalog SQL checks passed.`

- [ ] **Step 3: Apply the migration to the hosted project (ask first)**

Apply `supabase/migrations/20261013120000_exercise_demo_catalog.sql` to project `kkywpvkckxniriatelta` the same way `docs/supabase-setup.md` applied the earlier migrations. Then confirm there are no client write policies on Storage:

```sql
select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects';
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'exercise-demos';
```

Expected: no `insert`, `update` or `delete` policy that applies to `exercise-demos` for `anon` or `authenticated`; the bucket row is public with the 10 MB limit.

- [ ] **Step 4: Publish dry run, then apply (ask before `--apply`)**

With KineVault's local stack running and `.env.catalog.local` filled in: `npm run catalog:publish`. Show the user the report. After they approve: `npm run catalog:publish -- --apply`. Then check that a published row's poster URL loads:

```bash
curl -sI "https://kkywpvkckxniriatelta.supabase.co/storage/v1/object/public/exercise-demos/<id>/<hash>.webp" | head -5
```

Expected: `HTTP/2 200` and `content-type: image/webp`.

- [ ] **Step 5: Native build and device check (ask first)**

Build iOS through the "iOS unsigned build" workflow in `docs/ios-linux-xtool.md` and Android with the project's usual build. On each device: link an exercise, play the demo, use fullscreen, turn on airplane mode, and replay the same demo. Record the results in `TODO.md`.

- [ ] **Step 6: Tell KineVault's owner**

Draft a short message for the user to send. It should say that Track mirrors KineVault's published exercises (names, aliases, muscle groups, equipment, MP4 and poster, credits) into Track's project, and that the script reads their tables with the publishable key. The user decides whether and how to send it.

- [ ] **Step 7: Open the pull request (ask first)**

Push `feat/kinevault-exercise-demos` and open a PR against `main`. The description covers the behavior, the checks run, the spec link, screenshots of the player, form section and search thumbnails (from the web build), and the migration and publish steps. Link the PR to this thread.

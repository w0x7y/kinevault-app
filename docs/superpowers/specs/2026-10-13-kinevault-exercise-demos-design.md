# KineVault exercise demos in Track

The user approved this design in chat on 2026-10-13. It replaces the "video
coming" placeholders with demonstration clips rendered by the KineVault
workshop, and closes `TODO.md` "Integrate KineVault studio exercise videos".

## Background

KineVault renders each approved exercise's 3D motion into a short clip: 640×640,
24 fps, about 3.2 s, no audio, start → peak → start so it loops cleanly. Each
render produces an MP4 (H.264), a WebM (VP9) and a WebP poster. Timed coaching
notes are not burned in. iOS cannot play VP9, so Track uses the MP4 everywhere.

KineVault runs only on the owner's computer: its Next.js site and its Supabase
stack (database and Storage) are on localhost. Track's hosted project
(`kkywpvkckxniriatelta`) has none of KineVault's schema. KineVault has no public
API; published exercises are readable with its publishable key, and its
`exercise-public` bucket serves them through signed links.

A published KineVault exercise is identified by `exercises.id` (UUID) and
`exercises.slug`. `content_id` and `asset_group_id` change on every revision and
must not be stored.

## Decisions

| Question | Decision |
| --- | --- |
| Changes to the KineVault repo | None in this work. Any later KineVault change goes in a separate PR for its owner to review. |
| Where Track gets clips | A publish script in this repo copies published exercises into Track's hosted project. |
| Access | Public: anyone with the app's publishable key can read the catalog list and the clips. |
| Offline | Clips are cached after the first view. Posters use `expo-image`'s disk cache. |
| Linking | The user picks a KineVault exercise in the exercise form. No automatic name matching. |
| Default playback | Poster with a play button; the clip plays only after a tap. |
| Placements | Workout exercise detail, search result thumbnails, the exercise form, and fullscreen from the player. |
| Unlinked exercises | A "Link demo" button in the workout exercise detail opens the exercise form at its KineVault search. |
| Catalog data brought in | Clip, poster, credit, and the name, aliases, muscle group and equipment needed for search and prefill. |
| Live 3D in the app | Not pursued: it needs the 9.9 MB anatomy model and about 3,600 lines of browser-only pose and equipment code. |

## Track's backend

### Migration

A new migration in `supabase/migrations/` creates:

- **`public.catalog_exercises`**, one row per KineVault exercise ever published:

  | Column | Type | Notes |
  | --- | --- | --- |
  | `id` | `uuid` primary key | KineVault `exercises.id` |
  | `slug` | `text not null unique` | KineVault slug pattern `^[a-z0-9]+(-[a-z0-9]+)*$` |
  | `name` | `text not null` | 1–400 characters |
  | `aliases` | `text[] not null default '{}'` | At most 50 items of 1–400 characters |
  | `muscle_group` | `text not null default ''` | At most 400 characters |
  | `equipment` | `text not null default ''` | At most 400 characters |
  | `status` | `text not null` | `published` or `withdrawn` |
  | `video_path` | `text` | Object path in `exercise-demos` |
  | `poster_path` | `text` | Object path in `exercise-demos` |
  | `credit` | `text not null` | 1–1000 characters, shown under every clip |
  | `published_at` | `timestamptz` | From KineVault |
  | `updated_at` | `timestamptz not null default now()` | Set by the script |

  A check requires `video_path` and `poster_path` when `status = 'published'`.
  RLS is enabled with one `select` policy for `anon` and `authenticated` using
  `true`. Those roles get `select` only; writes go through the service role.

- **Storage bucket `exercise-demos`**: public, 10 MB file limit, MIME types
  `video/mp4` and `image/webp`. No client write policies.

### SQL tests

The repo's SQL tests are transactional scripts run on a private PostgreSQL
cluster, not pgTAP. `supabase/tests/exercise-demo-catalog.sql`, run by
`scripts/validate-demo-catalog-postgres.sh`, checks that `anon` and
`authenticated` can read `catalog_exercises`, cannot insert, update or delete
rows, and cannot write objects to `exercise-demos`; that the bucket is public
with the expected limits; and that a published row without media is rejected.

## Publish script

`scripts/publish-catalog.mjs`, run as `npm run catalog:publish`.

**Inputs** (environment, never committed):

- `KINEVAULT_SUPABASE_URL`, `KINEVAULT_SUPABASE_PUBLISHABLE_KEY`: the local
  KineVault stack. The script uses only the publishable key, so it sees exactly
  what a published KineVault page sees.
- `TRACK_SUPABASE_URL`, `TRACK_SUPABASE_SERVICE_ROLE_KEY`: Track's hosted
  project. The service key is read from the environment and never logged.

**For each published KineVault exercise** (`exercises.status = 'published'`):

1. Read the current content (`current_content_id`): name, aliases.
2. Muscle group: the distinct top-level ancestors of the `primary` muscles in
   `exercise_muscles`, ordered by name and joined with ", ". Equipment: the
   `required` rows in `exercise_equipment`, joined the same way.
3. Media: the `mp4` and `poster` rows in `exercise_media` for the current
   content. When several asset groups exist, prefer the scene's default camera
   angle with `neutral` presentation, then the newest group. Apply the newest
   `media_render_replacements` path for each object.
4. Download both objects through signed links on `exercise-public`.
5. Name each file by the first 16 hex characters of its SHA-256:
   `<exercise id>/<hash>.mp4` and `<exercise id>/<hash>.webp`. Upload only
   objects that don't already exist, with `cacheControl` of one year. A new
   render therefore gets a new path, and old links stay valid.
6. Credit: the media row's `source_credit` and `license_name` when present,
   followed by "Anatomy: Z-Anatomy (CC BY-SA 4.0); BodyParts3D © DBCLS
   (CC BY-SA 2.1 JP)."
7. Upsert the row with `status = 'published'`.

Rows in Track whose exercise is no longer published become `withdrawn`. Their
files stay in the bucket. Exercises without a complete MP4 and poster are
skipped and listed in the report.

**Modes**: the default is a dry run that prints the planned inserts, updates,
withdrawals, uploads and skips. `--apply` performs them. The core is a pure
planning function with injected KineVault and Track ports so it can be unit
tested without either service.

**Coupling**: the script depends on KineVault's table names. A KineVault schema
change means updating the script; the dry run fails loudly on missing tables or
columns.

## App changes

### Exercise link

`ExerciseDefinition` gains an optional `catalog: { id: string; slug: string }`.
`parseExerciseDefinition` validates the UUID and slug pattern and keeps the
field; `SaveExerciseInput` accepts it. Templates and logs copy definitions, so
their snapshots carry the link. No storage migration is needed because the
exercise document is stored as JSON.

`resolveDemoLink(document, exercise)` returns the link for a template or log
exercise. It uses the current library definition with the same ID when one
exists, even when that definition has no link, so unlinking applies everywhere.
It falls back to the snapshot's link when the library definition was deleted.
Linking an exercise later therefore shows its demo in existing workouts and
history.

Known gap: an older app build drops the unknown field when it saves, so a
device on an older build removes the link from the cloud copy. The user can
link again.

### Catalog on the device

New `src/exercise/demo/` module. It is not called "catalog" in code paths
because `CONTEXT.md` already uses that word for Custom foods and meals.

- **`catalog.ts`**: `CatalogExercise` type and `parseCatalogRow`, applying the
  same limits as the table. Invalid rows are dropped individually.
- **`catalog-store.ts`**: fetches every `catalog_exercises` row with the publishable key
  in pages of 500, capped at 5,000 rows, and keeps the result in AsyncStorage
  under `kinevault-track.demo-catalog.v1` with its fetch time. This is a device
  cache, not Account tracking, and is kept across sign-out. When the cache is
  more than 24 hours old it refreshes as the tabs open, when the connection
  returns, and when the exercise form's KineVault section opens. Offline, the
  saved copy is used. Fetch, storage and clock are injected.
- **`provider.tsx`**: `DemoCatalogProvider` and `useDemoCatalog()`, mounted
  inside the exercise provider. States: `loading`, `ready` (with the last fetch time),
  `failed` with no saved copy.
- **`catalog-search.ts`**: on-device search over published names and aliases.
  Words are accent-folded and lowercased, a trailing plural `s` is dropped,
  each query word must start a word in the name or an alias, and words of five
  or more letters may differ by one edit. Exact names rank first, then exact
  aliases, prefix matches and one-edit matches. Food search is not reused: its
  protected food words ("low", "high", "full") would misfire on exercise names.
- **`config.ts`**: reads the Supabase URL and publishable key and builds public
  object URLs for `exercise-demos`.
- **`demo-link.ts`**: `resolveDemoLink`, the player's status rules, and the
  form's link and unlink field updates.

### `ExerciseDemo` player

`src/exercise/demo/exercise-demo.tsx`, following `DESIGN.md` §12:

- A 4:3 frame with the `muted` well color and panel radius; the square clip is
  shown contained.
- Before playback: the poster (`expo-image`, `cachePolicy="memory-disk"`) with a
  44px Play button. Tapping anywhere on the poster starts playback.
- After the tap: an `expo-video` `VideoView` with native controls, muted,
  looping, with fullscreen enabled. The source is `{ uri, useCaching: true }`
  on iOS and Android; on web the browser's HTTP cache serves repeat views.
  Playback only starts from a tap, so reduced motion needs no extra handling.
- Only one player plays at a time. Switching exercises or leaving the view
  stops playback.
- The credit line sits under the frame in caption type.

States and copy:

| State | Shown |
| --- | --- |
| Linked, catalog entry published | Poster, then the clip |
| Linked, entry withdrawn or missing from the catalog | "Demonstration unavailable." in the muted panel |
| Catalog still loading for the first time | "Loading demonstration." in the muted panel |
| Clip or poster fails to load while offline | "Connect to load this demonstration." with Retry |
| Clip or poster fails to load while online | "Couldn't load this demonstration. Check your connection and try again." with Retry |
| Catalog never loaded and the fetch failed | "Connect to load this demonstration." with Retry |

Connectivity comes from the existing `useConnectivity()`.

### Placements

1. **Workout exercise detail.** In `session-editor.tsx`, the player replaces the
   video caption for planned, active, manual and completed workouts. An
   unlinked exercise shows a "Link demo" button instead, when its library
   definition still exists. The button uses the guarded `requestView`, so
   workout drafts are flushed first. It opens
   `{ kind: "exercise", exercise, linkDemo: true, returnTo }`, where `returnTo`
   is the workout view it came from. Save or Cancel in the form returns there.
2. **Template detail.** In `library-forms.tsx`, linked exercises show the
   player in place of the caption. Unlinked exercises show nothing: the
   template editor keeps unsaved changes in its own form state, and leaving it
   for the exercise form would discard them.
3. **Search results.** `ExerciseResult` shows a compact 4:3 poster thumbnail
   before the edit indicator for linked, published exercises. Other rows show
   no thumbnail and no caption. Tapping the row still opens the editor.
4. **Exercise form.** `ExerciseForm` gains a "KineVault demo" section:
   - Unlinked: a "Find in KineVault" search with results showing name, muscle
     group, equipment and a poster thumbnail. Choosing one links it and fills
     only blank name, muscle group and equipment fields.
   - Linked: the player, "Linked to <catalog name>", and Change and Unlink
     buttons.
   - The link is part of the form and is saved or discarded with it.
   - Opened through "Link demo", the form scrolls to and focuses the search.
   - With no catalog copy and no connection: "Connect to search KineVault
     demos." with Retry.
5. **Fullscreen.** Through the player's native controls on iOS and Android, and
   the browser's fullscreen on web.

### Dependency

`expo-video`, matching Expo SDK 57. It ships with the next native build; the
app has no over-the-air update channel.

### Documentation

Add "Exercise demo" and "Demo link" to `CONTEXT.md`, update `TODO.md`,
`PRODUCT.md` and `README.md`, and document the publish script and its
environment in `docs/exercise-demos.md`.

## Testing

- **Unit (`node:test`)**: link parsing and preservation through templates and
  logs; `resolveDemoLink` precedence; catalog row parsing and limits; catalog
  search including aliases and one-typo matches; store refresh, offline
  fallback and failure states; the publish plan for new, changed, unchanged,
  withdrawn and incomplete exercises.
- **SQL**: as listed under Track's backend.
- **Playwright on the web build**, with Supabase intercepted by the account
  fixture: link an exercise from the form and see prefill rules; thumbnail in
  search; poster then playback in a workout; "Link demo" round trip back to the
  workout with drafts intact; withdrawn state; load failure and Retry. Update
  the existing tests that assert the single video caption.
- **Native**: manual check on an iPhone and an Android device: playback,
  fullscreen, offline replay of a viewed clip. The repo has no automated native
  UI tests.

## Rollout

Each outward-facing step is confirmed with the user before it runs:

1. Apply the migration to the hosted project.
2. Run the publish script as a dry run against local KineVault, review the
   report, then run it with `--apply`.
3. Ship a native build that includes `expo-video`.
4. Tell KineVault's owner that its published catalog is mirrored into Track.

## Out of scope

Timed coaching notes, descriptions and instructions, detailed muscles, live 3D,
automatic name matching or suggestions (including during workout import),
pre-downloading clips, a "Link demo" path from the template editor, and any
change to the KineVault repo.

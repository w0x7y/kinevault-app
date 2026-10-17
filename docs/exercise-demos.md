# Exercise demos

Track shows KineVault's demonstration clips for exercises the user links to a
KineVault exercise. The design is in
[the spec](superpowers/specs/2026-10-13-kinevault-exercise-demos-design.md).

## Status

The migration `20261013120000_exercise_demo_catalog` was applied to the hosted
project on 2026-10-13 and is recorded in `supabase_migrations.schema_migrations`.
The first publish on 2026-10-14 added 10 demos curated in the local KineVault
stack with KineVault's `scripts/curate-local-demos.mjs` (five dumbbell/cable movements and,
with `--full-body`, five full-body movements).
On 2026-10-17 the same 10 were republished reframed (see below), straight from
the hosted copies, which are byte-identical to KineVault's renders.

On the current local Supabase, that curation script also needs
`grant select on public.render_jobs to service_role;` in KineVault's local
database: newer Supabase stacks no longer give the service role default table
grants, and the script reads render claims directly. KineVault's render step
needs `FFMPEG_PATH=/usr/bin/ffmpeg` when the bundled `ffmpeg-static` binary is
missing, and its `preview` step needs Google Chrome.

## How the clips reach Track

KineVault renders each approved exercise to MP4, WebM and WebP files on its own
local Supabase stack. Track copies only the MP4 and the WebP poster.
`scripts/publish-catalog.mjs` copies the published ones into Track's hosted
project:

- `public.catalog_exercises`: one row per KineVault exercise. Anyone with the
  publishable key can read it; only the service role writes.
- `exercise-demos`: a public Storage bucket holding `<exercise id>/<hash>.mp4`
  and `<exercise id>/<hash>.webp`. Each name is a content hash, so a new render
  gets a new link and device caches stay correct.

KineVault's renders show its viewer page: an off-white background, an
attribution strip and a menu button. Before uploading, the script reframes both
files with ffmpeg: it cuts the strip, pads the clip to the app's 4:3 frame and
replaces the page color with the dark backdrop `#232f3b` that the app's demo
frame also uses. The credit under each demo carries the attribution. If
KineVault changes its render size or layout, re-measure the crop in
`reframeFilter`.

The app (`src/exercise/demo/`) downloads the catalog list, keeps a copy on the
device, refreshes it once that copy is 24 hours old or older (or empty), and links exercises
through `ExerciseDefinition.catalog`. A saved copy loads at launch whatever its age;
while it is under 24 hours old and not empty, the app uses it without downloading.

When the serialized catalog exceeds 2,000,000 characters, the app stops saving new
copies. An older saved copy, if any, stays in storage and still loads at launch.
The app downloads the list when no saved copy exists or the saved one is 24 hours
old or more. Without a saved copy it has no offline list.

## Publishing

1. Start KineVault's local Supabase stack (see KineVault's `LOCAL_USE.md`).
2. Install ffmpeg, or set `FFMPEG_PATH` to its binary.
3. Create `.env.catalog.local` in this directory. Git ignores it.

   ```
   KINEVAULT_SUPABASE_URL=http://127.0.0.1:15421
   KINEVAULT_SUPABASE_PUBLISHABLE_KEY=<NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from KineVault/.env.local>
   TRACK_SUPABASE_URL=https://kkywpvkckxniriatelta.supabase.co
   TRACK_SUPABASE_SERVICE_ROLE_KEY=<Track's service role key>
   ```

4. `npm run catalog:publish` prints the rows it would insert, update and
   withdraw, the files it would upload and the exercises it skips. It writes
   nothing.
5. `npm run catalog:publish -- --apply` uploads new files, then writes rows,
   then withdraws exercises KineVault no longer publishes.

Run it again after KineVault approves or re-renders exercises. Withdrawn rows
keep their files, so linked exercises show "Demonstration unavailable." instead
of breaking. A failed download stops the run before anything is written.

An exercise KineVault still publishes but that has no complete MP4 and poster is
listed as a skip. Its current row stays as it is. Only exercises KineVault no
longer publishes are withdrawn. If KineVault reports no published exercises
while Track has some, the script stops without writing, in dry runs too. That
usually means the local stack isn't running or has no data. If KineVault
publishes a slug that a different Track row already holds, withdrawn rows
included, the script stops the same way and names the slug and both IDs.

Each row's credit reads "Demonstration: KineVault.", then the render's source
credit and license, then the anatomy notice. The notice is left out only when the
source credit already names both Z-Anatomy and BodyParts3D.

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

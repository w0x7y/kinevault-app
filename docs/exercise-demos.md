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

3. `npm run catalog:publish` prints the rows it would insert, update and
   withdraw, the files it would upload and the exercises it skips. It writes
   nothing.
4. `npm run catalog:publish -- --apply` uploads new files, then writes rows,
   then withdraws exercises KineVault no longer publishes.

Run it again after KineVault approves or re-renders exercises. Withdrawn rows
keep their files, so linked exercises show "Demonstration unavailable." instead
of breaking. A failed download stops the run before anything is written.

An exercise KineVault still publishes but that has no complete MP4 and poster is
listed as a skip. Its current row stays as it is. Only exercises KineVault no
longer publishes are withdrawn. If KineVault reports no published exercises
while Track has some, the script stops without writing, in dry runs too. That
usually means the local stack isn't running or has no data.

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

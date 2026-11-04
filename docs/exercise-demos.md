# Exercise demos

Track shows KineVault's demo clips for exercises linked to a KineVault exercise. The design is in [the spec](superpowers/specs/2026-10-13-kinevault-exercise-demos-design.md).

Migration `20261013120000_exercise_demo_catalog` is applied to the hosted project. Ten demos are live, curated with KineVault's `scripts/curate-local-demos.mjs`: five dumbbell and cable movements, and five full-body ones with `--full-body`.

## How it works

`scripts/publish-catalog.mjs` copies each published KineVault exercise's MP4 and WebP poster from KineVault's local Supabase stack into Track's hosted project:

| Where                            | What                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `public.catalog_exercises`       | One row per exercise. Anyone with the publishable key can read it; only the service role writes |
| `exercise-demos` (public bucket) | `<exercise id>/<hash>.mp4` and `<exercise id>/<hash>.webp`. A new render gets a new link        |

The script reframes both files with ffmpeg. It cuts KineVault's attribution strip, pads to 4:3 and swaps the page color for `#232f3b`. If KineVault changes its render size or layout, re-measure the crop in `reframeFilter`. The credit reads "Demonstration: KineVault.", then the source credit and license, then the anatomy notice, unless the source credit already names both Z-Anatomy and BodyParts3D.

The app (`src/exercise/demo/`) links exercises through `ExerciseDefinition.catalog`. It saves the catalog on the device and downloads a new one when the copy is missing, empty or 24 hours old. A catalog over 2,000,000 characters isn't saved, but an older saved copy still loads.

## Publish

1. Start KineVault's local Supabase stack (see KineVault's `LOCAL_USE.md`).
2. Install ffmpeg, or set `FFMPEG_PATH` to its binary.
3. Create `.env.catalog.local` in `Application/`. Git ignores it.

   ```
   KINEVAULT_SUPABASE_URL=http://127.0.0.1:15421
   KINEVAULT_SUPABASE_PUBLISHABLE_KEY=<NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from KineVault/.env.local>
   TRACK_SUPABASE_URL=https://kkywpvkckxniriatelta.supabase.co
   TRACK_SUPABASE_SERVICE_ROLE_KEY=<Track's service role key>
   ```

4. `npm run catalog:publish` prints what it would insert, update, withdraw, upload and skip. It writes nothing.
5. `npm run catalog:publish -- --apply` uploads files, writes rows, then withdraws exercises KineVault no longer publishes.

Run it again after KineVault approves or re-renders exercises. Withdrawn rows keep their files, so linked exercises show "Demonstration unavailable." instead of breaking. An exercise without a complete MP4 and poster is skipped, not withdrawn.

The script writes nothing if a download fails, if KineVault reports no published exercises while Track has some (the local stack is probably down or empty), if a slug belongs to a different Track row, or if KineVault renamed a table it reads.

On a newer local Supabase stack, curation needs `grant select on public.render_jobs to service_role;` in KineVault's database. KineVault's render step needs `FFMPEG_PATH=/usr/bin/ffmpeg` if `ffmpeg-static` is missing, and its `preview` step needs Google Chrome.

## Check the migration

`scripts/validate-demo-catalog-postgres.sh` applies the migration and runs `supabase/tests/exercise-demo-catalog.sql` on a private PostgreSQL cluster. Set `PG_BINDIR` if PostgreSQL isn't on `PATH`, or use Docker:

```bash
docker run --rm -u postgres -v "$PWD":/repo:ro -e PG_BINDIR=/usr/lib/postgresql/17/bin postgres:17 \
  bash /repo/scripts/validate-demo-catalog-postgres.sh
```

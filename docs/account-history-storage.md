# Food and workout history storage

The food and exercise providers still work with whole v1 documents. Storage splits them into calendar months under a manifest, with exercise definitions and saved templates in a separate `library` fragment. A session stays in the month of its saved date.

This is on for local storage. Cloud partitions need migration `20261008041229_bounded_history_partitions.sql`, not yet applied, and a build with `EXPO_PUBLIC_TRACK_PARTITIONS=true`. Until then, sync uses v1 documents.

## On the device

Changed months are written to new keys, then one root manifest write publishes them. If any write fails, the old manifest still holds, so a crash can leave orphan fragments but never half a change. Orphans are never read. Keys include the account or guest scope.

Legacy v1 values stay readable, and the first successful write migrates them with their pending edits and revision. Reads reject missing, corrupt or duplicated fragments.

## In the cloud

`track_document_partitions` holds a manifest and monthly fragments per history, keyed by `user_id` and guarded by ownership policies. The RPCs run as the caller.

- `save_track_partitioned_document` checks the revision and writes all changed months in one transaction. On the first save, the old v1 row stays as a frozen recovery copy.
- `list_track_partitioned_documents` returns only fragments newer than the cached revision, as a JSON array so PostgREST's row limit can't cut off months.

Conflicts are still per food log or exercise document. Two devices editing different months of one log still conflict, and the user picks a copy in Settings. Writes and downloads now scale with changed months, but the app still loads the whole history into memory. History isn't paged.

## Rollout

See [monthly cloud history rollout](history-migration-rollout.md) for the full gate. In short:

1. Run the migration and `supabase/tests/history-partitions.sql` in an isolated database. `npm test` already runs both in PGlite through `scripts/history-partitions.test.mjs`.
2. Apply it to the target project. That alone migrates no account.
3. Ship a build with `EXPO_PUBLIC_TRACK_PARTITIONS=true`. Each log migrates on its next successful save.
4. Announce the minimum supported version first. Older builds can read the frozen v1 copy, but their saves fail and keep the edits on the device until the user upgrades.

Don't turn the build setting off after migration. It exposes the stale v1 copy and breaks uploads. Don't delete frozen v1 rows while old pending edits may still need recovery.

## Tests

`npm test` covers the local and cloud adapters, conflicts and migration, and the SQL assertions in PGlite. Deployed Supabase permissions and real concurrent connections still need staging. Access rules follow the [Supabase row security guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

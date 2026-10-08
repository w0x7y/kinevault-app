# Food and workout history storage

Food and exercise providers still read and write their logical v1 documents. The storage adapters split the physical records into calendar months. Exercise definitions and saved workout templates occupy a separate `library` fragment. Planned, active, and completed sessions stay in the month of their saved date, including timer timestamps and historical exercise snapshots.

Local partition writes are enabled for account and guest storage. Cloud partition writes require the reviewed migration `20261008041229_bounded_history_partitions.sql` and a build with `EXPO_PUBLIC_TRACK_PARTITIONS=true`. The migration has not been applied to the shared database. Without that build setting, cloud sync continues using v1 documents.

## Local commits and recovery

A compact root manifest contains fragment references and the account envelope's revision, dirty flag, and sequence. Changed months are written to new keys before one root-key replacement publishes the complete document. Unchanged months keep their existing references. If a fragment or root write fails, the prior manifest stays authoritative. A process exit before the root commit can leave unreferenced fragments, but cannot publish half a workout move or lose the previous committed history.

Root keys and fragment keys include the existing account scope or guest scope. Deletion for an account writes a dirty manifest with `deleted: true`, preserving the revision for a cloud tombstone. Guest deletion removes the root first. Superseded fragments are retired after current readers finish. A stalled reader delays garbage collection; an interrupted process can leave orphan fragments. These unreferenced fragments are never read as history.

Legacy v1 local values remain readable. The first successful physical write migrates the value, including dirty edits, sequence, and cloud revision. Reads reject missing, corrupt, misplaced, or duplicated records. Valid replacement and reset read revision metadata independently of corrupt fragments, so recovery can preserve compare-and-swap semantics.

Day and session positions preserve the existing logical order without shifting every later month's records after a deletion. A deliberate reorder may change multiple months. Empty food days remain representable. The assembled document passes the existing domain parsers, including globally unique record IDs and the single-active-workout rule.

## Cloud transactions and conflicts

`track_document_partitions` has one manifest and bounded monthly fragments for each logical history key. Its primary key begins with `user_id`; all operations use ownership policies. The new functions run as the caller and verify the account identity. The legacy history guard also protects direct writes to `track_documents`.

`save_track_partitioned_document` checks the logical revision, writes changed fragments, removes obsolete months, and advances the manifest in one transaction. The first migration compares against the existing v1 row's revision. The existing whole-history v1 row remains a frozen recovery copy. Missing references or invalid fragment JSON roll back the entire batch.

Conflicts remain explicit at the existing food-log or exercise-document level. Two devices editing different months of the same log can still conflict. The user chooses the device or cloud version through the existing settings flow; this change does not merge competing edits automatically. One aggregate revision keeps month moves, library changes, and active-session transitions atomic.

`list_track_partitioned_documents` returns manifests and only fragments newer than the adapter's cached logical revision, using one database snapshot. It returns a JSON array so PostgREST's row limit cannot truncate historical months. Migrated v1 recovery rows are excluded from the legacy download. A new adapter still needs one complete historical download. An unchanged retry downloads only manifests for these histories.

This change bounds disk writes and incremental cloud payloads by the changed months and library, plus manifest metadata. Provider documents still assemble, serialize, and validate the full logical history in memory. Startup reads remain proportional to history size. The existing session-count limit remains in place. This is not a paged history reader or a change to provider interfaces.

## Rollout

1. Review the migration, execute it in an isolated Supabase database, and run `supabase/tests/history-partitions.sql`. The repository's `scripts/history-partitions.test.mjs` already executes the original migrations and these assertions in PGlite as part of `npm test`.
2. Apply the migration to the intended project after reviewing account policies and the legacy-client policy. No existing account migrates solely because the migration is installed.
3. Ship a supported build with `EXPO_PUBLIC_TRACK_PARTITIONS=true`. Each log migrates on its next successful save, after pending v1 edits pass their existing revision check or conflict resolution.
4. Keep partition support enabled for accounts that have migrated. Before migrating users, communicate the minimum supported client version. Older builds can read the frozen v1 recovery copy, but their attempts to save migrated histories fail explicitly and retain pending edits on the device. Upgrading reconstructs the current cloud history and surfaces those pending edits as conflicts instead of discarding them.

Disabling the build setting after migration exposes the frozen v1 recovery copy and makes new history uploads fail. A rollback therefore needs an explicit data export/reconciliation and supported-client plan; changing the environment setting alone is not a data rollback. Do not delete frozen v1 cloud rows until legacy pending-edit recovery is no longer required.

## Verification

The TypeScript tests exercise bounded local writes, failed commits, legacy dirty envelopes, account isolation, corrupt-fragment reset through AccountStorage, ordering, incremental cloud reads/writes, explicit cross-device conflicts, pending-edit migration, month moves, and tombstones. SQL assertions execute real migrations and test CAS rejection, transaction rollback, legacy-write refusal, deletion, incremental reads, and account/anonymous access restrictions. PGlite verifies PostgreSQL SQL execution and ownership rules; deployment-specific Supabase permissions and real concurrent database connections still require a staging check.

The database access rules follow the [Supabase row security guide](https://supabase.com/docs/guides/database/postgres/row-level-security). The existing provider persistence tests and browser exercise tests continue to exercise the public user flows.

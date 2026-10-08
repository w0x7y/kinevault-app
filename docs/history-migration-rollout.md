# Monthly cloud history rollout

The database migration and local PostgreSQL checks are ready for review. Real Supabase staging validation and rollout are pending. Keep `EXPO_PUBLIC_TRACK_PARTITIONS` disabled until the gates below pass.

## Environment findings, 2026-10-08

Read-only Management API inspection found one accessible project, `KineVault`, reference `kkywpvkckxniriatelta`, healthy in `ap-northeast-1`. No branches or separate staging project are visible to the supplied token. This is the existing shared project, not a staging target. Its server is PostgreSQL 17.11.

Its migration history contains `20261005150934_account_cloud_storage` and `20261005152713_track_role_assignment_index`. The bounded-history migration is absent, and only `public.track_documents` exists. Aggregate inspection found one exercise document, 485 bytes at revision 1, and one profile document, 264 bytes at revision 1. No food-log document exists. Each key has one account. These counts do not identify whether the keys belong to the same account. RLS is enabled and `anon` has no SELECT grant. No individual payload, identity, or personal record was read.

Docker is installed without an available daemon/socket. PostgreSQL was downloaded from the official Arch mirror and extracted under `/tmp/kinevault-pg-validation`; no system packages or shared database were changed. A private PostgreSQL 18.6 cluster passed the original SQL assertions, additional grant/RLS assertions, and seven concurrent writer races. This proves the SQL behavior on a real PostgreSQL engine with separate sessions. It does not prove the deployed PostgreSQL 17.11 version, PostgREST schema exposure, or Auth deletion endpoint behavior.

No remote migration, synthetic account creation, function deployment, project/branch creation, or flag activation was performed.

## Repeat the read-only inspection

Run from `Application`:

```bash
python3 scripts/inspect-history-cloud.py
```

The script reads the token internally from `SUPABASE_ACCESS_TOKEN` or `.env.auth.local`. It calls GET project/migration/branch endpoints and the read-only SQL endpoint, and outputs only inventory, schema security metadata, and aggregate counts. To inspect an already approved staging project, supply `--project-ref STAGING_REFERENCE`. Token visibility is the limit of this inventory; an unseen staging project may exist under another organization or token scope. Do not print env files or use shell tracing around credentials.

## Repeat the real PostgreSQL checks locally

Install or supply PostgreSQL binaries compatible with the host and run:

```bash
PG_BINDIR=/path/to/postgresql/bin bash scripts/validate-history-postgres.sh
```

For the extracted binaries used during this task:

```bash
LD_LIBRARY_PATH=/tmp/kinevault-pg-validation/usr/lib \
PG_BINDIR=/tmp/kinevault-pg-validation/usr/bin \
bash scripts/validate-history-postgres.sh
```

The wrapper creates a fresh cluster, disables TCP, uses a private Unix socket, installs only the three repository migrations plus minimal Supabase roles/auth prerequisites, and always removes its cluster on exit. It does not install dependencies or connect to a system PostgreSQL service. The PostgreSQL packages under `/tmp/kinevault-pg-validation` are disposable, not a repo dependency.

The Python runner executes both `supabase/tests/history-partitions.sql` and `supabase/tests/history-partitions-security.sql`. They roll back their fixtures. Concurrent tests commit random synthetic accounts so separate connections can see them, then remove those accounts. They check an actual advisory-lock wait through `pg_stat_activity` and `pg_blocking_pids`, release the winning transaction, and assert the loser result. All sessions have bounded timeouts.

Covered races include two first saves, two updates, legacy creation winning migration, legacy update winning migration, migration winning old creation, migration winning old update, and deletion winning stale resurrection. The assertions cover atomic failure rollback, incremental downloads, anonymous denial, ownership RLS, ownership reassignment, missing identity, invoker RPCs, frozen legacy bytes/revision, and deletion of both history representations and account metadata through `auth.users`.

## Proposed remote operation and staging gate

The parent should first select a separate existing Supabase staging project and review its schema baseline. The precise proposed mutation is to apply `supabase/migrations/20261008041229_bounded_history_partitions.sql` through the normal migration workflow on that reviewed project. Do not replay the two account migrations over an existing conflicting schema. Applying the migration alone creates the partition table, RPCs, grants/RLS, and legacy-write trigger; it does not move existing history or change the client flag.

Only after that operation is coordinated, authorize this runner to create/delete synthetic staging accounts and exercise writes. The runner never applies a migration itself and hard-refuses the shared project reference.

Use a privileged direct or session-pooler connection from Supabase's Connect panel. Credentials belong in environment variables or a private `.pgpass`, never a command argument or committed file. Set `PGDATABASE=postgres`, `PGPORT=5432`, `PGSSLMODE=require` or `verify-full`. Direct connections use `PGHOST=db.STAGING_REFERENCE.supabase.co` and the reviewed database user. Session-pooler connections use the provided `.pooler.supabase.com` host and `PGUSER=postgres.STAGING_REFERENCE`. Do not use transaction-pooler port 6543 because the tests hold transactions and inspect session state. Clear `PGSERVICE` and `PGHOSTADDR`.

```bash
KV_HISTORY_ALLOW_STAGING_WRITES=STAGING_REFERENCE \
python3 scripts/validate-history-postgres.py --staging-project-ref STAGING_REFERENCE
```

The connection must be able to insert/delete synthetic `auth.users`, SET ROLE to `authenticated`/`anon`, and see the test sessions in `pg_stat_activity`. An access token alone is not a database password. Do not reset the shared project's password to make a test work. The runner refuses preexisting reserved SQL fixture IDs. Random fixture accounts receive the existing account bootstrap trigger; their deletion verifies the live FK cascades. Cleanup runs on failure as well. If cleanup fails, remove only the generated test IDs and investigate before retrying.

Record the server version and all PASS lines in the release evidence. Require zero residual fixture rows and inspect schema/grants via the read-only script afterwards. If a session fails, use its `kv-holder-*` or `kv-contender-*` application name in database diagnostics. Fix the reported grant, SQLSTATE, or lock issue before rerunning.

SQL sessions do not exercise the Data API. On that same staging project, create two disposable users through the normal Auth flow and test authenticated RPC calls through the app/publishable key. Verify owner read/write, cross-account empty reads and denied writes, unsigned denial, and a legacy write rejection after migration. Verify a first complete download and a later manifest-only download through PostgREST. Never use a service-role client to claim that RLS passed. Delete both users through the account deletion endpoint and check aggregate residue with a privileged query. The SQL cascade test covers the FK path; the endpoint smoke test also covers token/session handling and server authorization.

## Supported-client policy

The current application/package version is `1.0.0`, and there is no authoritative stored client-version metadata. Do not infer a safe rollout cohort from sign-ins, mutable Auth user metadata, or a claimed version string. The existing server has no way to force an already shipped v1.0.0 client to show an upgrade screen.

Before activating monthly cloud saves, publish a distinctly identifiable supported release greater than `1.0.0`, record its native build numbers and web artifact, and confirm that it includes partition support, pending-edit recovery, and conflict resolution. The release owner chooses the final version. No version bump or dependency change is part of this staging task. Communicate the minimum supported version and direct download/update path before migration begins. If version enforcement is added later, store trusted server-managed release policy, not user-editable metadata.

Compatibility is enforced per history by the database trigger. After the first successful monthly save, an old client can still read that log's frozen v1 recovery copy but cannot upload to it. `save_track_document` and direct insert/update paths must fail with SQLSTATE `55000`. A save that was already stale may instead return no rows and enter ordinary conflict handling. The frozen copy is stale after migration, so an old client's successful read must not be presented as current cloud history. Profile, water, and custom-food keys retain their existing format and are not covered by the history guard.

The old upload refusal must leave the device's payload, revision, sequence, and dirty flag intact. Before release, test the actual shipped v1.0.0 build against synthetic staging history: make a pending offline edit, migrate the same log on the supported build, reconnect the old build, observe upload failure, restart it, and verify the pending edit remains. Upgrade in place without clearing app storage or signing out. The supported client must load the partitioned cloud version and surface the retained local edit as a conflict. Verify both explicit choices separately, keeping the device value and keeping the cloud value. Repository tests already cover retained legacy edits through restart and upgraded conflict resolution; they do not substitute for testing the shipped old binary.

`tests/history-rollout.test.ts` adds a regression check with a simulated refused legacy transport. It verifies the exact pending envelope survives two storage lifecycles, then checks both conflict choices after the transport exposes current cloud history. Run it with `node --experimental-strip-types --test tests/history-rollout.test.ts`; it is also included by the existing `npm test` pattern. This test uses current source, not an archived v1.0.0 executable.

## Account schema contract

Only `kinevault-track.exercise.v1` and `kinevault-track.food-log.v1` have cloud partitions. `kinevault-track.profile.v1` remains one document, including optional weight-log entries; no new document key is introduced.

The account export must reconstruct migrated histories from manifest/month/library fragments and exclude stale frozen copies from the current logical document set. It should preserve profile.v1 fields. Account deletion must delete the Auth user through the authorized server endpoint so FK cascades remove `track_documents`, `track_document_partitions`, `profiles`, `roles`, and `subscriptions`. Local-only media/export contents need the account agent's own verification. Revoking sessions is separate from FK cleanup; already issued JWTs are not invalidated solely by deleting an Auth user.

## Rollout and recovery

1. Complete the separate staging SQL, Data API, old-client upgrade, export, and deletion gates. Have the parent review the exact migration and target.
2. Apply the reviewed migration to the intended shared project only under the coordinated deployment operation. Run read-only checks of migration history, grants, RLS, and unchanged legacy aggregate counts before enabling a build.
3. Publish the supported release and record the artifact/version identifiers. Enable `EXPO_PUBLIC_TRACK_PARTITIONS=true` in the reviewed build. This is a build-time setting, not a server cohort switch. No account migrates until a successful history save. Initially validate with designated test accounts before distributing the artifact broadly.
4. Observe sync failures/conflicts, old-write SQLSTATE `55000`, migration/fragment counts, and export/delete results. Diagnostics must omit payloads, identities, JWTs, and tokens. Keep frozen v1 copies until the old pending-edit recovery window closes.

If migration installation fails before users migrate, stop and inspect the actual schema/migration transaction. Do not mark the migration applied manually. If supported clients have migrated history, retain partition support and the write guard. Disabling the build flag would expose stale v1 data and strand new uploads. Recovery requires a reviewed export/reconciliation with explicit revision handling, not a flag flip or dropping the partition table. Preserve both representations until that plan is verified.

## Primary references checked

- [Supabase changelog](https://supabase.com/changelog) and the [PostgreSQL 15.19/17.11 security update](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). The ltree/btree_gist/legacy pgcrypto issues do not affect these history objects.
- [Supabase Management API](https://supabase.com/docs/reference/api/introduction) and its [OpenAPI specification](https://api.supabase.com/api/v1-json), including the read-only SQL endpoint and token scopes.
- [Supabase row security](https://supabase.com/docs/guides/database/postgres/row-level-security), which requires both grants and ownership policies.
- [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data), including Auth-user cascades and JWT deletion behavior.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), including transaction-scoped advisory locks and diagnostics.

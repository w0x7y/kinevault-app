# Monthly cloud history rollout

`supabase/migrations/20261008041229_bounded_history_partitions.sql` isn't applied. Keep `EXPO_PUBLIC_TRACK_PARTITIONS` off until every gate below passes. [History storage](account-history-storage.md) explains the partitions.

## Current state

On 2026-10-08 the access token saw only the shared `KineVault` project (`kkywpvkckxniriatelta`, `ap-northeast-1`, PostgreSQL 17.11), with no branches or staging project. Since then `20261013120000_exercise_demo_catalog` ([exercise demos](exercise-demos.md)) and `20261018120000_account_deletion_attempts` ([account management](account-management.md#server-rollout)) were applied there.

## Checks

Read-only inventory, from `Application/`. It takes the token from `SUPABASE_ACCESS_TOKEN` or `.env.auth.local`. Add `--project-ref STAGING_REFERENCE` for a staging project.

```bash
python3 scripts/inspect-history-cloud.py
```

It only sees what the token can see. Don't print env files or trace the shell around credentials.

Local PostgreSQL, in a throwaway cluster on a private socket that's always removed:

```bash
PG_BINDIR=/path/to/postgresql/bin bash scripts/validate-history-postgres.sh
```

For binaries extracted to `/tmp/kinevault-pg-validation`, also set `LD_LIBRARY_PATH=/tmp/kinevault-pg-validation/usr/lib`. It runs `supabase/tests/history-partitions.sql` and `supabase/tests/history-partitions-security.sql`, including concurrent-writer races. Passing locally doesn't prove the deployed 17.11, PostgREST exposure or the Auth deletion endpoint.

## Staging gate

1. Pick a separate staging project and review its schema.
2. Apply the history migration there with the normal workflow. Don't replay the account migrations over a conflicting schema. Applying it moves no history and doesn't change the client flag.
3. Run the runner. It creates and deletes synthetic accounts, never applies migrations and refuses the shared project.

```bash
KV_HISTORY_ALLOW_STAGING_WRITES=STAGING_REFERENCE \
python3 scripts/validate-history-postgres.py --staging-project-ref STAGING_REFERENCE
```

Use a privileged direct or session-pooler connection, with credentials only in env vars or a private `.pgpass`:

| Variable                  | Value                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `PGDATABASE`              | `postgres`                                                                                                                    |
| `PGPORT`                  | `5432`, not the transaction pooler's 6543                                                                                     |
| `PGSSLMODE`               | `require` or `verify-full`                                                                                                    |
| `PGHOST`, `PGUSER`        | `db.STAGING_REFERENCE.supabase.co` and the reviewed user, or the `.pooler.supabase.com` host and `postgres.STAGING_REFERENCE` |
| `PGSERVICE`, `PGHOSTADDR` | Unset                                                                                                                         |

The role must insert and delete `auth.users`, `SET ROLE` to `authenticated` and `anon`, and read `pg_stat_activity`. An access token isn't a database password. Never reset the shared project's password for a test. If cleanup fails, remove only the generated test IDs before retrying. Record the server version and every PASS line, require zero leftover rows, and rerun the inspection. Failed sessions are named `kv-holder-*` or `kv-contender-*`.

Then test the Data API with two disposable users and the publishable key: owner read and write, empty cross-account reads, denied cross-account and unsigned writes, legacy writes refused after migration, and a full then a manifest-only download. Never use a service-role client to claim RLS passed. Delete both users through the deletion endpoint and check for leftover rows.

## Old clients

The app is `1.0.0`, nothing records a trusted client version, and the server can't force an upgrade. Don't infer a safe cohort from sign-ins, user metadata or a claimed version.

Before enabling monthly saves, ship an identifiable release above `1.0.0` with partition support, pending-edit recovery and conflict resolution. Record its build numbers and web artifact, and announce it as the minimum version. Any later version enforcement must use server-managed policy, not user-editable metadata.

After a log's first monthly save, old clients can still read its frozen v1 copy, but their writes fail with SQLSTATE `55000`, or return no rows if already stale. They must not show the frozen copy as current. Profile, water and custom-food keys aren't affected.

Test the real shipped 1.0.0 build on staging. Make a pending offline edit, migrate the log on the new build, then reconnect and restart the old build and confirm the edit survives. Upgrade in place, without clearing storage or signing out, and check the edit shows as a conflict. Try both choices: keep the device value, and keep the cloud value. `tests/history-rollout.test.ts`, part of `npm test`, simulates this with current source. It doesn't replace testing the old binary.

## Schema contract

Only `kinevault-track.exercise.v1` and `kinevault-track.food-log.v1` are partitioned. `kinevault-track.profile.v1`, weight entries included, stays one document.

The export must rebuild migrated histories from fragments and skip frozen copies. Deletion must remove the Auth user through the server endpoint, so FK cascades clear `track_documents`, `track_document_partitions`, `profiles`, `roles` and `subscriptions`. Deleting a user doesn't invalidate JWTs already issued.

## Rollout

1. Pass every staging gate, including export and deletion, and get the migration and target reviewed.
2. Apply the migration to the shared project as a coordinated deploy. Check migration history, grants, RLS and unchanged legacy counts read-only.
3. Publish the supported release built with `EXPO_PUBLIC_TRACK_PARTITIONS=true`. It's a build setting, not a server switch. Each account migrates on its next history save. Start with test accounts.
4. Watch sync failures, conflicts, `55000` errors, fragment counts, and export and delete results. Keep payloads, identities and tokens out of diagnostics. Keep frozen v1 copies until old pending edits no longer need recovery.

If the migration fails before anyone migrates, inspect the schema and never mark it applied by hand. After users migrate, never turn the flag off or drop the partition table. That shows stale v1 data and strands uploads. Recovery needs a reviewed export and reconciliation with explicit revision handling. Keep both copies until then.

## References

- [PostgreSQL 15.19/17.11 security update](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). Its ltree, btree_gist and legacy pgcrypto issues don't affect these objects. See also the [Supabase changelog](https://supabase.com/changelog).
- [Management API](https://supabase.com/docs/reference/api/introduction) and its [OpenAPI spec](https://api.supabase.com/api/v1-json)
- [Row security](https://supabase.com/docs/guides/database/postgres/row-level-security), which needs both grants and ownership policies
- [User management](https://supabase.com/docs/guides/auth/managing-user-data)
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)

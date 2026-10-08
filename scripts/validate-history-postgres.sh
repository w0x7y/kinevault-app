#!/usr/bin/env bash
# Private PostgreSQL cluster; never connects to an existing database.
set -euo pipefail
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
pg_bin=${PG_BINDIR:-}
if [[ -n "$pg_bin" ]]; then export PATH="$pg_bin:$PATH"; fi
for tool in initdb pg_ctl psql python3; do
  command -v "$tool" >/dev/null || { echo "Missing $tool; set PG_BINDIR to PostgreSQL's bin directory." >&2; exit 1; }
done
task_dir=$(mktemp -d "${TMPDIR:-/tmp}/kinevault-history-pg.XXXXXX")
cleanup() {
  pg_ctl -D "$task_dir/data" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf "$task_dir"
}
trap cleanup EXIT
initdb -D "$task_dir/data" --auth-local=trust --auth-host=reject --no-locale -E UTF8 >/dev/null
# No TCP listener, a private socket directory, no shared service configuration.
pg_ctl -D "$task_dir/data" -l "$task_dir/server.log" -o "-k $task_dir -c listen_addresses='' -c max_connections=12" -w start >/dev/null
export PGHOST="$task_dir" PGPORT=5432 PGDATABASE=postgres PGUSER="$(id -un)"
unset PGSERVICE PGSERVICEFILE PGOPTIONS PGHOSTADDR
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
SQL
for migration in 20261005150934_account_cloud_storage.sql 20261005152713_track_role_assignment_index.sql 20261008041229_bounded_history_partitions.sql; do
  psql -X -v ON_ERROR_STOP=1 -q -f "$repo_dir/supabase/migrations/$migration"
done
python3 "$repo_dir/scripts/validate-history-postgres.py" --local

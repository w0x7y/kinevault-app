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
# Stand-ins for the Supabase roles, their default table grants and the Storage tables this
# migration touches. Supabase grants object access to anon and authenticated and relies on RLS.
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
create role anon; create role authenticated; create role service_role bypassrls;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create schema storage;
create table storage.buckets(id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant all on storage.objects to service_role;
SQL
psql -X -v ON_ERROR_STOP=1 -q -f "$repo_dir/supabase/migrations/20261013120000_exercise_demo_catalog.sql"
psql -X -v ON_ERROR_STOP=1 -q -f "$repo_dir/supabase/tests/exercise-demo-catalog.sql"
echo "Demo catalog SQL checks passed."

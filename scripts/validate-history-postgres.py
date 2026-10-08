#!/usr/bin/env python3
"""Real concurrent PostgreSQL validation. Uses psql and standard Python only.

Local mode is intended for validate-history-postgres.sh's private cluster.
Staging mode never installs migrations and requires an explicit write opt-in.
Connection credentials belong in PG* environment variables, never arguments.
"""
import argparse
import json
import os
from pathlib import Path
import re
import selectors
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
SHARED_PROJECT = "kkywpvkckxniriatelta"
KEY = "kinevault-track.food-log.v1"
PSQL = ["psql", "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1"]


def run(sql, app="kv-history-validation", check=True):
    env = {**os.environ, "PGAPPNAME": app}
    result = subprocess.run(PSQL, input=sql, text=True, capture_output=True,
                            env=env, timeout=30)
    if check and result.returncode:
        # Do not echo SQL or connection strings on failures.
        raise RuntimeError(f"{app} failed: {result.stderr.strip()}")
    return result


def query(sql):
    return run(sql).stdout.strip()


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def auth(owner):
    claims = json.dumps({"sub": owner, "role": "authenticated"})
    return ("set local role authenticated; "
            f"set local request.jwt.claim.sub = '{owner}'; "
            f"set local request.jwt.claims = '{claims}'; ")


def save(owner, revision, deleted=False):
    parts = "array[]::text[]" if deleted else "array['2026-10']"
    changes = "'{}'::jsonb" if deleted else "jsonb_build_object('2026-10', '{\"version\":1,\"days\":[],\"order\":{}}')"
    return (f"select coalesce(public.save_track_partitioned_document('{owner}', "
            f"'{KEY}', {revision}, {'true' if deleted else 'false'}, {parts}, {changes})::text, 'CAS_CONFLICT');")


def legacy(owner, revision):
    return (f"select count(*) from public.save_track_document('{owner}', "
            f"'{KEY}', '{{\"version\":1,\"days\":[]}}', {revision});")


def race(owner, holder_sql, contender_sql, expected, label):
    """Keep the first transaction open until a second session is observed waiting."""
    suffix = uuid.uuid4().hex[:12]
    holder_name, contender_name = f"kv-holder-{suffix}", f"kv-contender-{suffix}"
    holder = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, text=True,
                              env={**os.environ, "PGAPPNAME": holder_name})
    contender = None
    try:
        holder.stdin.write("begin; " + auth(owner) + holder_sql + " select 'KV_READY';\n")
        holder.stdin.flush()
        selector = selectors.DefaultSelector()
        selector.register(holder.stdout, selectors.EVENT_READ)
        # Read raw bytes to avoid TextIO read-ahead hiding the READY line.
        ready = b""
        deadline = time.monotonic() + 10
        while b"KV_READY\n" not in ready and time.monotonic() < deadline:
            if selector.select(timeout=0.2):
                chunk = os.read(holder.stdout.fileno(), 4096)
                if not chunk:
                    break
                ready += chunk
        selector.close()
        require(b"KV_READY\n" in ready, f"{label}: holder never reached barrier")
        contender = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, text=True,
                                     env={**os.environ, "PGAPPNAME": contender_name})
        contender.stdin.write("begin; " + auth(owner) + contender_sql + " commit;\n")
        contender.stdin.close()
        contender.stdin = None
        blocked = False
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            blocked = query(f"select exists(select 1 from pg_catalog.pg_stat_activity c "
                            f"where c.application_name = '{contender_name}' "
                            "and c.wait_event = 'advisory' and exists (select 1 "
                            "from pg_catalog.pg_stat_activity h where h.pid = any(pg_catalog.pg_blocking_pids(c.pid)) "
                            f"and h.application_name = '{holder_name}'));") == "t"
            if blocked or contender.poll() is not None:
                break
            time.sleep(0.05)
        require(blocked, f"{label}: contender did not wait on holder's advisory lock")
        _, err = holder.communicate("commit;\n", timeout=15)
        require(holder.returncode == 0, f"{label}: holder failed: {err.strip()}")
        out, err = contender.communicate(timeout=15)
        if expected == "55000":
            require(contender.returncode != 0 and "55000" in err, f"{label}: old upload was not refused: {err.strip()}")
        else:
            require(contender.returncode == 0 and expected in out, f"{label}: wrong CAS result: {err.strip()}")
        print(f"PASS {label}: observed advisory wait; {expected}")
    finally:
        for process in (holder, contender):
            if process and process.poll() is None:
                process.kill()
                process.communicate()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--local", action="store_true")
    modes.add_argument("--staging-project-ref")
    args = parser.parse_args()
    if args.local:
        require(Path(os.environ.get("PGHOST", "")).name.startswith("kinevault-history-pg."),
                "Local mode requires the wrapper's private Unix socket")
    else:
        ref = args.staging_project_ref
        require(re.fullmatch(r"[a-z]{20}", ref) is not None and ref != SHARED_PROJECT,
                "Choose a separate staging project; shared project is refused")
        require(os.environ.get("KV_HISTORY_ALLOW_STAGING_WRITES") == ref,
                "Set KV_HISTORY_ALLOW_STAGING_WRITES to the reviewed staging reference")
        host, user = os.environ.get("PGHOST", ""), os.environ.get("PGUSER", "")
        require(host == f"db.{ref}.supabase.co" or
                (host.endswith(".pooler.supabase.com") and user == f"postgres.{ref}"),
                "PGHOST/PGUSER do not identify the requested staging project")
        require(os.environ.get("PGSSLMODE") in ("require", "verify-full"), "Staging requires TLS")
        require(not os.environ.get("PGSERVICE"), "Use explicit PG* staging connection variables")
        require(os.environ.get("PGPORT", "5432") == "5432", "Use a direct or session-pooler connection, not transaction pooling")
    require(not os.environ.get("PGHOSTADDR"), "PGHOSTADDR must not override the checked host")
    require(os.environ.get("PGDATABASE") == "postgres", "Use the postgres database")
    print("Database:", query("select version();"))
    require(query("select to_regclass('public.track_document_partitions') is not null;") == "t",
            "Reviewed migration is absent; this runner never installs it")
    # Original transactional assertions cover malformed batches, account RLS,
    # incremental reads, tombstones, direct legacy writes, and anonymous grants.
    reserved = "'10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002'"
    require(query(f"select count(*) from auth.users where id in ({reserved});") == "0",
            "Reserved transactional test IDs already exist; do not overwrite them")
    run((ROOT / "supabase/tests/history-partitions.sql").read_text())
    run((ROOT / "supabase/tests/history-partitions-security.sql").read_text())
    print("PASS transactional SQL: grants, RLS, invalid-batch rollback, legacy refusal, incremental reads")
    owners = [str(uuid.uuid4()) for _ in range(4)]
    try:
        for owner in owners:
            run(f"insert into auth.users(id, raw_user_meta_data) values ('{owner}', '{{}}');")
        # Force verbose SQLSTATE diagnostics on all subprocesses.
        os.environ["PGOPTIONS"] = "-c statement_timeout=15000 -c lock_timeout=12000"
        # psql VERBOSITY must be set in SQL input, not a server setting.
        PSQL.extend(["-v", "VERBOSITY=verbose"])
        race(owners[0], save(owners[0], 0), save(owners[0], 0), "CAS_CONFLICT", "two first partition saves")
        race(owners[0], save(owners[0], 1), save(owners[0], 1), "CAS_CONFLICT", "two updates to existing manifest")
        race(owners[1], legacy(owners[1], 0), save(owners[1], 0), "CAS_CONFLICT", "legacy creation wins migration race")
        race(owners[1], legacy(owners[1], 1), save(owners[1], 1), "CAS_CONFLICT", "legacy update wins migration race")
        race(owners[2], save(owners[2], 0), legacy(owners[2], 0), "55000", "migration wins old-client creation race")
        run("begin; " + auth(owners[3]) + legacy(owners[3], 0) + " commit;")
        frozen = query(f"select payload || '/' || revision from public.track_documents where user_id='{owners[3]}' and document_key='{KEY}';")
        race(owners[3], save(owners[3], 1), legacy(owners[3], 1), "55000", "migration wins old-client update race")
        require(query(f"select payload || '/' || revision from public.track_documents where user_id='{owners[3]}' and document_key='{KEY}';") == frozen,
                "Frozen v1 recovery copy changed")
        race(owners[0], save(owners[0], 2, True), save(owners[0], 2), "CAS_CONFLICT", "deletion wins stale resurrection race")
        require(query(f"select count(*) from public.track_document_partitions where user_id='{owners[0]}' and part_key <> 'manifest';") == "0",
                "Deleted history retained fragments")
        for owner in owners:
            # Exercise profile.v1 too: optional weight entries remain in this key.
            run("begin; " + auth(owner) +
                f"select count(*) from public.save_track_document('{owner}', 'kinevault-track.profile.v1', '{{\"version\":1}}', 0); commit;")
        for owner in owners:
            run(f"delete from auth.users where id='{owner}';")
        for table in ("track_documents", "track_document_partitions", "profiles", "roles", "subscriptions"):
            ids = ",".join(f"'{owner}'" for owner in owners)
            require(query(f"select count(*) from public.{table} where user_id in ({ids});") == "0",
                    f"auth.users deletion left rows in {table}")
        print("PASS frozen v1 copy and auth.users cascade across documents, partitions, and account metadata")
    finally:
        # Only generated IDs belong to this run. Never delete existing accounts.
        ids = ",".join(f"'{owner}'" for owner in owners)
        cleanup = run(f"delete from auth.users where id in ({ids});", check=False)
        require(cleanup.returncode == 0, "Synthetic account cleanup failed; delete only this run's generated IDs")
    print("PASS real PostgreSQL history validation; synthetic accounts removed")


if __name__ == "__main__":
    main()

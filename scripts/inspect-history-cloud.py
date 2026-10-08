#!/usr/bin/env python3
"""Read-only Supabase inventory and aggregate history diagnostics. Never prints credentials or personal rows."""
import argparse
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", default=".env.auth.local")
    parser.add_argument("--project-ref", default="kkywpvkckxniriatelta")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z]{20}", args.project_ref):
        parser.error("Project reference must contain 20 lowercase letters")
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token and Path(args.env_file).exists():
        for line in Path(args.env_file).read_text().splitlines():
            match = re.match(r"^(?:export\s+)?SUPABASE_ACCESS_TOKEN\s*=\s*(.*?)\s*$", line)
            if match:
                token = match[1].strip("\"'")
    if not token:
        parser.error("SUPABASE_ACCESS_TOKEN is required in the environment or env file")

    def call(path, query=None):
        request = urllib.request.Request(
            "https://api.supabase.com/v1/" + path,
            data=json.dumps({"query": query}).encode() if query else None,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"Management API HTTP {error.code}; response body omitted") from None

    projects = call("projects")
    print("projects", json.dumps([{key: project.get(key) for key in ("id", "name", "status", "region")}
                                  for project in projects]))
    base = f"projects/{args.project_ref}"
    print("migrations", json.dumps(call(base + "/database/migrations")))
    print("branches", json.dumps([{key: branch.get(key) for key in ("id", "name", "project_ref", "is_default", "status")}
                                  for branch in call(base + "/branches")]))

    def readonly(query):
        return call(base + "/database/query/read-only", query)

    print("server", json.dumps(readonly("select pg_catalog.version() as server_version;")))
    tables = readonly("select table_name from information_schema.tables where table_schema='public' "
                      "and table_name in ('track_documents', 'track_document_partitions') order by table_name;")
    print("tables", json.dumps(tables))
    for table in tables:
        name = table["table_name"]
        print(name + "_aggregates", json.dumps(readonly(
            f"select document_key, count(*) as rows, count(distinct user_id) as accounts, "
            f"sum(pg_catalog.octet_length(payload)) as bytes, max(revision) as maximum_revision "
            f"from public.{name} group by document_key order by document_key;")))
    print("security", json.dumps(readonly(
        "select c.relname as table_name, c.relrowsecurity as rls_enabled, "
        "pg_catalog.has_table_privilege('anon', c.oid, 'SELECT') as anon_read, "
        "pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_read "
        "from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace "
        "where n.nspname='public' and c.relname in ('track_documents','track_document_partitions');")))


if __name__ == "__main__":
    main()

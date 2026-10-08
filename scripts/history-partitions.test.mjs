import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("history SQL executes with atomic CAS, legacy guards, deletion, incremental reads, and account RLS", async () => {
  const db = new PGlite();
  try {
    // The local engine supplies only Supabase's auth/role prerequisites.
    // All tables, policies, triggers, and commands come from real migrations.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);
    for (const name of [
      "20261005150934_account_cloud_storage.sql",
      "20261005152713_track_role_assignment_index.sql",
      "20261008041229_bounded_history_partitions.sql",
    ]) {
      await db.exec(
        await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"),
      );
    }
    await db.exec(
      await readFile(new URL("../supabase/tests/history-partitions.sql", import.meta.url), "utf8"),
    );
    // The transactional test leaves neither synthetic account behind.
    assert.equal(
      (await db.query("select count(*)::int as accounts from auth.users")).rows[0].accounts,
      0,
    );
  } finally {
    await db.close();
  }
});

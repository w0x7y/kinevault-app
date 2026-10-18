import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("deletion attempts allow five an hour per account, only for the service role", async () => {
  const db = new PGlite();
  try {
    // Only Supabase's auth and role prerequisites are stubbed; the rest is the real migration.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema private;
      create table auth.users(id uuid primary key);
      insert into auth.users values
        ('00000000-0000-4000-8000-00000000000a'), ('00000000-0000-4000-8000-00000000000b');`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261018120000_account_deletion_attempts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const attempt = async (user) =>
      (await db.query("select public.record_account_deletion_attempt($1) as allowed", [user]))
        .rows[0].allowed;
    const a = "00000000-0000-4000-8000-00000000000a";
    const b = "00000000-0000-4000-8000-00000000000b";
    await db.exec("set role service_role");
    for (let i = 0; i < 5; i++) assert.equal(await attempt(a), true);
    assert.equal(await attempt(a), false);
    assert.equal(await attempt(b), true, "each account has its own limit");
    await db.exec("reset role");
    await db.query(
      "update private.account_deletion_attempts set attempted_at = now() - interval '61 minutes' where user_id = $1",
      [a],
    );
    await db.exec("set role service_role");
    assert.equal(await attempt(a), true, "attempts older than an hour stop counting");
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set role ${role}`);
      await assert.rejects(attempt(a), /permission denied/);
    }
    await db.exec("reset role");
    await db.query("delete from auth.users where id = $1", [a]);
    assert.equal(
      (await db.query("select count(*)::int as n from private.account_deletion_attempts")).rows[0]
        .n,
      1,
      "deleting the account removes its attempts",
    );
  } finally {
    await db.close();
  }
});

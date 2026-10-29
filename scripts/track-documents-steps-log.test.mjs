import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = (name) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const user = "00000000-0000-4000-8000-00000000000a";
const water = '{"version":1,"days":{"2026-10-27":1750}}';
const steps = '{"version":1,"days":{"2026-10-27":8000}}';

test("track documents accept Logged steps, still reject unknown keys and keep existing rows", async () => {
  const db = new PGlite();
  try {
    // Only Supabase's auth and role prerequisites are stubbed; the rest is the real migrations.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);
    await db.exec(await migration("20261005150934_account_cloud_storage.sql"));
    await db.query("insert into auth.users(id) values ($1)", [user]);
    await db.query(
      "insert into public.track_documents (user_id, document_key, payload, revision) values ($1, 'kinevault-track.water-log.v1', $2, 3)",
      [user, water],
    );
    await assert.rejects(
      db.query(
        "insert into public.track_documents (user_id, document_key, payload) values ($1, 'kinevault-track.steps-log.v1', $2)",
        [user, steps],
      ),
      /track_documents_allowed_key/,
    );
    await db.exec(await migration("20261029120000_track_documents_steps_log.sql"));
    assert.deepEqual(
      (await db.query("select document_key, payload, revision from public.track_documents")).rows,
      [{ document_key: "kinevault-track.water-log.v1", payload: water, revision: 3 }],
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    const save = (key, payload) =>
      db.query("select revision from public.save_track_document($1, $2, $3, 0)", [
        user,
        key,
        payload,
      ]);
    assert.deepEqual((await save("kinevault-track.steps-log.v1", steps)).rows, [{ revision: 1 }]);
    await assert.rejects(save("kinevault-track.unknown.v1", "{}"), /track_documents_allowed_key/);
    await db.exec("reset role");
    await db.query("delete from auth.users where id = $1", [user]);
    assert.equal(
      (await db.query("select count(*)::int as n from public.track_documents")).rows[0].n,
      0,
      "deleting the account removes its Logged steps",
    );
  } finally {
    await db.close();
  }
});

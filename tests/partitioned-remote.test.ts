import assert from "node:assert/strict";
import test from "node:test";
import { createAccountStorage, type CloudDocument } from "../src/account/storage.ts";
import {
  createPartitionedRemote,
  type PartitionRow,
  type PartitionSave,
} from "../src/account/partitioned-remote.ts";

const key = "kinevault-track.exercise.v1";
const session = (id: string, date: string) => ({
  id,
  date,
  name: id,
  status: "planned",
  startedAt: null,
  durationSeconds: null,
  exercises: [],
});
const payload = (sessions: unknown[]) =>
  JSON.stringify({ version: 1, exercises: [], workouts: [], sessions });
function server(initial?: CloudDocument) {
  const originals = new Map(initial ? [[initial.document_key, initial]] : []),
    rows = new Map<string, PartitionRow>(),
    saves: PartitionSave[] = [],
    downloads: PartitionRow[][] = [];
  let offline = false;
  let legacyReadGate: { wait: Promise<void>; entered: () => void } | null = null;
  function remote() {
    return createPartitionedRemote(
      {
        async list(excluded = []) {
          if (offline) throw new Error("Offline");
          const delay = legacyReadGate;
          legacyReadGate = null;
          if (delay) {
            delay.entered();
            await delay.wait;
          }
          return [...originals.values()].filter((row) => !excluded.includes(row.document_key));
        },
        async save(document_key, value, revision) {
          if (offline) throw new Error("Offline");
          const document = { document_key, payload: value, revision: revision + 1 };
          originals.set(document_key, document);
          return document;
        },
      },
      {
        async list(known) {
          if (offline) throw new Error("Offline");
          const result = [...rows.values()].filter(
            (row) => row.part_key === "manifest" || row.revision > (known[row.document_key] ?? 0),
          );
          downloads.push(result);
          return result;
        },
        async save(input) {
          if (offline) throw new Error("Offline");
          const revision =
            rows.get(`${input.key}/manifest`)?.revision ?? originals.get(input.key)?.revision ?? 0;
          if (revision !== input.expectedRevision) return null;
          saves.push(input);
          const saved = { revision: revision + 1, updated_at: "2026-10-08T12:00:00Z" };
          const next = new Map(rows);
          for (const [part_key, value] of Object.entries(input.changes))
            next.set(`${input.key}/${part_key}`, {
              document_key: input.key,
              part_key,
              payload: value,
              ...saved,
            });
          for (const [id, row] of next)
            if (
              row.document_key === input.key &&
              row.part_key !== "manifest" &&
              !input.parts.includes(row.part_key)
            )
              next.delete(id);
          next.set(`${input.key}/manifest`, {
            document_key: input.key,
            part_key: "manifest",
            payload: JSON.stringify({ version: 2, deleted: input.deleted, parts: input.parts }),
            ...saved,
          });
          rows.clear();
          for (const [id, row] of next) rows.set(id, row);
          return saved;
        },
      },
    );
  }
  return {
    remote,
    rows,
    saves,
    downloads,
    originals,
    deferLegacyRead() {
      let release!: () => void, entered!: () => void;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      legacyReadGate = { wait, entered };
      return { release, started };
    },
    setOffline: (value: boolean) => {
      offline = value;
    },
  };
}
function memory() {
  const rows = new Map<string, string>();
  return {
    async getItem(key: string) {
      return rows.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      rows.set(key, value);
    },
    async removeItem(key: string) {
      rows.delete(key);
    },
  };
}

test("migration uses the legacy revision and subsequent edits upload and download only the changed month", async () => {
  const original = payload([session("old", "2026-01-01"), session("new", "2026-10-01")]),
    cloud = server({ document_key: key, payload: original, revision: 7 });
  const a = cloud.remote(),
    b = cloud.remote();
  assert.equal((await a.list())[0]?.payload, original);
  assert.equal((await a.save(key, original, 7))?.revision, 8);
  assert.equal(cloud.saves[0]?.parts.length, 3);
  assert.equal((await b.list())[0]?.payload, original);
  const edited = JSON.parse(original);
  edited.sessions[1].name = "Edited October";
  await a.save(key, JSON.stringify(edited), 8);
  assert.deepEqual(Object.keys(cloud.saves[1]!.changes), ["2026-10"]);
  assert.equal((await b.list())[0]?.payload, JSON.stringify(edited));
  assert.deepEqual(
    cloud.downloads
      .at(-1)
      ?.map((row) => row.part_key)
      .sort(),
    ["2026-10", "manifest"],
  );
  await b.list();
  assert.deepEqual(
    cloud.downloads.at(-1)?.map((row) => row.part_key),
    ["manifest"],
  );
  assert.equal(cloud.originals.get(key)?.payload, original);
});

test("cross-device edits remain explicit conflicts and choosing local commits against the new aggregate revision", async () => {
  const original = payload([session("one", "2026-01-01")]),
    cloud = server({ document_key: key, payload: original, revision: 1 });
  const a = createAccountStorage({ userId: "a", local: memory(), remote: cloud.remote() });
  const b = createAccountStorage({ userId: "a", local: memory(), remote: cloud.remote() });
  await a.start();
  await b.start();
  cloud.setOffline(true);
  const local = payload([session("one", "2026-01-01"), session("local", "2026-10-01")]);
  await a.setItem(key, local);
  await a.retry();
  cloud.setOffline(false);
  const theirs = payload([session("one", "2026-01-01"), session("theirs", "2026-09-01")]);
  await b.setItem(key, theirs);
  await b.retry();
  await a.retry();
  assert.deepEqual(a.getSnapshot().conflicts, [key]);
  assert.equal(await a.getItem(key), local);
  await a.resolveConflict(key, "local");
  assert.deepEqual(a.getSnapshot().conflicts, []);
  assert.equal((await cloud.remote().list())[0]?.payload, local);
  a.stop();
  b.stop();
});

test("a pending legacy edit after another client migrates is preserved through restart and cloud resolution", async () => {
  const original = payload([session("one", "2026-01-01")]),
    cloud = server({ document_key: key, payload: original, revision: 3 });
  const local = memory(),
    edited = payload([session("pending", "2026-09-01")]);
  await local.setItem(
    `kinevault-track.account.a.${key}`,
    JSON.stringify({ version: 1, payload: edited, revision: 3, dirty: true, sequence: 2 }),
  );
  const other = cloud.remote();
  await other.list();
  await other.save(key, original, 3);
  const store = createAccountStorage({ userId: "a", local, remote: cloud.remote() });
  await store.start();
  assert.equal(await store.getItem(key), edited);
  assert.deepEqual(store.getSnapshot().conflicts, [key]);
  store.stop();
  const restarted = createAccountStorage({ userId: "a", local, remote: cloud.remote() });
  await restarted.start();
  assert.equal(await restarted.getItem(key), edited);
  assert.deepEqual(restarted.getSnapshot().conflicts, [key]);
  await restarted.resolveConflict(key, "cloud");
  assert.equal(await restarted.getItem(key), original);
  restarted.stop();
});

test("cross-month moves and deletion reconstruct together, and stale saves cannot resurrect deleted history", async () => {
  const cloud = server(),
    a = cloud.remote(),
    b = cloud.remote();
  const original = payload([session("one", "2026-09-01")]);
  await a.list();
  await a.save(key, original, 0);
  await b.list();
  const moved = payload([session("one", "2026-10-01")]);
  await a.save(key, moved, 1);
  assert.equal((await b.list())[0]?.payload, moved);
  assert.equal(cloud.rows.has(`${key}/2026-09`), false);
  await a.save(key, null, 2);
  assert.equal((await b.list())[0]?.payload, null);
  assert.equal(await b.save(key, original, 2), null);
  assert.equal((await a.list())[0]?.payload, null);
});

test("incomplete cloud fragments cannot publish a partially reconstructed document", async () => {
  const cloud = server(),
    remote = cloud.remote();
  await remote.list();
  await remote.save(key, payload([session("one", "2026-09-01")]), 0);
  cloud.rows.delete(`${key}/2026-09`);
  await assert.rejects(cloud.remote().list(), /Missing cloud history partition/);
});

test("a delayed old download cannot replace newer cache revisions or redownload unchanged history", async () => {
  const cloud = server(),
    remote = cloud.remote();
  await remote.list();
  await remote.save(key, payload([session("one", "2026-09-01")]), 0);
  const gate = cloud.deferLegacyRead(),
    abandoned = remote.list();
  await gate.started;
  await remote.save(key, payload([session("one", "2026-10-01")]), 1);
  await remote.list();
  gate.release();
  await assert.rejects(abandoned, /Cloud history revision moved backward/);
  await remote.list();
  assert.deepEqual(
    cloud.downloads.at(-1)?.map((row) => row.part_key),
    ["manifest"],
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { createAccountStorage, type AccountRemote } from "../src/account/storage.ts";
import { createPartitionedLocalStorage } from "../src/account/history-partitions.ts";

const key = "kinevault-track.exercise.v1";
const scopedKey = `kinevault-track.account.owner.${key}`;
function history(name: string) {
  return JSON.stringify({
    version: 1,
    exercises: [],
    workouts: [],
    sessions: [
      {
        id: "session",
        date: "2026-10-08",
        name,
        status: "planned",
        startedAt: null,
        durationSeconds: null,
        exercises: [],
      },
    ],
  });
}

for (const choice of ["local", "cloud"] as const) {
  test(`legacy upload refusal preserves the dirty envelope across restart and upgrade, then resolves to ${choice}`, async () => {
    const frozen = history("Frozen backup"),
      pending = history("Pending device edit"),
      current = history("Current cloud edit");
    const values = new Map<string, string>([
      [
        scopedKey,
        JSON.stringify({ version: 1, payload: pending, revision: 3, dirty: true, sequence: 7 }),
      ],
    ]);
    const local = {
      async getItem(id: string) {
        return values.get(id) ?? null;
      },
      async setItem(id: string, value: string) {
        values.set(id, value);
      },
      async removeItem(id: string) {
        values.delete(id);
      },
    };
    const logical = createPartitionedLocalStorage(local);
    const refused: AccountRemote = {
      async list() {
        return [{ document_key: key, payload: frozen, revision: 3 }];
      },
      async save() {
        throw Object.assign(new Error("Upgrade the app to sync pending edits"), { code: "55000" });
      },
    };
    for (let restart = 0; restart < 2; restart++) {
      const old = createAccountStorage({ userId: "owner", local, remote: refused });
      await old.start();
      assert.equal(old.getSnapshot().state, "error");
      assert.equal(await old.getItem(key), pending);
      const retained = JSON.parse((await logical.getItem(scopedKey))!);
      assert.deepEqual(retained, {
        version: 1,
        payload: pending,
        revision: 3,
        dirty: true,
        sequence: 7,
      });
      old.stop();
    }
    let cloud = { document_key: key, payload: current, revision: 4 };
    const supported: AccountRemote = {
      async list() {
        return [cloud];
      },
      async save(id, value, revision) {
        assert.equal(id, key);
        assert.equal(revision, 4);
        assert.equal(value, pending);
        cloud = { document_key: id, payload: value!, revision: 5 };
        return cloud;
      },
    };
    const upgraded = createAccountStorage({ userId: "owner", local, remote: supported });
    await upgraded.start();
    assert.deepEqual(upgraded.getSnapshot().conflicts, [key]);
    assert.equal(await upgraded.getItem(key), pending);
    await upgraded.resolveConflict(key, choice);
    assert.deepEqual(upgraded.getSnapshot().conflicts, []);
    assert.equal(await upgraded.getItem(key), choice === "local" ? pending : current);
    assert.equal(JSON.parse((await logical.getItem(scopedKey))!).dirty, false);
    upgraded.stop();
  });
}

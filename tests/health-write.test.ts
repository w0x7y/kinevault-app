import assert from "node:assert/strict";
import test from "node:test";
import type { WorkoutSession } from "../src/exercise/model.ts";
import type { FoodEntry } from "../src/daily/model.ts";
import type { DeviceHealth, HealthAccess } from "../src/health/device-health.ts";
import {
  healthRecords,
  healthStatus,
  healthWrites,
  parseHealthLedger,
  serializeHealthLedger,
  type HealthSources,
  type HealthWrite,
} from "../src/health/plan.ts";
import { createHealthWriter, healthLedgerKey } from "../src/health/writer.ts";

// Local times, so the expectations hold in any time zone.
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).getTime();
const now = at(5, 9);

function session(patch: Partial<WorkoutSession> & { tracking?: "single" | "cardio" }) {
  const { tracking = "single", ...rest } = patch;
  return {
    id: "leg-day",
    date: "2026-11-04",
    name: "Leg day",
    status: "completed",
    startedAt: null,
    durationSeconds: 3600,
    exercises: [
      {
        id: "row",
        exercise: {
          id: "squat",
          name: "Squat",
          muscleGroup: "",
          equipment: "",
          notes: "",
          tracking,
        },
        sets: [],
      },
    ],
    ...rest,
  } as WorkoutSession;
}
const drink = (ml: number, meal: FoodEntry["meal"] = "drinks") =>
  ({
    id: `drink-${ml}`,
    name: "Tea",
    meal,
    calories: 0,
    carbs: 0,
    protein: 0,
    fat: 0,
    grams: ml,
    drinkMl: ml,
  }) as FoodEntry;
const empty: HealthSources = { sessions: [], weights: [], food: {}, water: {} };

test("completed workouts with a Recorded duration become sessions from their timer, or noon for a manual log", () => {
  const records = healthRecords(
    {
      ...empty,
      sessions: [
        session({ id: "timed", startedAt: at(4, 18), durationSeconds: 2700 }),
        session({ id: "manual" }),
        session({ id: "cardio", name: "Run", tracking: "cardio" }),
        // Logged this morning: it ends now instead of after noon.
        session({ id: "this-morning", date: "2026-11-05" }),
        session({ id: "no-duration", durationSeconds: null }),
        session({ id: "zero", durationSeconds: 0 }),
        session({ id: "planned", status: "planned", durationSeconds: null }),
        session({ id: "future", date: "2026-11-06" }),
      ],
    },
    now,
  );
  assert.deepEqual(
    records.map((record) =>
      record.kind === "workout"
        ? [record.id, record.title, record.start, record.end, record.strength]
        : null,
    ),
    [
      ["workout:timed", "Leg day", at(4, 18), at(4, 18, 45), true],
      ["workout:manual", "Leg day", at(4, 12), at(4, 13), true],
      ["workout:cardio", "Run", at(4, 12), at(4, 13), false],
      ["workout:this-morning", "Leg day", at(5, 8), now, true],
    ],
  );
});

test("weights land at noon or now, and water totals Manual water plus Drinks per day", () => {
  const records = healthRecords(
    {
      ...empty,
      weights: [
        { date: "2026-11-04", kg: 80.5 },
        { date: "2026-11-05", kg: 80 },
        { date: "2026-11-06", kg: 79 },
      ],
      water: { "2026-11-03": 500, "2026-11-04": 0, "2026-11-05": 250, "2026-11-06": 300 },
      food: { "2026-11-04": [drink(330), drink(200, "lunch")], "2026-11-05": [drink(100)] },
    },
    now,
  );
  assert.deepEqual(
    records.map((record) => ({ ...record, source: undefined })),
    [
      { kind: "weight", id: "weight:2026-11-04", source: undefined, time: at(4, 12), kg: 80.5 },
      { kind: "weight", id: "weight:2026-11-05", source: undefined, time: now, kg: 80 },
      {
        kind: "water",
        id: "water:2026-11-03",
        source: undefined,
        start: at(3, 0),
        end: at(4, 0),
        ml: 500,
      },
      {
        kind: "water",
        id: "water:2026-11-04",
        source: undefined,
        start: at(4, 0),
        end: at(5, 0),
        ml: 330,
      },
      {
        kind: "water",
        id: "water:2026-11-05",
        source: undefined,
        start: at(5, 0),
        end: now,
        ml: 350,
      },
    ],
  );
});

test("writes save new and changed records with growing versions and remove deleted ones", () => {
  const sources: HealthSources = { ...empty, weights: [{ date: "2026-11-04", kg: 80 }] };
  const first = healthWrites(healthRecords(sources, now), {}, now);
  assert.deepEqual(
    first.save.map(({ id, version }) => [id, version]),
    [["weight:2026-11-04", now]],
  );
  assert.deepEqual(first.remove, []);
  const ledger = { "weight:2026-11-04": { version: now, source: first.save[0]!.source } };
  // Saving the same values again writes nothing.
  assert.deepEqual(healthWrites(healthRecords(sources, now + 1), ledger, now + 1), {
    save: [],
    remove: [],
  });
  // An edit replaces the record with a higher version, even if the clock went back.
  const edited = healthWrites(
    healthRecords({ ...empty, weights: [{ date: "2026-11-04", kg: 79.5 }] }, now - 5),
    ledger,
    now - 5,
  );
  assert.deepEqual(
    edited.save.map(({ id, version }) => [id, version]),
    [["weight:2026-11-04", now + 1]],
  );
  // A deleted entry, or one moved to a future date, is removed.
  assert.deepEqual(healthWrites(healthRecords(empty, now), ledger, now).remove, [
    "weight:2026-11-04",
  ]);
});

test("the ledger round-trips and rejects damaged entries", () => {
  const ledger = { "water:2026-11-04": { version: now, source: "330" } };
  assert.deepEqual(parseHealthLedger(serializeHealthLedger(ledger)), ledger);
  assert.deepEqual(parseHealthLedger(null), {});
  assert.throws(() => parseHealthLedger(JSON.stringify({ version: 2, records: {} })));
  assert.throws(() =>
    parseHealthLedger(
      JSON.stringify({ version: 1, records: { "other:1": { version: 1, source: "" } } }),
    ),
  );
  assert.throws(() =>
    parseHealthLedger(
      JSON.stringify({ version: 1, records: { "water:1": { version: 1.5, source: "" } } }),
    ),
  );
});

test("Settings words each access state like Phone steps and offers its fix", () => {
  const status = (access: HealthAccess | null, failed = false, enabled: boolean | null = true) =>
    healthStatus({ name: "Health Connect", enabled, access, failed });
  assert.equal(status("granted", false, false), null);
  assert.equal(status(null), null);
  assert.equal(status("granted"), null);
  assert.deepEqual(status("granted", true), {
    status: "Couldn't save to Health Connect.",
    action: { label: "Try again", kind: "retry" },
  });
  assert.deepEqual(status("undetermined"), {
    status: "Not connected",
    action: { label: "Allow access", kind: "connect" },
  });
  assert.deepEqual(status("denied"), {
    status: "Access to Health Connect is off.",
    action: { label: "Open settings", kind: "openSettings" },
  });
  assert.deepEqual(status("install"), {
    status: "Install Health Connect to save your workouts, weight and water.",
    action: { label: "Get Health Connect", kind: "openSettings" },
  });
  assert.deepEqual(status("unavailable"), {
    status: "Health Connect isn't available on this device.",
    action: null,
  });
});

const flush = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve();
};

function fixture({ enabled = false, access = "undetermined" as HealthAccess } = {}) {
  let saved = enabled;
  let raw: string | null = null;
  const calls: string[] = [];
  const failures = {
    save: false,
    setting: false,
    read: false,
    gate: null as Promise<void> | null,
  };
  const device: DeviceHealth = {
    name: "Health Connect",
    access: async () => access,
    request: async () => {
      calls.push("request");
      return (access = "granted");
    },
    save: async (writes: readonly HealthWrite[]) => {
      if (failures.gate) await failures.gate;
      if (failures.save) throw new Error("Fixture save failure");
      calls.push(`save ${writes.map(({ id, version }) => `${id}@${version}`).join(" ")}`);
    },
    remove: async (kind, ids) => {
      calls.push(`remove ${kind} ${ids.join(" ")}`);
    },
    openSettings: async () => {},
  };
  let clock = now;
  const writer = createHealthWriter({
    device,
    now: () => clock,
    storage: {
      async getItem(key) {
        assert.equal(key, healthLedgerKey);
        if (failures.read) throw new Error("Fixture read failure");
        return raw;
      },
      async setItem(key, value) {
        assert.equal(key, healthLedgerKey);
        raw = value;
      },
    },
    setting: {
      load: async () => saved,
      async save(value) {
        if (failures.setting) throw new Error("Fixture setting failure");
        saved = value;
      },
    },
  });
  writer.start();
  return {
    writer,
    calls,
    failures,
    setting: () => saved,
    ledger: () => parseHealthLedger(raw),
    tick: (ms: number) => (clock += ms),
  };
}
const weights = (kg: number): HealthSources => ({
  ...empty,
  weights: [{ date: "2026-11-04", kg }],
});

test("turning it on asks once, then saves, updates and removes records as the documents change", async () => {
  const { writer, calls, setting, ledger, tick } = fixture();
  writer.setSources(weights(80));
  await flush();
  assert.deepEqual(calls, [], "nothing is written while the setting is off");
  await writer.setEnabled(true);
  await flush();
  assert.equal(setting(), true);
  assert.deepEqual(calls, ["request", `save weight:2026-11-04@${now}`]);
  assert.deepEqual(ledger(), { "weight:2026-11-04": { version: now, source: "80" } });
  tick(1000);
  writer.setSources(weights(79.5));
  await flush();
  assert.equal(calls.at(-1), `save weight:2026-11-04@${now + 1000}`);
  writer.setSources(empty);
  await flush();
  assert.equal(calls.at(-1), "remove weight weight:2026-11-04");
  assert.deepEqual(ledger(), {});
  assert.equal(writer.getSnapshot().failed, false);
});

test("an unloaded document writes nothing, and turning it off stops writing", async () => {
  const { writer, calls } = fixture({ enabled: true, access: "granted" });
  writer.setSources(null);
  await flush();
  assert.deepEqual(calls, []);
  await writer.setEnabled(false);
  writer.setSources(weights(80));
  await flush();
  assert.deepEqual(calls, []);
});

test("a failed write is quiet, keeps the ledger, and the retry saves it", async () => {
  const { writer, calls, failures, ledger } = fixture({ enabled: true, access: "granted" });
  failures.save = true;
  writer.setSources(weights(80));
  await flush();
  assert.equal(writer.getSnapshot().failed, true);
  assert.deepEqual(ledger(), {});
  failures.save = false;
  await writer.refresh();
  await flush();
  assert.deepEqual(calls, [`save weight:2026-11-04@${now}`]);
  assert.equal(writer.getSnapshot().failed, false);
});

test("an unreadable ledger waits instead of starting over, and a failed setting save stays put", async () => {
  const { writer, calls, failures } = fixture({ enabled: true, access: "granted" });
  failures.read = true;
  writer.setSources(weights(80));
  await flush();
  assert.deepEqual(calls, []);
  assert.equal(writer.getSnapshot().failed, true);
  failures.setting = true;
  await writer.setEnabled(false);
  assert.equal(writer.getSnapshot().enabled, true);
  assert.equal(writer.getSnapshot().error, "Couldn't save this setting. Try again.");
});

test("denied access writes nothing until it is granted", async () => {
  const { writer, calls } = fixture({ enabled: true, access: "denied" });
  writer.setSources(weights(80));
  await flush();
  assert.equal(writer.getSnapshot().access, "denied");
  assert.deepEqual(calls, []);
  await writer.connect();
  await flush();
  assert.deepEqual(calls, ["request", `save weight:2026-11-04@${now}`]);
});

test("a change during a sync waits for it, then saves the latest values", async () => {
  const { writer, calls, failures, ledger } = fixture({ enabled: true, access: "granted" });
  let release = () => {};
  failures.gate = new Promise((resolve) => (release = resolve));
  writer.setSources(weights(80));
  await flush();
  writer.setSources(weights(79.5));
  await flush();
  assert.deepEqual(calls, []);
  failures.gate = null;
  release();
  await flush();
  assert.deepEqual(calls, [`save weight:2026-11-04@${now}`, `save weight:2026-11-04@${now + 1}`]);
  assert.deepEqual(ledger(), { "weight:2026-11-04": { version: now + 1, source: "79.5" } });
});

import assert from "node:assert/strict";
import test from "node:test";
import { savedText } from "../src/units/units.ts";
import { emptyAnswers } from "../src/profile/answers.ts";
import { calorieState } from "../src/profile/calories.ts";
import {
  cmFromInput,
  measurementSeries,
  parseMeasurementEntries,
  saveMeasurementEntry,
  validateMeasurementEntry,
} from "../src/profile/measurement-model.ts";
import { parseProfile, type ProfileDocument } from "../src/profile/model.ts";
import {
  createProfilePersistence,
  profileStorageKey,
  type ProfileStorage,
} from "../src/profile/persistence.ts";
import { createMeasurementEdit } from "../src/profile/weight-editing.ts";

const complete: ProfileDocument = {
  version: 1,
  kind: "complete",
  answers: {
    ...emptyAnswers,
    name: "Measured",
    age: "30",
    height: "180",
    weight: "80",
    goal: "lose",
    activity: "moderate",
    sex: "female",
    eligible: true,
    estimateEnabled: true,
    customProtein: "125",
  },
};
const first = { date: "2026-10-01", cm: { waist: 82.5, hips: 98 } };
const second = { date: "2026-10-03", cm: { arm: 34 } };
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
async function ready(
  document: ProfileDocument = { ...complete, bodyMeasurements: [first, second] },
) {
  let raw = JSON.stringify(document);
  let failWrites = false;
  const writes: string[] = [];
  const storage: ProfileStorage = {
    async getItem(key) {
      assert.equal(key, profileStorageKey);
      return raw;
    },
    async setItem(key, value) {
      writes.push(value);
      if (failWrites) throw new Error("disk failure");
      raw = value;
    },
    async removeItem() {
      raw = "";
    },
  };
  const profile = createProfilePersistence(storage);
  profile.start();
  await flush();
  const edit = createMeasurementEdit(profile);
  edit.start();
  return {
    profile,
    edit,
    writes,
    durable: () => JSON.parse(raw) as ProfileDocument,
    failWrites: (value: boolean) => {
      failWrites = value;
    },
  };
}
function editor(edit: ReturnType<typeof createMeasurementEdit>) {
  const attempt = edit.getSnapshot().attempt;
  if (attempt?.kind !== "edit") throw new Error("Expected measurement editor");
  return attempt;
}

test("measurements are 10 to 300 cm with one decimal, and an entry needs at least one", () => {
  assert.equal(cmFromInput(" 82,5 "), 82.5);
  assert.equal(cmFromInput("300"), 300);
  for (const value of ["", "9.9", "300.1", "82.55", "1e2", "82cm", "-50", "Infinity"])
    assert.throws(() => cmFromInput(value), /cm/);
  // Inches typed in Imperial save as centimeters; the messages name inches.
  assert.equal(cmFromInput(savedText("length", "32.2", "imperial"), "imperial"), 81.8);
  assert.throws(
    () => cmFromInput(savedText("length", "32.25", "imperial"), "imperial"),
    /^Error: Enter in with up to one decimal place\.$/,
  );
  assert.throws(
    () => cmFromInput(savedText("length", "3", "imperial"), "imperial"),
    /^Error: Enter a measurement between 4 and 118\.1 in\.$/,
  );
  assert.deepEqual(validateMeasurementEntry("2026-10-08", { thigh: 10 }), {
    date: "2026-10-08",
    cm: { thigh: 10 },
  });
  assert.throws(() => validateMeasurementEntry("2026-10-08", {}), /at least one/);
  for (const cm of [{ waist: "82" }, { waist: null }, { arm: 82.55 }, null, [], 82])
    assert.throws(() => validateMeasurementEntry("2026-10-08", cm));
  assert.throws(() => validateMeasurementEntry("2026-02-29", { waist: 80 }), /date/);
});

test("history sorts by date, rejects duplicate dates and replaces or moves by date", () => {
  assert.deepEqual(
    parseMeasurementEntries([second, first]).map((entry) => entry.date),
    [first.date, second.date],
  );
  assert.throws(() => parseMeasurementEntries([first, { ...first, cm: { arm: 30 } }]), /Duplicate/);
  assert.throws(() => parseMeasurementEntries([{ date: first.date }]));
  assert.deepEqual(
    saveMeasurementEntry([first, second], { date: second.date, cm: { waist: 80 } }),
    [first, { date: second.date, cm: { waist: 80 } }],
  );
  assert.deepEqual(
    saveMeasurementEntry([first, second], {
      previousDate: first.date,
      date: "2026-10-05",
      cm: { waist: 81 },
    }),
    [second, { date: "2026-10-05", cm: { waist: 81 } }],
  );
  assert.deepEqual(measurementSeries([first, second], "waist"), [
    { date: first.date, value: 82.5 },
  ]);
  assert.deepEqual(measurementSeries([first, second], "chest"), []);
});

test("Profile keeps measurements beside weight; answer saves keep them and targets never change", async () => {
  const { profile, durable } = await ready({
    ...complete,
    weightEntries: [{ date: "2026-10-01", kg: 80 }],
  });
  const calories = calorieState(complete.answers);
  assert.equal(await profile.saveMeasurement({ date: "2026-10-08", cm: { waist: 80 } }), true);
  assert.deepEqual(durable().bodyMeasurements, [{ date: "2026-10-08", cm: { waist: 80 } }]);
  assert.deepEqual(durable().weightEntries, [{ date: "2026-10-01", kg: 80 }]);
  assert.deepEqual(durable().answers, complete.answers);
  assert.deepEqual(calorieState(durable().answers), calories);
  // An answer editor's document predates the measurement and must not drop it.
  assert.equal(
    await profile.save({ ...complete, answers: { ...complete.answers, name: "Renamed" } }),
    true,
  );
  assert.deepEqual(durable().bodyMeasurements, [{ date: "2026-10-08", cm: { waist: 80 } }]);
  assert.equal(await profile.saveWeight({ date: "2026-10-08", kg: 79 }), true);
  assert.deepEqual(durable().bodyMeasurements, [{ date: "2026-10-08", cm: { waist: 80 } }]);
  assert.equal(await profile.removeMeasurement("2026-10-08"), true);
  assert.deepEqual(durable().bodyMeasurements, []);
  assert.equal(durable().weightEntries?.length, 2);
});

test("a corrupt measurement opens Profile recovery instead of dropping history", async () => {
  const raw = JSON.stringify({ ...complete, bodyMeasurements: [{ date: "2026-10-01", cm: {} }] });
  assert.throws(() => parseProfile(raw), /at least one/);
  const { profile, writes } = await ready({
    ...complete,
    bodyMeasurements: [{ date: "2026-10-01", cm: { waist: 5 } }],
  });
  assert.equal(profile.getSnapshot().state.kind, "error");
  assert.equal(await profile.saveMeasurement({ date: "2026-10-08", cm: { waist: 80 } }), false);
  assert.equal(writes.length, 0);
});

test("the editor prefills an entry, saves only filled values and keeps fields after failures", async () => {
  const { edit, durable, writes, failWrites } = await ready();
  edit.begin("2026-10-08", first);
  assert.deepEqual(editor(edit).draft, {
    date: first.date,
    previousDate: first.date,
    waist: "82.5",
    chest: "",
    hips: "98",
    arm: "",
    thigh: "",
  });
  edit.change("hips", "");
  edit.change("thigh", "5");
  assert.equal(await edit.save(), false);
  assert.match(editor(edit).fields.thigh!, /between 10 and 300/);
  assert.equal(writes.length, 0);
  edit.change("thigh", "57,5");
  edit.change("date", second.date);
  assert.equal(edit.getSnapshot().replacing, true);
  failWrites(true);
  assert.equal(await edit.save(), false);
  assert.match(editor(edit).error!, /Couldn't save your measurements/);
  assert.equal(editor(edit).draft.thigh, "57,5");
  failWrites(false);
  assert.equal(await edit.save(), true);
  assert.equal(edit.getSnapshot().attempt, null);
  assert.deepEqual(durable().bodyMeasurements, [
    { date: second.date, cm: { waist: 82.5, thigh: 57.5 } },
  ]);

  edit.begin("2026-10-09");
  assert.equal(await edit.save(), false);
  assert.equal(editor(edit).error, "Enter at least one measurement.");
  assert.equal(editor(edit).draft.date, "2026-10-09");
  edit.cancel();
  edit.beginDelete(durable().bodyMeasurements![0]!);
  assert.equal(await edit.remove(), true);
  assert.deepEqual(durable().bodyMeasurements, []);
});

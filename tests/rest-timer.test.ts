import assert from "node:assert/strict";
import test from "node:test";
import {
  createRestTimer,
  parseRestLength,
  type RestLengthStorage,
} from "../src/exercise/rest-timer.ts";
import { fakeTime } from "./helpers/fake-time.ts";

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
/** A Rest timer on fake time; `tick` runs its ticker once, and `ends` counts `onEnd` calls. */
function fixture(storage?: RestLengthStorage) {
  const time = fakeTime();
  const ends = { count: 0 };
  const rest = createRestTimer({ ticker: time.ticker(), onEnd: () => ends.count++, storage });
  return { ...time, rest, ends };
}

test("a rest counts down its length and ends once with onEnd", () => {
  const f = fixture();
  assert.deepEqual(f.rest.getSnapshot(), { length: 90, left: null });
  assert.equal(f.ticking(), false, "no ticker without a rest");
  f.rest.toggle();
  assert.deepEqual(f.rest.getSnapshot(), { length: 90, left: 90 });
  let published = 0;
  f.rest.subscribe(() => published++);
  f.time.now += 200;
  f.tick();
  assert.equal(published, 0, "the same second publishes nothing");
  f.time.now += 30_000;
  f.tick();
  assert.deepEqual(f.rest.getSnapshot(), { length: 90, left: 60 });
  assert.equal(published, 1);
  f.time.now += 60_000;
  f.tick();
  assert.deepEqual(f.rest.getSnapshot(), { length: 90, left: null });
  assert.equal(f.ends.count, 1);
  assert.equal(f.ticking(), false);
  f.tick();
  assert.equal(f.ends.count, 1);
});

test("toggling and stopping end a rest early without onEnd", () => {
  const f = fixture();
  f.rest.toggle();
  f.rest.toggle();
  assert.equal(f.rest.getSnapshot().left, null);
  f.rest.toggle();
  f.rest.stop();
  assert.equal(f.rest.getSnapshot().left, null);
  assert.equal(f.ticking(), false);
  f.rest.stop();
  assert.equal(f.ends.count, 0);
});

test("adjusting changes the length within 15 s to 10 min and moves a running rest with it", () => {
  const f = fixture();
  f.rest.toggle();
  f.time.now += 10_000;
  f.rest.adjust(15);
  assert.deepEqual(f.rest.getSnapshot(), { length: 105, left: 95 });
  for (let i = 0; i < 50; i++) f.rest.adjust(15);
  assert.equal(f.rest.getSnapshot().length, 600);
  f.rest.stop();
  for (let i = 0; i < 50; i++) f.rest.adjust(-15);
  assert.equal(f.rest.getSnapshot().length, 15);
  // Shortening past the time already rested ends the rest quietly.
  f.rest.adjust(15);
  f.rest.toggle();
  f.time.now += 20_000;
  f.rest.adjust(-15);
  assert.deepEqual(f.rest.getSnapshot(), { length: 15, left: null });
  assert.equal(f.ends.count, 0);
  assert.equal(f.ticking(), false);
});

test("a rest keeps its end time between ticks, however late the next one comes", () => {
  const f = fixture();
  f.rest.toggle();
  f.time.now += 45_000;
  f.tick();
  assert.equal(f.rest.getSnapshot().left, 45);
});

test("the length loads from storage unless changed first, and each change is saved", async () => {
  const saved: string[] = [];
  const storage = (value: string | null): RestLengthStorage => ({
    load: async () => value,
    save: async (next) => {
      saved.push(next);
    },
  });
  const loaded = fixture(storage("120"));
  await flush();
  assert.equal(loaded.rest.getSnapshot().length, 120);
  loaded.rest.adjust(-15);
  assert.deepEqual(saved, ["105"]);
  // A change before the load finishes wins.
  const early = fixture(storage("120"));
  early.rest.adjust(15);
  await flush();
  assert.equal(early.rest.getSnapshot().length, 105);
  // Unreadable or invalid values keep the default.
  for (const value of [null, "7", "601", "100", "1e2", " 90"]) {
    const f = fixture(storage(value));
    await flush();
    assert.equal(f.rest.getSnapshot().length, 90, String(value));
  }
  const failing = fixture({
    load: async () => {
      throw new Error("Disk");
    },
    save: async () => {
      throw new Error("Disk");
    },
  });
  failing.rest.adjust(15);
  await flush();
  assert.equal(failing.rest.getSnapshot().length, 105);
  assert.equal(parseRestLength("600"), 600);
  assert.equal(parseRestLength("15"), 15);
});

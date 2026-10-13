import assert from "node:assert/strict";
import test from "node:test";
import { createReminderController } from "../src/reminders/controller.ts";
import { everyDay, type Reminder } from "../src/reminders/model.ts";
import type { ReminderPermission } from "../src/reminders/notifications.ts";
import { createReminderPersistence, type ReminderStorage } from "../src/reminders/persistence.ts";
import {
  createReminderScheduler,
  reminderSource,
  type ScheduledNotification,
} from "../src/reminders/schedule.ts";

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const encode = (reminders: unknown) => JSON.stringify({ version: 1, reminders });
const allowed = { granted: true, canAskAgain: true };
const undecided = { granted: false, canAskAgain: true };
const refused = { granted: false, canAskAgain: false };
const waterDaily = "kinevault-track.reminder.water.daily";

function reminder(overrides: Partial<Reminder> & Pick<Reminder, "id" | "kind">): Reminder {
  return { enabled: true, time: { hour: 8, minute: 15 }, weekdays: [...everyDay], ...overrides };
}

function device(initial: ScheduledNotification[] = [], shown: ScheduledNotification[] = []) {
  const scheduled = new Map(initial.map((item) => [item.identifier, item.data]));
  const presented = new Map(shown.map((item) => [item.identifier, item.data]));
  const log: string[] = [];
  let failSchedule = false;
  const scheduler = createReminderScheduler({
    async prepare() {},
    async getScheduled() {
      log.push("read");
      return [...scheduled].map(([identifier, data]) => ({ identifier, data }));
    },
    async cancel(identifier) {
      log.push(`cancel ${identifier}`);
      scheduled.delete(identifier);
    },
    async schedule({ identifier, data }) {
      if (failSchedule) throw new Error("denied");
      log.push(`schedule ${identifier}`);
      scheduled.set(identifier, data);
    },
    async getPresented() {
      return [...presented].map(([identifier, data]) => ({ identifier, data }));
    },
    async dismiss(identifier) {
      log.push(`dismiss ${identifier}`);
      presented.delete(identifier);
    },
  });
  return {
    scheduler,
    log,
    ids: () => [...scheduled.keys()].sort(),
    shownIds: () => [...presented.keys()].sort(),
    failSchedules(value: boolean) {
      failSchedule = value;
    },
  };
}

function setup({
  raw = null as string | null,
  signedIn = true,
  permission = undecided as ReminderPermission | null | "fails",
  answer = refused as ReminderPermission,
  holdLoad = false,
  holdAsk = false,
  phone = device(),
} = {}) {
  let saved = raw;
  let releaseAsk: (() => void) | undefined;
  const writes: string[] = [];
  const storage: ReminderStorage = {
    getItem: () => (holdLoad ? new Promise(() => {}) : Promise.resolve(saved)),
    async setItem(_key, value) {
      writes.push(value);
      saved = value;
    },
    async removeItem() {
      saved = null;
    },
  };
  const asked: string[] = [];
  const permissions = {
    async get() {
      asked.push("get");
      if (permission === "fails") throw new Error("unavailable");
      return permission;
    },
    async request() {
      asked.push("request");
      if (holdAsk)
        await new Promise<void>((resolve) => {
          releaseAsk = resolve;
        });
      permission = answer;
      return answer;
    },
  };
  const controller = createReminderController({
    store: createReminderPersistence({ storage }),
    scheduler: phone.scheduler,
    permissions,
    signedIn,
    supported: true,
  });
  return {
    controller,
    phone,
    writes,
    asked,
    allow(next: ReminderPermission | null | "fails") {
      permission = next;
    },
    releaseAsk: () => releaseAsk?.(),
    saved: () => JSON.parse(saved ?? "null") as { reminders: Reminder[] } | null,
  };
}

test("refusing permission while saving keeps the reminder saved but off", async () => {
  const app = setup();
  app.controller.start();
  await flush();
  const custom = reminder({ id: "r-meds", kind: "custom", title: "Meds" });
  assert.equal(await app.controller.saveReminder(custom), true);
  assert.deepEqual(app.asked, ["get", "get", "request"]);
  const stored = app.saved()?.reminders.find((item) => item.id === "r-meds");
  assert.equal(stored?.enabled, false);
  const snapshot = app.controller.getSnapshot();
  assert.match(snapshot.notice ?? "", /saved but off/);
  assert.equal(snapshot.asking, false);
  assert.deepEqual(snapshot.permission, refused);
});

test("refusing permission on a toggle writes nothing and the reminder stays off", async () => {
  const app = setup();
  app.controller.start();
  await flush();
  assert.equal(await app.controller.setEnabled("water", true), false);
  assert.deepEqual(app.writes, []);
  assert.match(app.controller.getSnapshot().notice ?? "", /stays off/);

  // A refusal that can't be asked again isn't asked again.
  app.asked.length = 0;
  assert.equal(await app.controller.setEnabled("water", true), false);
  assert.deepEqual(app.asked, ["get"]);
  // Turning off needs no permission and clears the notice.
  assert.equal(await app.controller.setEnabled("water", false), true);
  assert.equal(app.controller.getSnapshot().notice, null);
});

test("granting permission on a toggle saves the reminder and schedules it", async () => {
  const app = setup({ answer: allowed });
  app.controller.start();
  await flush();
  assert.equal(await app.controller.setEnabled("water", true), true);
  await flush();
  assert.equal(app.saved()?.reminders.find((item) => item.id === "water")?.enabled, true);
  assert.deepEqual(app.phone.ids(), [waterDaily]);
  assert.equal(app.controller.getSnapshot().notice, null);
});

test("a signed-out scope cancels and dismisses reminders before its record loads", async () => {
  const data = { source: reminderSource, kind: "water", reminderId: "water" };
  const phone = device(
    [{ identifier: waterDaily, data }],
    [
      { identifier: waterDaily, data },
      { identifier: "foreign", data: { source: "other" } },
    ],
  );
  const app = setup({ signedIn: false, holdLoad: true, permission: "fails", phone });
  app.controller.start();
  await flush();
  assert.equal(app.controller.getSnapshot().state.kind, "loading");
  assert.deepEqual(phone.ids(), []);
  assert.deepEqual(phone.shownIds(), ["foreign"]);
  assert.equal(app.controller.getSnapshot().scheduleFailed, false);
});

test("an unreadable record or unknown permission leaves the device schedule alone", async () => {
  const kept = { identifier: waterDaily, data: { source: reminderSource, kind: "water" } };
  const unreadable = setup({ raw: "{broken", permission: allowed, phone: device([kept]) });
  unreadable.controller.start();
  await flush();
  assert.equal(unreadable.controller.getSnapshot().state.kind, "error");
  assert.deepEqual(unreadable.phone.log, []);

  const water = reminder({ id: "water", kind: "water" });
  for (const permission of [null, "fails"] as const) {
    const unknown = setup({ raw: encode([water]), permission, phone: device([kept]) });
    unknown.controller.start();
    await flush();
    assert.equal(unknown.controller.getSnapshot().state.kind, "ready");
    assert.equal(unknown.controller.getSnapshot().permission, null);
    unknown.controller.retrySchedule();
    await flush();
    assert.deepEqual(unknown.phone.log, []);
  }
});

test("returning to the foreground re-checks permission and reschedules", async () => {
  const water = reminder({ id: "water", kind: "water" });
  const app = setup({ raw: encode([water]), permission: allowed });
  app.controller.start();
  await flush();
  assert.deepEqual(app.phone.ids(), [waterDaily]);

  // Permission withdrawn in system settings cancels the schedule on return.
  app.allow(refused);
  app.controller.foreground();
  await flush();
  assert.deepEqual(app.controller.getSnapshot().permission, refused);
  assert.deepEqual(app.phone.ids(), []);

  // Allowed again, the saved reminder returns without another prompt.
  app.allow(allowed);
  app.asked.length = 0;
  app.controller.foreground();
  await flush();
  assert.deepEqual(app.asked, ["get"]);
  assert.deepEqual(app.phone.ids(), [waterDaily]);

  // An unchanged return still repairs drift on the device.
  app.phone.log.length = 0;
  app.controller.foreground();
  await flush();
  assert.deepEqual(app.phone.log.slice(0, 1), ["read"]);
});

test("a failed schedule is reported and can be retried", async () => {
  const water = reminder({ id: "water", kind: "water" });
  const phone = device();
  phone.failSchedules(true);
  const app = setup({ raw: encode([water]), permission: allowed, phone });
  app.controller.start();
  await flush();
  assert.equal(app.controller.getSnapshot().scheduleFailed, true);
  assert.deepEqual(phone.ids(), []);

  phone.failSchedules(false);
  app.controller.retrySchedule();
  await flush();
  assert.equal(app.controller.getSnapshot().scheduleFailed, false);
  assert.deepEqual(phone.ids(), [waterDaily]);
});

test("a stopped controller publishes nothing from settling work", async () => {
  const water = reminder({ id: "water", kind: "water" });
  const app = setup({ raw: encode([water]), permission: allowed });
  let updates = 0;
  app.controller.subscribe(() => updates++);
  app.controller.start();
  // Stop before the record and permission settle.
  app.controller.stop();
  const before = app.controller.getSnapshot();
  updates = 0;
  await flush();
  app.controller.foreground();
  app.controller.retrySchedule();
  await flush();
  assert.equal(updates, 0);
  assert.equal(app.controller.getSnapshot(), before);
  assert.deepEqual(app.phone.log, []);

  // A schedule pass still running at stop reports nothing.
  const phone = device();
  phone.failSchedules(true);
  const running = setup({ raw: encode([water]), permission: allowed, phone });
  running.controller.start();
  await flush();
  assert.equal(running.controller.getSnapshot().scheduleFailed, true);
  phone.failSchedules(false);
  running.controller.retrySchedule();
  running.controller.stop();
  updates = 0;
  running.controller.subscribe(() => updates++);
  await flush();
  assert.deepEqual(phone.ids(), [waterDaily]);
  assert.equal(updates, 0);
  assert.equal(running.controller.getSnapshot().scheduleFailed, true);

  // A pending permission prompt settles silently after stop.
  const asking = setup({ answer: allowed });
  asking.controller.start();
  await flush();
  const toggled = asking.controller.setEnabled("water", true);
  asking.controller.stop();
  updates = 0;
  asking.controller.subscribe(() => updates++);
  assert.equal(await toggled, false);
  await flush();
  assert.equal(updates, 0);
  assert.deepEqual(asking.writes, []);
});

test("a prompt that settles while stopped doesn't leave a restarted controller busy", async () => {
  const app = setup({ answer: allowed, holdAsk: true });
  app.controller.start();
  await flush();
  const toggled = app.controller.setEnabled("water", true);
  await flush();
  assert.equal(app.controller.getSnapshot().asking, true);
  app.controller.stop();
  app.releaseAsk();
  assert.equal(await toggled, false);
  app.controller.start();
  await flush();
  assert.equal(app.controller.getSnapshot().asking, false);
});

test("an unknown permission doesn't discard the result of a pass already running", async () => {
  const water = reminder({ id: "water", kind: "water" });
  const phone = device();
  phone.failSchedules(true);
  const app = setup({ raw: encode([water]), permission: allowed, phone });
  app.controller.start();
  await flush();
  assert.equal(app.controller.getSnapshot().scheduleFailed, true);

  // The repair pass succeeds while the permission re-check fails.
  phone.failSchedules(false);
  app.allow("fails");
  app.controller.foreground();
  await flush();
  assert.equal(app.controller.getSnapshot().permission, null);
  assert.deepEqual(phone.ids(), [waterDaily]);
  assert.equal(app.controller.getSnapshot().scheduleFailed, false);
});

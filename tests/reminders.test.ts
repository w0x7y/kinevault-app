import assert from "node:assert/strict";
import test from "node:test";
import {
  createReminderId,
  customTitleFromText,
  defaultReminders,
  describeWeekdays,
  everyDay,
  formatHour,
  formatReminderTime,
  maxReminders,
  maxScheduledReminders,
  parseReminders,
  pendingNotificationCount,
  reminderCopy,
  reminderListError,
  stepHour,
  stepMinute,
  type Reminder,
  type Weekday,
} from "../src/reminders/model.ts";
import {
  createReminderScheduler,
  desiredSchedule,
  expoWeekday,
  isReminderNotification,
  planReconcile,
  reminderSource,
  reminderTapRoute,
  type DesiredNotification,
  type ReminderNotificationAdapter,
  type ScheduledNotification,
} from "../src/reminders/schedule.ts";
import {
  createReminderPersistence,
  remindersStorageKey,
  type ReminderStorage,
} from "../src/reminders/persistence.ts";
import { createAccountStorage, type AccountLocalStorage } from "../src/account/storage.ts";

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
const encode = (reminders: unknown) => JSON.stringify({ version: 1, reminders });
function reminder(overrides: Partial<Reminder> & Pick<Reminder, "id" | "kind">): Reminder {
  return { enabled: true, time: { hour: 8, minute: 15 }, weekdays: [...everyDay], ...overrides };
}
function memory(initial: string | null = null) {
  let raw = initial;
  const storage: ReminderStorage = {
    async getItem(key) {
      assert.equal(key, remindersStorageKey);
      return raw;
    },
    async setItem(key, value) {
      assert.equal(key, remindersStorageKey);
      raw = value;
    },
    async removeItem(key) {
      assert.equal(key, remindersStorageKey);
      raw = null;
    },
  };
  return { storage, raw: () => raw };
}
async function ready(initial: string | null = null) {
  const store = memory(initial);
  const reminders = createReminderPersistence({ storage: store.storage });
  reminders.start();
  await flush();
  return { ...store, reminders };
}
function listOf(store: ReturnType<typeof createReminderPersistence>) {
  const state = store.getSnapshot().state;
  if (state.kind !== "ready") throw new Error("Reminders are not loaded");
  return state.document.reminders;
}

test("missing reminders start as four disabled presets with daily default times", () => {
  const { reminders } = parseReminders(null);
  assert.deepEqual(
    reminders.map(({ id, kind, enabled, time, weekdays }) => [
      id,
      kind,
      enabled,
      `${time.hour}:${time.minute}`,
      weekdays.length,
    ]),
    [
      ["weigh-in", "weigh-in", false, "7:30", 7],
      ["water", "water", false, "11:0", 7],
      ["workout", "workout", false, "18:0", 7],
      ["food", "food", false, "20:0", 7],
    ],
  );
  assert.equal(pendingNotificationCount(reminders), 0);
  assert.deepEqual(parseReminders(encode(reminders)).reminders, reminders);
});

test("unreadable reminder documents are rejected instead of guessed", () => {
  for (const raw of [
    "",
    "broken",
    "null",
    "[]",
    '{"version":2,"reminders":[]}',
    '{"version":1}',
    '{"version":1,"reminders":{}}',
  ])
    assert.throws(() => parseReminders(raw));
});

test("invalid stored reminders are dropped and presets are restored off", () => {
  const extra = reminder({ id: "r-extra", kind: "water", weekdays: [3, 1, 3] as Weekday[] });
  const { reminders } = parseReminders(
    encode([
      extra,
      { ...extra, time: { hour: 9, minute: 0 } },
      reminder({ id: "water", kind: "food" }),
      reminder({ id: "food", kind: "food", time: { hour: 6, minute: 45 } }),
      reminder({ id: "r-hour", kind: "water", time: { hour: 24, minute: 0 } }),
      reminder({ id: "r-minute", kind: "water", time: { hour: 1, minute: 1.5 } }),
      reminder({ id: "r-days", kind: "water", weekdays: [] }),
      reminder({ id: "r-day", kind: "water", weekdays: [0 as Weekday] }),
      reminder({ id: "r-untitled", kind: "custom" }),
      reminder({ id: "Bad id", kind: "water" }),
      { ...reminder({ id: "r-kind", kind: "water" }), kind: "sleep" },
      { ...reminder({ id: "r-on", kind: "water" }), enabled: "yes" },
      reminder({ id: "r-custom", kind: "custom", title: "  Take   vitamins " }),
      reminder({ id: "r-titled", kind: "water", title: "ignored" }),
      "not a reminder",
      null,
    ]),
  );
  assert.deepEqual(
    reminders.map((item) => item.id),
    ["weigh-in", "water", "workout", "food", "r-extra", "r-custom", "r-titled"],
  );
  assert.equal(reminders[1].kind, "water");
  assert.equal(reminders[1].enabled, false);
  assert.deepEqual(reminders[3].time, { hour: 6, minute: 45 });
  assert.deepEqual(reminders[4].weekdays, [1, 3]);
  assert.deepEqual(reminders[4].time, { hour: 8, minute: 15 });
  assert.equal(reminders[5].title, "Take vitamins");
  assert.equal("title" in reminders[6], false);
});

test("stored reminders past the caps are trimmed or turned off", () => {
  const many = Array.from({ length: maxReminders + 3 }, (_, index) =>
    reminder({ id: `r-${index}`, kind: "water", weekdays: [1, 2, 3, 4, 5, 6] }),
  );
  const { reminders } = parseReminders(encode(many));
  assert.equal(reminders.length, maxReminders);
  assert.ok(pendingNotificationCount(reminders) <= maxScheduledReminders);
  // Earlier reminders keep their place in the budget; later ones turn off.
  assert.deepEqual(
    reminders.slice(4).map((item) => item.enabled),
    [true, true, true, true, true, true],
  );
  const crowded = Array.from({ length: 6 }, (_, index) =>
    reminder({ id: `r-${index}`, kind: "water", weekdays: [1, 2, 3, 4, 5, 6] }),
  );
  const presets = defaultReminders().map((item) => ({
    ...item,
    enabled: true,
    weekdays: [1, 2, 3, 4, 5, 6] as Weekday[],
  }));
  const repaired = parseReminders(encode([...presets, ...crowded])).reminders;
  assert.equal(pendingNotificationCount(repaired), maxScheduledReminders);
  assert.deepEqual(
    repaired.map((item) => item.enabled),
    [true, true, true, true, true, true, true, true, false, false],
  );
});

test("custom titles are trimmed, collapsed, length-limited and printable", () => {
  assert.equal(customTitleFromText("  Stretch   your back "), "Stretch your back");
  assert.equal(customTitleFromText("x".repeat(40)), "x".repeat(40));
  for (const text of ["", "   ", "x".repeat(41), "Bad\u0007bell", "Bad\u0085next"])
    assert.equal(customTitleFromText(text), null);
});

test("every day uses one daily trigger and other days use Sunday-first weekly triggers", () => {
  assert.deepEqual(([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map(expoWeekday), [2, 3, 4, 5, 6, 7, 1]);
  const desired = desiredSchedule([
    reminder({ id: "weigh-in", kind: "weigh-in", time: { hour: 7, minute: 30 } }),
    reminder({ id: "water", kind: "water", enabled: false }),
    reminder({ id: "r-photo", kind: "progress-photo", weekdays: [1, 7] }),
    reminder({ id: "r-custom", kind: "custom", title: "Take vitamins", weekdays: [6] }),
  ]);
  assert.deepEqual(
    desired.map(({ identifier, trigger }) => [identifier, trigger]),
    [
      ["kinevault-track.reminder.weigh-in.daily", { type: "daily", hour: 7, minute: 30 }],
      [
        "kinevault-track.reminder.r-photo.weekly-2",
        { type: "weekly", weekday: 2, hour: 8, minute: 15 },
      ],
      [
        "kinevault-track.reminder.r-photo.weekly-1",
        { type: "weekly", weekday: 1, hour: 8, minute: 15 },
      ],
      [
        "kinevault-track.reminder.r-custom.weekly-7",
        { type: "weekly", weekday: 7, hour: 8, minute: 15 },
      ],
    ],
  );
  assert.equal(desired[0].title, "Time to weigh in");
  assert.equal(desired[3].title, "Take vitamins");
  assert.equal(desired[3].body, null);
  assert.deepEqual(
    { ...desired[1].data, fingerprint: undefined },
    {
      source: reminderSource,
      reminderId: "r-photo",
      kind: "progress-photo",
      fingerprint: undefined,
    },
  );
  for (const kind of ["weigh-in", "water", "workout", "food", "progress-photo"] as const) {
    const { title, body } = reminderCopy({ kind });
    assert.ok(title && body && !title.includes("!") && !body.includes("!"));
  }
});

test("the pending-notification cap counts daily reminders once", () => {
  const sixDays: Weekday[] = [1, 2, 3, 4, 5, 6];
  const list = [
    ...defaultReminders().map((item) => ({ ...item, enabled: true })),
    ...Array.from({ length: 6 }, (_, index) =>
      reminder({ id: `r-${index}`, kind: "water", weekdays: sixDays }),
    ),
  ];
  assert.equal(pendingNotificationCount(list), 4 + 36);
  assert.equal(desiredSchedule(list).length, 40);
  assert.equal(reminderListError(list), null);
  const over = list.map((item) => (item.id === "food" ? { ...item, weekdays: sixDays } : item));
  assert.equal(pendingNotificationCount(over), 3 + 6 + 36);
  assert.equal(reminderListError(over), null);
  const tooMany = over.map((item) =>
    item.id === "water" || item.id === "workout" ? { ...item, weekdays: sixDays } : item,
  );
  assert.equal(pendingNotificationCount(tooMany), 1 + 18 + 36);
  assert.match(reminderListError(tooMany) ?? "", /more reminder times/);
  assert.match(
    reminderListError([...list, reminder({ id: "r-extra", kind: "food" })]) ?? "",
    /up to 10 reminders/,
  );
});

test("reconcile keeps matching notifications and never touches other notifications", () => {
  const desired = desiredSchedule([
    reminder({ id: "water", kind: "water" }),
    reminder({ id: "food", kind: "food", weekdays: [1, 2] }),
  ]);
  const [water, monday, tuesday] = desired;
  const scheduled: ScheduledNotification[] = [
    { identifier: water.identifier, data: water.data },
    { identifier: monday.identifier, data: { ...monday.data, fingerprint: "stale" } },
    { identifier: "kinevault-track.reminder.r-gone.daily", data: {} },
    { identifier: "renamed", data: { source: reminderSource } },
    { identifier: "someone-else", data: { source: "elsewhere" } },
    { identifier: "plain", data: null },
  ];
  assert.deepEqual(planReconcile(scheduled, desired), {
    cancel: [monday.identifier, "kinevault-track.reminder.r-gone.daily", "renamed"],
    schedule: [monday, tuesday],
  });
  assert.equal(isReminderNotification({ identifier: "someone-else", data: [] }), false);
  assert.deepEqual(planReconcile(scheduled, []).cancel, [
    water.identifier,
    monday.identifier,
    "kinevault-track.reminder.r-gone.daily",
    "renamed",
  ]);
});

function fakeDevice(initial: ScheduledNotification[] = [], shown: ScheduledNotification[] = []) {
  const scheduled = new Map(initial.map((item) => [item.identifier, item.data]));
  const presented = new Map(shown.map((item) => [item.identifier, item.data]));
  const log: string[] = [];
  let failSchedule = false;
  let gate: Promise<void> | null = null;
  const adapter: ReminderNotificationAdapter = {
    async prepare() {
      log.push("prepare");
    },
    async getScheduled() {
      log.push("read");
      if (gate) await gate;
      return [...scheduled].map(([identifier, data]) => ({ identifier, data }));
    },
    async cancel(identifier) {
      log.push(`cancel ${identifier}`);
      scheduled.delete(identifier);
    },
    async schedule(notification: DesiredNotification) {
      if (failSchedule) throw new Error("denied");
      log.push(`schedule ${notification.identifier}`);
      scheduled.set(notification.identifier, notification.data);
    },
    async getPresented() {
      return [...presented].map(([identifier, data]) => ({ identifier, data }));
    },
    async dismiss(identifier) {
      log.push(`dismiss ${identifier}`);
      presented.delete(identifier);
    },
  };
  return {
    adapter,
    log,
    ids: () => [...scheduled.keys()].sort(),
    shownIds: () => [...presented.keys()].sort(),
    failNextSchedules: (value: boolean) => {
      failSchedule = value;
    },
    hold() {
      let release!: () => void;
      gate = new Promise((resolve) => {
        release = resolve;
      });
      return () => {
        gate = null;
        release();
      };
    },
  };
}

test("the scheduler converges, skips superseded passes and reports failures", async () => {
  const device = fakeDevice([{ identifier: "foreign", data: { source: "other" } }]);
  const scheduler = createReminderScheduler(device.adapter);
  const water = reminder({ id: "water", kind: "water" });
  assert.equal(await scheduler.reconcile([water]), true);
  assert.deepEqual(device.ids(), ["foreign", "kinevault-track.reminder.water.daily"]);
  device.log.length = 0;
  assert.equal(await scheduler.reconcile([water]), true);
  // An unchanged schedule is left alone, without preparing a channel.
  assert.deepEqual(device.log, ["read"]);

  // Signing out queues behind a running pass; an intermediate request is skipped.
  const release = device.hold();
  const first = scheduler.reconcile([{ ...water, weekdays: [1] }]);
  await flush();
  assert.deepEqual(device.log.slice(-1), ["read"]);
  const skipped = scheduler.reconcile([{ ...water, weekdays: [2] }]);
  const signedOut = scheduler.reconcile([]);
  release();
  assert.deepEqual(await Promise.all([first, skipped, signedOut]), [true, null, true]);
  assert.deepEqual(device.ids(), ["foreign"]);
  assert.deepEqual(device.log.slice(-6), [
    "read",
    "cancel kinevault-track.reminder.water.daily",
    "prepare",
    "schedule kinevault-track.reminder.water.weekly-2",
    "read",
    "cancel kinevault-track.reminder.water.weekly-2",
  ]);

  device.failNextSchedules(true);
  assert.equal(await scheduler.reconcile([water]), false);
  device.failNextSchedules(false);
  assert.equal(await scheduler.reconcile([water]), true);
  assert.deepEqual(device.ids(), ["foreign", "kinevault-track.reminder.water.daily"]);
});

test("signing out also clears reminders already shown, and only those", async () => {
  const shown = { source: reminderSource, kind: "custom", reminderId: "meds" };
  const device = fakeDevice(
    [],
    [
      { identifier: "kinevault-track.reminder.meds.daily", data: shown },
      { identifier: "foreign", data: { source: "other" } },
    ],
  );
  const scheduler = createReminderScheduler(device.adapter);
  const water = reminder({ id: "water", kind: "water" });
  assert.equal(await scheduler.reconcile([water]), true);
  assert.equal(await scheduler.reconcile([]), true);
  // A signed-in pass, or one that only lost permission, leaves delivered reminders.
  assert.deepEqual(device.shownIds(), ["foreign", "kinevault-track.reminder.meds.daily"]);
  assert.equal(await scheduler.reconcile([], { dismissDelivered: true }), true);
  assert.deepEqual(device.shownIds(), ["foreign"]);
  assert.deepEqual(device.log.slice(-2), ["read", "dismiss kinevault-track.reminder.meds.daily"]);
});

test("signing out still cancels scheduled reminders when shown ones can't be listed", async () => {
  const water = desiredSchedule([reminder({ id: "water", kind: "water" })])[0];
  const device = fakeDevice([{ identifier: water.identifier, data: water.data }]);
  const scheduler = createReminderScheduler({
    ...device.adapter,
    async getPresented() {
      throw new Error("unavailable");
    },
  });
  assert.equal(await scheduler.reconcile([], { dismissDelivered: true }), false);
  assert.deepEqual(device.ids(), []);
});

test("tapping a reminder opens the screen for its kind", () => {
  const data = (kind: unknown) => ({ source: reminderSource, kind, reminderId: "x" });
  assert.equal(reminderTapRoute(data("weigh-in")), "/profile?section=overview");
  assert.equal(reminderTapRoute(data("water")), "/");
  assert.equal(reminderTapRoute(data("workout")), "/exercise");
  assert.equal(reminderTapRoute(data("food")), "/food");
  assert.equal(reminderTapRoute(data("progress-photo")), "/profile?section=photos");
  assert.equal(reminderTapRoute(data("custom")), "/");
  assert.equal(reminderTapRoute(data("future-kind")), "/");
  for (const other of [null, undefined, "x", [], { kind: "food" }, { source: "other" }])
    assert.equal(reminderTapRoute(other), null);
});

test("times, steps and weekday summaries", () => {
  assert.equal(formatReminderTime({ hour: 7, minute: 5 }, "24h"), "07:05");
  assert.equal(formatReminderTime({ hour: 0, minute: 0 }, "12h"), "12:00 AM");
  assert.equal(formatReminderTime({ hour: 12, minute: 30 }, "12h"), "12:30 PM");
  assert.equal(formatReminderTime({ hour: 23, minute: 59 }, "12h"), "11:59 PM");
  assert.equal(formatHour(13, "12h"), "1 PM");
  assert.equal(formatHour(9, "24h"), "09");
  assert.deepEqual([stepHour(23, 1), stepHour(0, -1), stepHour(7, 1)], [0, 23, 8]);
  assert.deepEqual(
    [
      stepMinute(0, -1),
      stepMinute(55, 1),
      stepMinute(32, 1),
      stepMinute(32, -1),
      stepMinute(30, 1),
    ],
    [55, 0, 35, 30, 35],
  );
  assert.equal(describeWeekdays([...everyDay]), "Every day");
  assert.equal(describeWeekdays([5, 4, 3, 2, 1]), "Weekdays");
  assert.equal(describeWeekdays([7, 6]), "Weekends");
  assert.equal(describeWeekdays([5, 1, 3]), "Mon, Wed, Fri");
  const id = createReminderId(0, 0.5);
  assert.match(id, /^r-0-[a-z0-9]{4}$/);
  assert.notEqual(createReminderId(1, 0.1), createReminderId(1, 0.2));
});

test("persistence toggles, adds, edits and deletes reminders within the caps", async () => {
  const { reminders, raw } = await ready();
  assert.equal(await reminders.setEnabled("water", true), true);
  assert.equal(listOf(reminders)[1].enabled, true);
  const added = reminder({ id: "r-vitamins", kind: "custom", title: "Take vitamins" });
  assert.equal(await reminders.saveReminder(added), true);
  assert.equal(
    await reminders.saveReminder({ ...added, time: { hour: 21, minute: 0 }, weekdays: [6, 7] }),
    true,
  );
  const reloaded = parseReminders(raw()).reminders;
  assert.deepEqual(reloaded.at(-1), {
    ...added,
    time: { hour: 21, minute: 0 },
    weekdays: [6, 7],
  });

  assert.equal(await reminders.saveReminder({ ...added, title: "  " }), false);
  assert.match(reminders.getSnapshot().error ?? "", /Check the reminder/);
  assert.equal(await reminders.deleteReminder("water"), false);
  assert.equal(listOf(reminders).length, 5);
  assert.equal(await reminders.deleteReminder("r-vitamins"), true);
  assert.equal(listOf(reminders).length, 4);
  assert.equal(await reminders.setEnabled("r-vitamins", true), false);

  for (let index = 0; index < 6; index++)
    assert.equal(
      await reminders.saveReminder(reminder({ id: `r-${index}`, kind: "water", weekdays: [1] })),
      true,
    );
  assert.equal(await reminders.saveReminder(reminder({ id: "r-more", kind: "water" })), false);
  assert.match(reminders.getSnapshot().error ?? "", /up to 10 reminders/);
  assert.equal(listOf(reminders).length, maxReminders);
});

test("an unreadable reminder record can be reset to the defaults", async () => {
  const { reminders, raw } = await ready("{broken");
  assert.equal(reminders.getSnapshot().state.kind, "error");
  assert.equal(await reminders.reset(), true);
  assert.equal(raw(), null);
  assert.deepEqual(listOf(reminders), defaultReminders());
});

test("reminders stay on this device, scoped to the signed-in account and never uploaded", async () => {
  const values = new Map<string, string>();
  const local: AccountLocalStorage = {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
  const uploads: string[] = [];
  const remote = {
    async list() {
      return [];
    },
    async save(key: string) {
      uploads.push(key);
      return null;
    },
  };
  async function signedIn(userId: string) {
    const storage = createAccountStorage({ userId, local, remote });
    await storage.start();
    const reminders = createReminderPersistence({ storage });
    reminders.start();
    for (let i = 0; i < 20; i++) await Promise.resolve();
    return { storage, reminders };
  }
  const first = await signedIn("user-1");
  assert.equal(await first.reminders.setEnabled("workout", true), true);
  assert.equal(uploads.length, 0);
  assert.equal(values.has(remindersStorageKey), false);
  const saved = values.get(`kinevault-track.account.user-1.${remindersStorageKey}`);
  assert.equal(parseReminders(saved ?? null).reminders[2].enabled, true);
  first.reminders.stop();
  first.storage.stop();

  const second = await signedIn("user-2");
  assert.deepEqual(listOf(second.reminders), defaultReminders());
  second.reminders.stop();
  second.storage.stop();
  assert.equal(listOf((await signedIn("user-1")).reminders)[2].enabled, true);
});

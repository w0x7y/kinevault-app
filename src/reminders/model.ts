export const reminderKinds = [
  "weigh-in",
  "water",
  "workout",
  "food",
  "progress-photo",
  "custom",
] as const;
export type ReminderKind = (typeof reminderKinds)[number];
export type ReminderTime = { hour: number; minute: number };
/** ISO weekday: 1 is Monday and 7 is Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Reminder = {
  id: string;
  kind: ReminderKind;
  /** Only custom reminders carry a user-written title. */
  title?: string;
  enabled: boolean;
  time: ReminderTime;
  weekdays: Weekday[];
};
export type RemindersDocument = { version: 1; reminders: Reminder[] };
export type ReminderRoute =
  "/" | "/food" | "/exercise" | "/profile?section=overview" | "/profile?section=photos";

export const everyDay: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
export const maxReminders = 10;
// iOS keeps at most 64 pending local notifications per app. Leave headroom.
export const maxScheduledReminders = 48;
export const maxCustomTitleLength = 40;

export const reminderLabels: Record<ReminderKind, string> = {
  "weigh-in": "Weigh-in",
  water: "Water",
  workout: "Workout",
  food: "Food log",
  "progress-photo": "Progress photo",
  custom: "Custom",
};

const kindDefaults: Record<ReminderKind, Pick<Reminder, "time" | "weekdays">> = {
  "weigh-in": { time: { hour: 7, minute: 30 }, weekdays: [...everyDay] },
  water: { time: { hour: 11, minute: 0 }, weekdays: [...everyDay] },
  workout: { time: { hour: 18, minute: 0 }, weekdays: [...everyDay] },
  food: { time: { hour: 20, minute: 0 }, weekdays: [...everyDay] },
  // A weekly photo keeps comparisons meaningful without daily prompts.
  "progress-photo": { time: { hour: 9, minute: 0 }, weekdays: [7] },
  custom: { time: { hour: 12, minute: 0 }, weekdays: [...everyDay] },
};

// Presets use their kind as a fixed identity, are always present, and start off.
const presetKinds = ["weigh-in", "water", "workout", "food"] as const;
type PresetKind = (typeof presetKinds)[number];
export function isPresetId(id: string): id is PresetKind {
  return presetKinds.some((kind) => kind === id);
}

export function reminderDefaults(kind: ReminderKind): Pick<Reminder, "time" | "weekdays"> {
  const defaults = kindDefaults[kind];
  return { time: { ...defaults.time }, weekdays: [...defaults.weekdays] };
}

export function defaultReminders(): Reminder[] {
  return presetKinds.map((kind) => ({ id: kind, kind, enabled: false, ...reminderDefaults(kind) }));
}

export function createReminderId(now = Date.now(), random = Math.random()): string {
  return `r-${now.toString(36)}-${Math.floor(random * 36 ** 4)
    .toString(36)
    .padStart(4, "0")}`;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isKind(value: unknown): value is ReminderKind {
  return reminderKinds.some((kind) => kind === value);
}

function wholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

export function customTitleFromText(text: string): string | null {
  const title = text.trim().replace(/\s+/g, " ");
  if (!title || title.length > maxCustomTitleLength) return null;
  // Control characters would render unpredictably in a system banner.
  for (const character of title) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return null;
  }
  return title;
}

function normalizeWeekdays(value: unknown): Weekday[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const days = new Set<Weekday>();
  for (const day of value) {
    if (!wholeNumber(day, 1, 7)) return null;
    days.add(day as Weekday);
  }
  return [...days].sort((a, b) => a - b);
}

/** Validates one stored or edited reminder. Invalid input returns null. */
export function parseReminder(value: unknown): Reminder | null {
  const item = record(value);
  if (!item) return null;
  const { id, kind, title, enabled, time, weekdays } = item;
  if (typeof id !== "string" || !/^[a-z0-9-]{1,40}$/.test(id) || !isKind(kind)) return null;
  if (isPresetId(id) && kind !== id) return null;
  if (typeof enabled !== "boolean") return null;
  const clock = record(time);
  if (!clock || !wholeNumber(clock.hour, 0, 23) || !wholeNumber(clock.minute, 0, 59)) return null;
  const days = normalizeWeekdays(weekdays);
  if (!days) return null;
  const reminder: Reminder = {
    id,
    kind,
    enabled,
    time: { hour: clock.hour, minute: clock.minute },
    weekdays: days,
  };
  if (kind === "custom") {
    const text = typeof title === "string" ? customTitleFromText(title) : null;
    if (!text) return null;
    reminder.title = text;
  }
  return reminder;
}

function scheduledCount(reminder: Pick<Reminder, "enabled" | "weekdays">): number {
  if (!reminder.enabled) return 0;
  // Every day uses one daily trigger; other selections use one weekly trigger per day.
  return reminder.weekdays.length === 7 ? 1 : reminder.weekdays.length;
}

export function pendingNotificationCount(reminders: readonly Reminder[]): number {
  return reminders.reduce((total, reminder) => total + scheduledCount(reminder), 0);
}

/**
 * Repairs a stored list: drops invalid or duplicate entries, restores missing
 * presets (off), keeps presets first, and turns off reminders past the caps.
 */
function normalizeReminders(values: readonly unknown[]): Reminder[] {
  const found = new Map<string, Reminder>();
  for (const value of values) {
    const reminder = parseReminder(value);
    if (reminder && !found.has(reminder.id)) found.set(reminder.id, reminder);
  }
  const presets = defaultReminders().map((preset) => found.get(preset.id) ?? preset);
  const added = [...found.values()]
    .filter((reminder) => !isPresetId(reminder.id))
    .slice(0, maxReminders - presets.length);
  let budget = maxScheduledReminders;
  return [...presets, ...added].map((reminder) => {
    const count = scheduledCount(reminder);
    if (count > budget) return { ...reminder, enabled: false };
    budget -= count;
    return reminder;
  });
}

export function parseReminders(raw: string | null): RemindersDocument {
  if (raw === null) return { version: 1, reminders: defaultReminders() };
  const value = record(JSON.parse(raw));
  if (!value || value.version !== 1 || !Array.isArray(value.reminders))
    throw new Error("Invalid reminders");
  return { version: 1, reminders: normalizeReminders(value.reminders) };
}

/** Returns an error message when the list can't be saved as-is. */
export function reminderListError(reminders: readonly Reminder[]): string | null {
  if (reminders.length > maxReminders)
    return `You can have up to ${maxReminders} reminders. Delete one to add another.`;
  if (pendingNotificationCount(reminders) > maxScheduledReminders)
    return "That's more reminder times than this device can hold. Choose every day for a reminder or turn one off.";
  return null;
}

export function reminderName(reminder: Pick<Reminder, "kind" | "title">): string {
  return reminder.kind === "custom" && reminder.title
    ? reminder.title
    : reminderLabels[reminder.kind];
}

const copy: Record<Exclude<ReminderKind, "custom">, { title: string; body: string }> = {
  "weigh-in": {
    title: "Time to weigh in",
    body: "Log today's weight. Weighing at the same time each day keeps your trend accurate.",
  },
  water: { title: "Time for some water", body: "Have a glass and add it to today's water." },
  workout: {
    title: "Time to train",
    body: "Start a saved workout, or log one you've already done.",
  },
  food: {
    title: "Log your food",
    body: "Add today's meals and drinks while they're fresh in your mind.",
  },
  "progress-photo": {
    title: "Progress photo time",
    body: "Use the same spot and light so your comparison stays fair.",
  },
};

export function reminderCopy(reminder: Pick<Reminder, "kind" | "title">): {
  title: string;
  body: string | null;
} {
  if (reminder.kind === "custom") return { title: reminderName(reminder), body: null };
  return copy[reminder.kind];
}

const routes: Record<ReminderKind, ReminderRoute> = {
  // The weight journal is only on Overview; the tab otherwise keeps its last section.
  "weigh-in": "/profile?section=overview",
  water: "/",
  workout: "/exercise",
  food: "/food",
  "progress-photo": "/profile?section=photos",
  custom: "/",
};

export function reminderRoute(kind: ReminderKind): ReminderRoute {
  return routes[kind];
}

const weekdayNames: Record<Weekday, { short: string; long: string }> = {
  1: { short: "Mon", long: "Monday" },
  2: { short: "Tue", long: "Tuesday" },
  3: { short: "Wed", long: "Wednesday" },
  4: { short: "Thu", long: "Thursday" },
  5: { short: "Fri", long: "Friday" },
  6: { short: "Sat", long: "Saturday" },
  7: { short: "Sun", long: "Sunday" },
};

export function weekdayName(day: Weekday, length: "short" | "long" = "short"): string {
  return weekdayNames[day][length];
}

export function describeWeekdays(weekdays: readonly Weekday[]): string {
  const key = [...weekdays].sort((a, b) => a - b).join(",");
  if (key === "1,2,3,4,5,6,7") return "Every day";
  if (key === "1,2,3,4,5") return "Weekdays";
  if (key === "6,7") return "Weekends";
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((day) => weekdayName(day))
    .join(", ");
}

export type ClockFormat = "12h" | "24h";

export function formatHour(hour: number, clock: ClockFormat): string {
  if (clock === "24h") return String(hour).padStart(2, "0");
  return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
}

export function formatReminderTime({ hour, minute }: ReminderTime, clock: ClockFormat): string {
  const minutes = String(minute).padStart(2, "0");
  if (clock === "24h") return `${String(hour).padStart(2, "0")}:${minutes}`;
  return `${hour % 12 || 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`;
}

export function stepHour(hour: number, direction: 1 | -1): number {
  return (hour + direction + 24) % 24;
}

const minuteStep = 5;

/** Moves to the next 5-minute mark, wrapping within the hour. */
export function stepMinute(minute: number, direction: 1 | -1): number {
  const next =
    direction === 1
      ? Math.floor(minute / minuteStep) * minuteStep + minuteStep
      : Math.ceil(minute / minuteStep) * minuteStep - minuteStep;
  return (next + 60) % 60;
}

/** Day identifiers are local dates. UTC conversion can change the chosen day. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDay(day: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new RangeError("Invalid calendar day");
  const [, year, month, date] = match;
  // Noon avoids local midnight transitions when moving between calendar dates.
  const result = new Date(0);
  result.setFullYear(Number(year), Number(month) - 1, Number(date));
  result.setHours(12, 0, 0, 0);
  if (dayKey(result) !== day) throw new RangeError("Invalid calendar day");
  return result;
}

export function addDays(day: string, amount: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + amount);
  return dayKey(date);
}

/** Five Sunday-first weeks, always anchored on today's week in the middle. */
export function calendarWeeks(today: string): string[][] {
  const start = addDays(today, -parseDay(today).getDay() - 14);
  return Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 7 }, (_, column) => addDays(start, row * 7 + column)),
  );
}

export function millisecondsUntilTomorrow(now: Date): number {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

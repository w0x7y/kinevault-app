import { parseDay } from "../calendar/dates.ts";

/** Steps logged by hand, per day. Phone steps are read from the device, never stored. */
export type StepsLogDocument = { version: 1; days: Record<string, number> };
export type SetStepsInput = { date: string; steps: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseStepsLog(raw: string | null): StepsLogDocument {
  if (raw === null) return { version: 1, days: {} };
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.days))
    throw new Error("Unsupported steps log");
  const days: StepsLogDocument["days"] = {};
  for (const [date, steps] of Object.entries(value.days)) {
    parseDay(date);
    if (!isCount(steps)) throw new Error("Invalid step count");
    days[date] = steps;
  }
  return { version: 1, days };
}

export function setSteps(
  document: StepsLogDocument,
  { date, steps }: SetStepsInput,
): StepsLogDocument {
  parseDay(date);
  if (!isCount(steps)) throw new RangeError("Invalid step count");
  return { version: 1, days: { ...document.days, [date]: steps } };
}

export function stepsFromText(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const steps = Number(text.trim());
  return isCount(steps) ? steps : null;
}

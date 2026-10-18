import { parseDay } from "../calendar/dates.ts";
import { createDocumentEdit, type ParsedDraft } from "./document-edit.ts";
import { createDurableWrite, type DurableStorage } from "./durable-write.ts";

/** One whole, non-negative amount per date, such as Manual water or Logged steps. */
export type DayAmountDocument = { version: 1; days: Record<string, number> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Parses a saved day amount document; `name` only labels the thrown error. */
export function parseDayAmounts(raw: string | null, name: string): DayAmountDocument {
  if (raw === null) return { version: 1, days: {} };
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.days))
    throw new Error(`Unsupported ${name}`);
  const days: DayAmountDocument["days"] = {};
  for (const [date, amount] of Object.entries(value.days)) {
    parseDay(date);
    if (!isAmount(amount)) throw new Error(`Invalid ${name} amount`);
    days[date] = amount;
  }
  return { version: 1, days };
}

/** A whole number from zero to the safe maximum, with no sign, decimals or separators. */
export function dayAmountFromText(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const amount = Number(text.trim());
  return isAmount(amount) ? amount : null;
}

export function createDayAmountLog({
  storage,
  key,
  parse,
  failure,
}: {
  storage: DurableStorage;
  key: string;
  parse: (raw: string | null) => DayAmountDocument;
  /** Shown when a save fails. */
  failure: string;
}) {
  const { update, remove: _remove, ...lifecycle } = createDurableWrite({ storage, key, parse });
  return {
    ...lifecycle,
    /** Replaces one date's amount; zero clears it without changing other days. */
    async set({ date, amount }: { date: string; amount: number }): Promise<boolean> {
      return (
        (await update((document) => {
          parseDay(date);
          if (!isAmount(amount)) throw new RangeError("Invalid day amount");
          return {
            document: { version: 1, days: { ...document.days, [date]: amount } },
            value: true,
          };
        }, failure)) === true
      );
    },
  };
}

export type DayAmountStore = Pick<
  ReturnType<typeof createDayAmountLog>,
  "getSnapshot" | "subscribe" | "retryLoad" | "set"
>;

// A day amount edit replaces one date's amount, captured when the edit is created.
// Its draft is filled from that date's saved amount once, even when the log loads
// late, and never replaces text the user has entered.
export function createDayAmountEdit({
  log,
  date,
  invalid,
  failure,
}: {
  log: DayAmountStore;
  date: string;
  /** Shown when the draft isn't a whole number from zero. */
  invalid: string;
  failure: string;
}) {
  const edit = createDocumentEdit({
    document: log,
    draft: "",
    seed: (document) => String(document.days[date] ?? 0),
    parse(draft): ParsedDraft<number> {
      const amount = dayAmountFromText(draft);
      return amount === null ? { error: invalid } : { value: amount };
    },
    write: (amount) => log.set({ date, amount }),
    failure,
  });
  return {
    ...edit,
    /** Steps the entered amount, treating unreadable text as zero and never going below it. */
    adjust(delta: number) {
      const current = dayAmountFromText(edit.getSnapshot().draft) ?? 0;
      return edit.change(String(Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, current + delta))));
    },
  };
}

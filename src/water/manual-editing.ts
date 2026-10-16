import { createDocumentEdit, type ParsedDraft } from "../persistence/document-edit.ts";
import { manualWaterAmountFromText } from "./model.ts";
import type { createWaterLogPersistence } from "./persistence.ts";

type WaterLogStore = Pick<
  ReturnType<typeof createWaterLogPersistence>,
  "getSnapshot" | "subscribe" | "retryLoad" | "set"
>;

// A Manual water edit replaces one date's amount, captured when the edit is
// created. Its draft is filled from that date's saved amount once, even when
// the log loads late, and never replaces text the user has entered.
export function createManualWaterEdit({ log, date }: { log: WaterLogStore; date: string }) {
  const edit = createDocumentEdit({
    document: log,
    draft: "",
    seed: (document) => String(document.days[date] ?? 0),
    parse(draft): ParsedDraft<number> {
      const ml = manualWaterAmountFromText(draft);
      return ml === null
        ? { error: "Enter a whole number of milliliters, 0 or more." }
        : { value: ml };
    },
    write: (ml) => log.set({ date, ml }),
    failure: "Couldn't save your water log. Try again.",
  });
  return {
    ...edit,
    /** Steps the entered amount, treating unreadable text as zero and never going below it. */
    adjust(deltaMl: number) {
      const current = manualWaterAmountFromText(edit.getSnapshot().draft) ?? 0;
      return edit.change(String(Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, current + deltaMl))));
    },
  };
}

import { createDocumentEdit, type ParsedDraft } from "../persistence/document-edit.ts";
import { stepsFromText } from "./model.ts";
import type { createStepsLogPersistence } from "./persistence.ts";

type StepsLogStore = Pick<
  ReturnType<typeof createStepsLogPersistence>,
  "getSnapshot" | "subscribe" | "retryLoad" | "set"
>;

// Replaces one date's logged steps, like a Manual water edit.
export function createManualStepsEdit({ log, date }: { log: StepsLogStore; date: string }) {
  const edit = createDocumentEdit({
    document: log,
    draft: "",
    seed: (document) => String(document.days[date] ?? 0),
    parse(draft): ParsedDraft<number> {
      const steps = stepsFromText(draft);
      return steps === null
        ? { error: "Enter a whole number of steps, 0 or more." }
        : { value: steps };
    },
    write: (steps) => log.set({ date, steps }),
    failure: "Couldn't save your steps. Try again.",
  });
  return {
    ...edit,
    /** Steps the entered count, treating unreadable text as zero and never going below it. */
    adjust(delta: number) {
      const current = stepsFromText(edit.getSnapshot().draft) ?? 0;
      return edit.change(String(Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, current + delta))));
    },
  };
}

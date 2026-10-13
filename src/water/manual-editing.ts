import { manualWaterAmountFromText } from "./model.ts";
import type { createWaterLogPersistence } from "./persistence.ts";

type WaterLogStore = Pick<
  ReturnType<typeof createWaterLogPersistence>,
  "getSnapshot" | "subscribe" | "set"
>;
export type ManualWaterEditSnapshot = Readonly<{
  draft: string;
  error: string | null;
  busy: boolean;
  ready: boolean;
}>;

// A Manual water edit replaces one date's amount, captured when the edit is
// created. Its draft is filled from that date's saved amount once, even when
// the log loads late, and never replaces text the user has entered.
// Save feedback belongs to this edit; a new edit never shows an older edit's error.
export function createManualWaterEdit({ log, date }: { log: WaterLogStore; date: string }) {
  let active = false;
  let generation = 0;
  let filled = false;
  let draft = "";
  let error: string | null = null;
  let pending: { generation: number } | null = null;
  let unsubscribe: (() => void) | null = null;
  let notifying = 0;
  const listeners = new Set<() => void>();
  fill();
  let snapshot: ManualWaterEditSnapshot = {
    draft,
    error,
    busy: log.getSnapshot().saving,
    ready: log.getSnapshot().state.kind === "ready",
  };

  function fill() {
    const state = log.getSnapshot().state;
    if (filled || state.kind !== "ready") return;
    filled = true;
    draft = String(state.document.days[date] ?? 0);
  }
  function publish() {
    fill();
    const saved = log.getSnapshot();
    const busy = pending !== null || saved.saving;
    const ready = saved.state.kind === "ready";
    if (
      snapshot.draft === draft &&
      snapshot.error === error &&
      snapshot.busy === busy &&
      snapshot.ready === ready
    )
      return;
    snapshot = { draft, error, busy, ready };
    notifying++;
    try {
      for (const listener of listeners) listener();
    } finally {
      notifying--;
    }
  }
  function idle() {
    return active && !pending && !log.getSnapshot().saving;
  }
  function enter(text: string) {
    draft = text;
    filled = true;
    error = null;
    publish();
  }
  async function complete(ticket: NonNullable<typeof pending>, write: Promise<boolean>) {
    const success = await write;
    if (pending === ticket) pending = null;
    const current = active && ticket.generation === generation;
    if (!success && current)
      error = log.getSnapshot().error ?? "Couldn't save your water log. Try again.";
    publish();
    return success && current;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (active) return;
      active = true;
      unsubscribe = log.subscribe(publish);
      publish();
    },
    stop() {
      if (!active) return;
      active = false;
      // A closed edit's durable write can still finish, but cannot close a newer edit.
      ++generation;
      pending = null;
      unsubscribe?.();
      unsubscribe = null;
      publish();
    },
    change(text: string) {
      if (!idle()) return false;
      enter(text);
      return true;
    },
    /** Steps the entered amount, treating unreadable text as zero and never going below it. */
    adjust(deltaMl: number) {
      if (!idle()) return false;
      const current = manualWaterAmountFromText(draft) ?? 0;
      enter(String(Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, current + deltaMl))));
      return true;
    },
    /** Resolves true only when this edit's amount was saved and the edit is still open. */
    save(): Promise<boolean> {
      if (!idle() || notifying || log.getSnapshot().state.kind !== "ready")
        return Promise.resolve(false);
      const ml = manualWaterAmountFromText(draft);
      if (ml === null) {
        error = "Enter a whole number of millilitres, 0 or more.";
        publish();
        return Promise.resolve(false);
      }
      error = null;
      const ticket = { generation };
      pending = ticket;
      // Reserve persistence before observers can submit a competing water write.
      const write = log.set({ date, ml });
      publish();
      return complete(ticket, write);
    },
  };
}

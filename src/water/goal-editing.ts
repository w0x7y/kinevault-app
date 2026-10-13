import { waterGoalFromText, waterGoalRangeMessage } from "./goal-model.ts";
import type { createWaterGoalPersistence } from "./goal-persistence.ts";

type WaterGoalStore = Pick<
  ReturnType<typeof createWaterGoalPersistence>,
  "getSnapshot" | "subscribe" | "setGoal"
>;
export type WaterGoalEditSnapshot = Readonly<{
  draft: string;
  error: string | null;
  busy: boolean;
  saved: boolean;
}>;

// A Water goal edit owns its entered amount and save feedback. Until the user
// types, the draft follows the saved goal, including another device's update.
// Failures belong to this edit; a new edit never shows an older edit's error.
export function createWaterGoalEdit(goal: WaterGoalStore) {
  let active = false;
  let generation = 0;
  let dirty = false;
  let draft = savedDraft() ?? "";
  let error: string | null = null;
  let saved = false;
  let pending: { generation: number } | null = null;
  let unsubscribe: (() => void) | null = null;
  let notifying = 0;
  const listeners = new Set<() => void>();
  let snapshot: WaterGoalEditSnapshot = {
    draft,
    error,
    busy: goal.getSnapshot().saving,
    saved,
  };

  function savedDraft() {
    const state = goal.getSnapshot().state;
    return state.kind === "ready" ? String(state.document.dailyMl) : null;
  }
  function publish() {
    // An unavailable goal keeps the last draft until a document loads again.
    if (!dirty) draft = savedDraft() ?? draft;
    const busy = pending !== null || goal.getSnapshot().saving;
    const confirmed = saved && !busy;
    if (
      snapshot.draft === draft &&
      snapshot.error === error &&
      snapshot.busy === busy &&
      snapshot.saved === confirmed
    )
      return;
    snapshot = { draft, error, busy, saved: confirmed };
    notifying++;
    try {
      for (const listener of listeners) listener();
    } finally {
      notifying--;
    }
  }
  function idle() {
    return active && !pending && !goal.getSnapshot().saving;
  }
  async function complete(ticket: NonNullable<typeof pending>, write: Promise<boolean>) {
    const success = await write;
    if (pending === ticket) pending = null;
    if (!active || ticket.generation !== generation) {
      publish();
      return false;
    }
    if (success) {
      dirty = false;
      saved = true;
    } else error = goal.getSnapshot().error ?? "Couldn't save your water goal. Try again.";
    publish();
    return success;
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
      unsubscribe = goal.subscribe(publish);
      publish();
    },
    stop() {
      if (!active) return;
      active = false;
      // A detached editor keeps its draft, but its durable write can no longer report back.
      ++generation;
      pending = null;
      unsubscribe?.();
      unsubscribe = null;
      publish();
    },
    change(text: string) {
      if (!idle()) return false;
      draft = text;
      dirty = true;
      error = null;
      saved = false;
      publish();
      return true;
    },
    /** Discards the entered amount so the draft follows the saved goal again. */
    cancel() {
      if (!idle()) return false;
      ++generation;
      dirty = false;
      error = null;
      saved = false;
      publish();
      return true;
    },
    save(): Promise<boolean> {
      if (!idle() || notifying || goal.getSnapshot().state.kind !== "ready")
        return Promise.resolve(false);
      saved = false;
      const ml = waterGoalFromText(draft);
      if (ml === null) {
        error = waterGoalRangeMessage;
        publish();
        return Promise.resolve(false);
      }
      error = null;
      const ticket = { generation };
      pending = ticket;
      // Reserve persistence before observers can submit a competing goal write.
      const write = goal.setGoal(ml);
      publish();
      return complete(ticket, write);
    },
  };
}

import type { createProfilePersistence } from "./persistence.ts";
import { validateWeightDate, weightFromInput, type WeightEntry } from "./weight-model.ts";

type WeightDraft = Readonly<{ date: string; weight: string; previousDate?: string }>;
type FieldErrors = Readonly<{ date?: string; weight?: string }>;
type Attempt =
  | Readonly<{ kind: "edit"; draft: WeightDraft; fields: FieldErrors; error: string | null }>
  | Readonly<{ kind: "delete"; entry: Readonly<WeightEntry>; error: string | null }>;
type WeightEditSnapshot = Readonly<{
  attempt: Attempt | null;
  busy: boolean;
  replacing: boolean;
}>;

export function createWeightEdit(profile: ReturnType<typeof createProfilePersistence>) {
  let active = false;
  let generation = 0;
  let attempt: Attempt | null = null;
  let pending: { generation: number; attempt: Attempt } | null = null;
  let unsubscribe: (() => void) | null = null;
  let notifying = 0;
  const listeners = new Set<() => void>();
  let snapshot: WeightEditSnapshot = {
    attempt,
    busy: profile.getSnapshot().saving,
    replacing: false,
  };

  function publish() {
    const saved = profile.getSnapshot();
    const busy = pending !== null || saved.saving;
    const draft = attempt?.kind === "edit" ? attempt.draft : null;
    const replacing =
      draft !== null &&
      saved.state.kind === "ready" &&
      (saved.state.document.weightEntries ?? []).some(
        (entry) => entry.date === draft.date && entry.date !== draft.previousDate,
      );
    if (snapshot.attempt === attempt && snapshot.busy === busy && snapshot.replacing === replacing)
      return;
    snapshot = { attempt, busy, replacing };
    notifying++;
    try {
      for (const listener of listeners) listener();
    } finally {
      notifying--;
    }
  }
  function available() {
    const saved = profile.getSnapshot();
    return (
      active && !pending && !saved.saving && !saved.refreshError && saved.state.kind === "ready"
    );
  }
  function dismiss() {
    ++generation;
    attempt = null;
    publish();
  }
  async function complete(ticket: NonNullable<typeof pending>, write: Promise<boolean>) {
    const success = await write;
    if (pending === ticket) pending = null;
    if (!active || ticket.generation !== generation || ticket.attempt !== attempt) {
      publish();
      return false;
    }
    if (success) dismiss();
    else {
      attempt = {
        ...attempt,
        error:
          profile.getSnapshot().error ??
          (attempt.kind === "edit"
            ? "Couldn't save this measurement. Your values are still here. Try again."
            : "Couldn't delete this measurement. Your history hasn't changed. Try again."),
      };
      publish();
    }
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
      unsubscribe = profile.subscribe(publish);
      publish();
    },
    stop() {
      if (!active) return;
      active = false;
      unsubscribe?.();
      unsubscribe = null;
      // Leaving the journal discards its editor; its durable write can still finish.
      dismiss();
    },
    begin(date: string, entry?: WeightEntry) {
      if (!available()) return false;
      ++generation;
      attempt = {
        kind: "edit",
        draft: entry
          ? { date: entry.date, weight: String(entry.kg), previousDate: entry.date }
          : { date, weight: "" },
        fields: {},
        error: null,
      };
      publish();
      return true;
    },
    beginDelete(entry: WeightEntry) {
      if (!available()) return false;
      ++generation;
      attempt = { kind: "delete", entry: { ...entry }, error: null };
      publish();
      return true;
    },
    change(field: "date" | "weight", value: string) {
      if (!active || pending || profile.getSnapshot().saving || attempt?.kind !== "edit")
        return false;
      attempt = {
        ...attempt,
        draft: { ...attempt.draft, [field]: value },
        fields: { ...attempt.fields, [field]: undefined },
        error: null,
      };
      publish();
      return true;
    },
    cancel() {
      if (!active || !attempt || pending || profile.getSnapshot().saving) return false;
      dismiss();
      return true;
    },
    save(): Promise<boolean> {
      if (!available() || notifying || attempt?.kind !== "edit") return Promise.resolve(false);
      const fields: { date?: string; weight?: string } = {};
      let kg = 0;
      try {
        kg = weightFromInput(attempt.draft.weight);
      } catch (error) {
        fields.weight = (error as Error).message;
      }
      try {
        validateWeightDate(attempt.draft.date);
      } catch (error) {
        fields.date = (error as Error).message;
      }
      attempt = { ...attempt, fields, error: null };
      if (Object.keys(fields).length) {
        publish();
        return Promise.resolve(false);
      }
      const input = { date: attempt.draft.date, kg, previousDate: attempt.draft.previousDate };
      const ticket = { generation, attempt };
      pending = ticket;
      // Reserve persistence before observers can submit a competing Profile write.
      const write = profile.saveWeight(input);
      publish();
      return complete(ticket, write);
    },
    remove(): Promise<boolean> {
      if (!available() || notifying || attempt?.kind !== "delete") return Promise.resolve(false);
      attempt = { ...attempt, error: null };
      const date = attempt.entry.date;
      const ticket = { generation, attempt };
      pending = ticket;
      const write = profile.removeWeight(date);
      publish();
      return complete(ticket, write);
    },
  };
}

import type { ProfileDocument } from "./model.ts";
import {
  cmFromInput,
  measurements,
  type Measurement,
  type MeasurementEntry,
} from "./measurement-model.ts";
import type { createProfilePersistence } from "./persistence.ts";
import { validateWeightDate, weightFromInput, type WeightEntry } from "./weight-model.ts";
import type { UnitSystem } from "../units/units.ts";

type Profile = ReturnType<typeof createProfilePersistence>;
type Draft<F extends string> = Record<F, string> & { date: string; previousDate?: string };
type FieldErrors<F extends string> = { [K in F]?: string } & { date?: string };
type Attempt<F extends string, E> =
  | Readonly<{
      kind: "edit";
      draft: Draft<F>;
      fields: FieldErrors<F>;
      error: string | null;
    }>
  | Readonly<{ kind: "delete"; entry: Readonly<E>; error: string | null }>;
type DatedEditSnapshot<F extends string, E> = Readonly<{
  attempt: Attempt<F, E> | null;
  busy: boolean;
  replacing: boolean;
}>;
/** One dated history in the Profile document, with at most one entry per date. */
type DatedHistory<F extends string, E extends { date: string }> = {
  entries(document: ProfileDocument): readonly E[] | undefined;
  /** An entry's values as field text, or blank fields for a new entry. */
  draft(entry?: E): Record<F, string>;
  /** Puts each invalid value's message in `fields` and returns the save to start. */
  read(draft: Draft<F>, fields: FieldErrors<F>): () => Promise<boolean>;
  remove(date: string): Promise<boolean>;
};

/** Drafts hold saved kilogram and centimeter text; `units` words their messages. */
export function createWeightEdit(profile: Profile, units: UnitSystem = "metric") {
  return createDatedEdit<"weight", WeightEntry>(profile, {
    entries: (document) => document.weightEntries,
    draft: (entry) => ({ weight: entry ? String(entry.kg) : "" }),
    read(draft, fields) {
      let kg = 0;
      try {
        kg = weightFromInput(draft.weight, units);
      } catch (error) {
        fields.weight = (error as Error).message;
      }
      return () => profile.saveWeight({ date: draft.date, kg, previousDate: draft.previousDate });
    },
    remove: (date) => profile.removeWeight(date),
  });
}

export function createMeasurementEdit(profile: Profile, units: UnitSystem = "metric") {
  return createDatedEdit<Measurement, MeasurementEntry>(profile, {
    entries: (document) => document.bodyMeasurements,
    draft: (entry) =>
      Object.fromEntries(
        measurements.map((name) => [name, entry?.cm[name]?.toString() ?? ""]),
      ) as Record<Measurement, string>,
    read(draft, fields) {
      const cm: MeasurementEntry["cm"] = {};
      for (const name of measurements) {
        // Blank means not measured; the model asks for at least one value.
        if (!draft[name].trim()) continue;
        try {
          cm[name] = cmFromInput(draft[name], units);
        } catch (error) {
          fields[name] = (error as Error).message;
        }
      }
      return () =>
        profile.saveMeasurement({ date: draft.date, cm, previousDate: draft.previousDate });
    },
    remove: (date) => profile.removeMeasurement(date),
  });
}

function createDatedEdit<F extends string, E extends { date: string }>(
  profile: Profile,
  history: DatedHistory<F, E>,
) {
  let active = false;
  let generation = 0;
  let attempt: Attempt<F, E> | null = null;
  let pending: { generation: number; attempt: Attempt<F, E> } | null = null;
  let unsubscribe: (() => void) | null = null;
  let notifying = 0;
  const listeners = new Set<() => void>();
  let snapshot: DatedEditSnapshot<F, E> = {
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
      (history.entries(saved.state.document) ?? []).some(
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
    begin(date: string, entry?: E) {
      if (!available()) return false;
      ++generation;
      attempt = {
        kind: "edit",
        draft: entry
          ? { ...history.draft(entry), date: entry.date, previousDate: entry.date }
          : { ...history.draft(), date },
        fields: {},
        error: null,
      };
      publish();
      return true;
    },
    beginDelete(entry: E) {
      if (!available()) return false;
      ++generation;
      attempt = { kind: "delete", entry: { ...entry }, error: null };
      publish();
      return true;
    },
    change(field: "date" | F, value: string) {
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
      const fields: FieldErrors<F> = {};
      const write = history.read(attempt.draft, fields);
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
      const ticket = { generation, attempt };
      pending = ticket;
      // Reserve persistence before observers can submit a competing Profile write.
      const saving = write();
      publish();
      return complete(ticket, saving);
    },
    remove(): Promise<boolean> {
      if (!available() || notifying || attempt?.kind !== "delete") return Promise.resolve(false);
      attempt = { ...attempt, error: null };
      const date = attempt.entry.date;
      const ticket = { generation, attempt };
      pending = ticket;
      const write = history.remove(date);
      publish();
      return complete(ticket, write);
    },
  };
}

import type { WorkoutImportResult } from "./mapping.ts";
import { WorkoutImportError, type ImportedWorkoutPlan } from "./plan.ts";

export type WorkoutImportFlowSource = {
  id: string;
  load(text: string, signal: AbortSignal): Promise<ImportedWorkoutPlan>;
};
export type WorkoutImportState =
  | { step: "sources" }
  | { step: "link"; source: string; text: string; loading: boolean; error: string | null }
  | {
      step: "preview";
      source: string;
      text: string;
      plan: ImportedWorkoutPlan;
      saving: boolean;
      error: string | null;
    }
  | { step: "done"; source: string; result: WorkoutImportResult };

const loadFailure = "Couldn't get this workout. Try again.";
const saveFailure = "Couldn't import this workout. Your library hasn't changed. Try again.";

// One owner for the import journey. Tickets keep a cancelled or replaced download,
// or a save that finishes after the panel closed, from changing the current step.
export function createWorkoutImportFlow({
  sources,
  initialSource,
  importPlan,
}: {
  sources: readonly WorkoutImportFlowSource[];
  initialSource?: string;
  importPlan: (plan: ImportedWorkoutPlan) => Promise<WorkoutImportResult | null>;
}) {
  const listeners = new Set<() => void>();
  let state: WorkoutImportState = sources.some((source) => source.id === initialSource)
    ? { step: "link", source: initialSource!, text: "", loading: false, error: null }
    : { step: "sources" };
  let ticket = 0,
    active = true,
    download: AbortController | null = null;
  function publish(next: WorkoutImportState) {
    state = next;
    for (const listener of listeners) listener();
  }
  function abort() {
    ++ticket;
    download?.abort();
    download = null;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      active = true;
    },
    stop() {
      active = false;
      abort();
    },
    choose(id: string) {
      if (state.step !== "sources" || !sources.some((source) => source.id === id)) return;
      publish({ step: "link", source: id, text: "", loading: false, error: null });
    },
    setText(text: string) {
      if (state.step !== "link" || state.loading) return;
      publish({ ...state, text, error: null });
    },
    async load() {
      if (!active || state.step !== "link" || state.loading) return;
      const current = state;
      const source = sources.find((item) => item.id === current.source)!;
      abort();
      const own = ++ticket,
        controller = new AbortController();
      download = controller;
      publish({ ...current, loading: true, error: null });
      try {
        const plan = await source.load(current.text, controller.signal);
        if (own !== ticket || !active) return;
        download = null;
        publish({
          step: "preview",
          source: current.source,
          text: current.text,
          plan,
          saving: false,
          error: null,
        });
      } catch (error) {
        if (own !== ticket || !active) return;
        download = null;
        publish({
          ...current,
          loading: false,
          error:
            error instanceof WorkoutImportError
              ? error.kind === "cancelled"
                ? null
                : error.message
              : loadFailure,
        });
      }
    },
    cancel() {
      if (state.step !== "link" || !state.loading) return;
      abort();
      publish({ ...state, loading: false, error: null });
    },
    async confirm() {
      if (!active || state.step !== "preview" || state.saving) return;
      const current = state,
        own = ++ticket;
      publish({ ...current, saving: true, error: null });
      let result: WorkoutImportResult | null = null;
      try {
        result = await importPlan(current.plan);
      } catch {
        result = null;
      }
      if (own !== ticket || !active) return;
      publish(
        result
          ? { step: "done", source: current.source, result }
          : { ...current, saving: false, error: saveFailure },
      );
    },
    back() {
      if (state.step === "preview" && !state.saving)
        publish({
          step: "link",
          source: state.source,
          text: state.text,
          loading: false,
          error: null,
        });
      else if (state.step === "link") {
        abort();
        publish({ step: "sources" });
      }
    },
  };
}

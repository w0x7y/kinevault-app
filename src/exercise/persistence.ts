import {
  createDurableWrite,
  type DurableSnapshot,
  type DurableStorage,
} from "../persistence/durable-write.ts";
import { parseExerciseDocument, type ExerciseDocument } from "./model.ts";
import {
  createExerciseCommands,
  seedDevelopmentExamples,
  type ExerciseChange,
  type SaveExerciseInput,
  type SaveWorkoutInput,
  type PlanWorkoutInput,
  type UpdateSessionInput,
  type CompleteSessionInput,
} from "./commands.ts";
import type { ImportedWorkoutPlan } from "./import/plan.ts";

export const exerciseStorageKey = "kinevault-track.exercise.v1";
export type ExerciseSnapshot = DurableSnapshot<ExerciseDocument>;
/**
 * A write's outcome: saved with its value, rejected by its command with the reason, or not written
 * because storage failed, a refresh blocked it or the document isn't loaded.
 */
export type ExerciseWrite<Value> =
  { kind: "saved"; value: Value } | { kind: "rejected"; reason: string } | { kind: "unavailable" };
const unavailable = { kind: "unavailable" } as const;
/** Feedback for a failed write: its lead, then the command's reason or, when nothing was written, a retry. */
export function writeFailure(result: ExerciseWrite<unknown>, lead: string, retry: string) {
  return `${lead} ${result.kind === "rejected" ? result.reason : retry}`;
}

function copyInput<Value>(value: Value): Value {
  if (Array.isArray(value)) return value.map((item) => copyInput(item)) as Value;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, copyInput(item)]),
    ) as Value;
  }
  return value;
}

export function createExercisePersistence({
  storage,
  createId,
  now,
  development = false,
}: {
  storage: DurableStorage;
  createId: () => string;
  now: () => number;
  development?: boolean;
}) {
  const durable = createDurableWrite({
    storage,
    key: exerciseStorageKey,
    parse: parseExerciseDocument,
  });
  const commands = createExerciseCommands({ createId, now });
  let active = false,
    lifecycle = 0;
  let tail: Promise<unknown> = Promise.resolve();

  function enqueue<Value>(
    run: () => Promise<ExerciseWrite<Value>> | ExerciseWrite<Value>,
  ): Promise<ExerciseWrite<Value>> {
    if (!active || durable.getSnapshot().state.kind !== "ready")
      return Promise.resolve(unavailable);
    const ticket = lifecycle;
    const result = tail.then(() => (!active || ticket !== lifecycle ? unavailable : run()));
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  // The durable write reports only that nothing was saved; a command's reason is caught here.
  async function commit<Value>(
    build: (document: ExerciseDocument) => ExerciseChange<Value>,
  ): Promise<ExerciseWrite<Value>> {
    let reason: string | null = null;
    const value = await durable.update((document) => {
      try {
        return build(document);
      } catch (error) {
        reason = error instanceof Error ? error.message : "Check your workout values.";
        if (!/[.?!]$/.test(reason)) reason += ".";
        return { error: reason };
      }
    }, "Couldn't save your exercise changes. Your values are still here. Try again.");
    if (value !== null) return { kind: "saved", value };
    return reason === null ? unavailable : { kind: "rejected", reason };
  }
  function queue<Value>(
    build: (document: ExerciseDocument) => ExerciseChange<Value>,
  ): Promise<ExerciseWrite<Value>> {
    return enqueue(() => commit(build));
  }
  function capture<Input, Value>(
    input: Input,
    build: (document: ExerciseDocument, input: Input) => ExerciseChange<Value>,
    sessionId?: string,
  ): Promise<ExerciseWrite<Value>> {
    // Capture input and the lifecycle state before waiting behind another write.
    // This prevents caller mutation and old draft commands replacing completion.
    let captured: Input;
    try {
      captured = copyInput(input);
    } catch {
      return Promise.resolve({ kind: "rejected", reason: "Check your workout values." });
    }
    const state = durable.getSnapshot().state;
    const expectedStatus =
      sessionId !== undefined && state.kind === "ready"
        ? state.document.sessions.find((session) => session.id === sessionId)?.status
        : undefined;
    return queue((document) => {
      if (
        sessionId !== undefined &&
        document.sessions.find((session) => session.id === sessionId)?.status !== expectedStatus
      )
        throw new Error("This workout changed. Reopen it to continue editing.");
      return build(document, captured);
    });
  }
  return {
    getSnapshot: durable.getSnapshot,
    subscribe: durable.subscribe,
    retryLoad: durable.retryLoad,
    start() {
      if (active) return;
      active = true;
      ++lifecycle;
      durable.start();
    },
    stop() {
      active = false;
      ++lifecycle;
      durable.stop();
    },
    async seedDevelopmentExamples(): Promise<boolean> {
      if (!development) return false;
      const result = await enqueue(() => {
        const state = durable.getSnapshot().state;
        if (state.kind !== "ready") return unavailable;
        return state.document.developmentExamplesSeeded === true
          ? { kind: "saved", value: true }
          : commit(seedDevelopmentExamples);
      });
      return result.kind === "saved";
    },
    saveExercise: (input: SaveExerciseInput) => capture(input, commands.saveExercise),
    removeExercise: (id: string) => queue((document) => commands.removeExercise(document, id)),
    saveWorkout: (input: SaveWorkoutInput) => capture(input, commands.saveWorkout),
    removeWorkout: (id: string) => queue((document) => commands.removeWorkout(document, id)),
    planWorkout: (input: PlanWorkoutInput) => capture(input, commands.planWorkout),
    updateSession: (input: UpdateSessionInput) => capture(input, commands.updateSession, input.id),
    startSession: (id: string) => queue((document) => commands.startSession(document, id)),
    completeSession: (input: CompleteSessionInput) =>
      capture(input, commands.completeSession, input.id),
    removeSession: (id: string) => queue((document) => commands.removeSession(document, id)),
    // The plan maps against the latest saved library when its turn in the queue arrives.
    importWorkoutPlan: (plan: ImportedWorkoutPlan) => capture(plan, commands.importWorkoutPlan),
  };
}

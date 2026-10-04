import { createDurableWrite, type DurableSnapshot, type DurableStorage } from "../persistence/durable-write.ts";
import { parseExerciseDocument, type ExerciseDocument } from "./model.ts";
import { createExerciseCommands, seedDevelopmentExamples, type ExerciseChange, type SaveExerciseInput, type SaveWorkoutInput, type PlanWorkoutInput,
  type UpdateSessionInput, type CompleteSessionInput } from "./commands.ts";

export const exerciseStorageKey = "kinevault-track.exercise.v1";
export type ExerciseSnapshot = DurableSnapshot<ExerciseDocument>;

function copyInput<Value>(value: Value): Value {
  if (Array.isArray(value)) return value.map(item => copyInput(item)) as Value;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyInput(item)])) as Value;
  }
  return value;
}

export function createExercisePersistence({ storage, createId, now, development = false }: { storage: DurableStorage; createId: () => string; now: () => number; development?: boolean }) {
  const durable = createDurableWrite({ storage, key: exerciseStorageKey, parse: parseExerciseDocument });
  const commands = createExerciseCommands({ createId, now });
  let active = false, lifecycle = 0;
  let tail: Promise<unknown> = Promise.resolve();

  function enqueue<Value>(run: () => Promise<Value | null> | Value | null): Promise<Value | null> {
    if (!active || durable.getSnapshot().state.kind !== "ready") return Promise.resolve(null);
    const ticket = lifecycle;
    const result = tail.then(() => !active || ticket !== lifecycle ? null : run());
    tail = result.then(() => undefined, () => undefined);
    return result;
  }
  function commit<Value>(build: (document: ExerciseDocument) => ExerciseChange<Value>): Promise<Value | null> {
    return durable.update(document => {
      try { return build(document); }
      catch (error) { return { error: error instanceof Error ? error.message : "Check your workout values." }; }
    }, "Couldn't save your exercise changes. Your values are still here. Try again.");
  }
  function queue<Value>(build: (document: ExerciseDocument) => ExerciseChange<Value>): Promise<Value | null> {
    return enqueue(() => commit(build));
  }
  function capture<Input, Value>(input: Input, build: (document: ExerciseDocument, input: Input) => ExerciseChange<Value>, sessionId?: string): Promise<Value | null> {
    // Capture input and the lifecycle state before waiting behind another write.
    // This prevents caller mutation and old draft commands replacing completion.
    let captured: Input;
    try { captured = copyInput(input); } catch { return Promise.resolve(null); }
    const state = durable.getSnapshot().state;
    const expectedStatus = sessionId !== undefined && state.kind === "ready" ? state.document.sessions.find(session => session.id === sessionId)?.status : undefined;
    return queue(document => {
      if (sessionId !== undefined && document.sessions.find(session => session.id === sessionId)?.status !== expectedStatus) throw new Error("This workout changed. Reopen it to continue editing.");
      return build(document, captured);
    });
  }
  return {
    getSnapshot: durable.getSnapshot,
    subscribe: durable.subscribe,
    retryLoad: durable.retryLoad,
    start() { if (active) return; active = true; ++lifecycle; durable.start(); },
    stop() { active = false; ++lifecycle; durable.stop(); },
    async seedDevelopmentExamples(): Promise<boolean> {
      if (!development) return false;
      return await enqueue(() => {
        const state = durable.getSnapshot().state;
        if (state.kind !== "ready") return null;
        return state.document.developmentExamplesSeeded === true ? true : commit(seedDevelopmentExamples);
      }) === true;
    },
    saveExercise: (input: SaveExerciseInput) => capture(input, commands.saveExercise),
    async removeExercise(id: string): Promise<boolean> { return await queue(document => commands.removeExercise(document, id)) === true; },
    saveWorkout: (input: SaveWorkoutInput) => capture(input, commands.saveWorkout),
    async removeWorkout(id: string): Promise<boolean> { return await queue(document => commands.removeWorkout(document, id)) === true; },
    planWorkout: (input: PlanWorkoutInput) => capture(input, commands.planWorkout),
    async updateSession(input: UpdateSessionInput): Promise<boolean> { return await capture(input, commands.updateSession, input.id) === true; },
    async startSession(id: string): Promise<boolean> { return await queue(document => commands.startSession(document, id)) === true; },
    async completeSession(input: CompleteSessionInput): Promise<boolean> { return await capture(input, commands.completeSession, input.id) === true; },
    async removeSession(id: string): Promise<boolean> { return await queue(document => commands.removeSession(document, id)) === true; },
  };
}

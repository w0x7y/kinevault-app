import type { SessionExercise, WorkoutSession } from "./model.ts";

export type SessionDraft = { name: string; exercises: SessionExercise[]; minutes: string };

// Completed edits stay local across panel changes until explicit save or cancel.
export function createCompletedSessionDrafts() {
  const drafts = new Map<string, SessionDraft>();
  return {
    open(session: WorkoutSession): SessionDraft {
      return drafts.get(session.id) ?? { name: session.name, exercises: session.exercises,
        minutes: session.durationSeconds === null ? "" : String(session.durationSeconds / 60) };
    },
    write(id: string, draft: SessionDraft) { drafts.set(id, draft); },
    discard(id: string) { drafts.delete(id); },
    prune(sessionIds: readonly string[]) {
      const available = new Set(sessionIds);
      for (const id of drafts.keys()) if (!available.has(id)) drafts.delete(id);
    },
  };
}
export type CompletedSessionDrafts = ReturnType<typeof createCompletedSessionDrafts>;

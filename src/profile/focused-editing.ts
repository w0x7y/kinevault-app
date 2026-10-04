import type { Answers, FieldErrors } from "./answers.ts";
import { changeAnswers, validateAnswers, type AnswerChange } from "./calories.ts";
import type { createProfilePersistence } from "./persistence.ts";
import { editedProfileAnswers, type ProfileEditSection } from "./section-editing.ts";

type Attempt = Readonly<{
  section: ProfileEditSection;
  draft: Answers;
  errors: FieldErrors;
  error: string | null;
}>;
export type FocusedProfileEditSnapshot = Readonly<{
  attempt: Attempt | null;
  busy: boolean;
}>;

// A focused attempt owns the draft and its completion. Persistence continues to
// own the durable write; detaching an editor never cancels an accepted write.
export function createFocusedProfileEdit(
  profile: ReturnType<typeof createProfilePersistence>,
  options: {
    initial?: { section: ProfileEditSection; answers: Answers };
    onClose?: () => void;
  } = {},
) {
  let attempt: Attempt | null = options.initial
    ? { section: options.initial.section, draft: { ...options.initial.answers }, errors: {}, error: null }
    : null;
  let active = false;
  let generation = 0;
  let pending: { generation: number; attempt: Attempt } | null = null;
  let unsubscribe: (() => void) | null = null;
  let notifying = 0;
  const listeners = new Set<() => void>();
  let snapshot: FocusedProfileEditSnapshot = { attempt, busy: profile.getSnapshot().saving };

  function publish() {
    const busy = pending !== null || profile.getSnapshot().saving;
    if (snapshot.attempt === attempt && snapshot.busy === busy) return;
    snapshot = { attempt, busy };
    notifying++;
    try { for (const listener of listeners) listener(); }
    finally { notifying--; }
  }
  function current(ticket: { generation: number; attempt: Attempt }) {
    return active && generation === ticket.generation && attempt === ticket.attempt;
  }
  function dismiss() {
    const dismissed = ++generation;
    attempt = null;
    publish();
    // Publication can open a replacement attempt. Its UI must stay open.
    if (active && generation === dismissed && attempt === null) options.onClose?.();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
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
      ++generation;
      pending = null;
      unsubscribe?.();
      unsubscribe = null;
      publish();
    },
    begin(section: ProfileEditSection) {
      const saved = profile.getSnapshot();
      if (!active || pending || saved.state.kind !== "ready") return false;
      ++generation;
      attempt = { section, draft: { ...saved.state.document.answers }, errors: {}, error: null };
      publish();
      return true;
    },
    change(change: AnswerChange) {
      if (!active || !attempt || pending || profile.getSnapshot().saving) return false;
      attempt = { ...attempt, draft: changeAnswers(attempt.draft, change), errors: {}, error: null };
      publish();
      return true;
    },
    cancel() {
      if (!active || !attempt || pending || profile.getSnapshot().saving) return false;
      dismiss();
      return true;
    },
    async save(): Promise<boolean> {
      const saved = profile.getSnapshot();
      if (!active || !attempt || pending || notifying || saved.saving || saved.state.kind !== "ready") return false;
      const ticket = { generation, attempt };
      pending = ticket;
      const answers = editedProfileAnswers(saved.state.document.answers, attempt.draft, attempt.section);
      const errors = validateAnswers(answers);
      if (Object.keys(errors).length) {
        pending = null;
        attempt = { ...attempt, errors, error: null };
        publish();
        return false;
      }
      attempt = { ...attempt, errors: {}, error: null };
      ticket.attempt = attempt;
      // Reserve the durable write before notifying edit observers. They may
      // synchronously try another edit or a competing persistence command.
      const write = profile.save({ version: 1, kind: "complete", answers });
      publish();
      const success = await write;
      if (!current(ticket)) return false;
      pending = null;
      if (success) dismiss();
      else {
        attempt = { ...attempt!, error: profile.getSnapshot().error || "Couldn't save your answers. Try again." };
        publish();
      }
      return success;
    },
  };
}

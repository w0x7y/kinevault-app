import { createDocumentEdit, type ParsedDraft } from "../persistence/document-edit.ts";
import { emptyAnswers, stepFields, type Answers, type FieldErrors } from "./answers.ts";
import { changeAnswers, validateAnswers, type AnswerChange } from "./calories.ts";
import type { createProfilePersistence } from "./persistence.ts";
import { editedProfileAnswers, type ProfileEditSection } from "./section-editing.ts";

// A focused Profile edit changes one section. Its draft copies the saved answers
// once; Save merges only that section's fields into the latest saved Profile and
// validates the whole result, so newer changes to other fields survive. Field
// problems are reported as FieldErrors, a failed save as a message.
export function createFocusedProfileEdit(
  profile: ReturnType<typeof createProfilePersistence>,
  section: ProfileEditSection,
) {
  const edit = createDocumentEdit({
    document: profile,
    draft: emptyAnswers,
    seed: (document) => ({ ...document.answers }),
    parse(draft, latest): ParsedDraft<Answers, FieldErrors> {
      const answers = editedProfileAnswers(latest.answers, draft, section);
      const errors = validateAnswers(answers);
      return Object.keys(errors).length ? { error: errors } : { value: answers };
    },
    write: (answers) => profile.save({ version: 1, kind: "complete", answers }),
    failure: "Couldn't save your answers. Try again.",
  });
  return {
    ...edit,
    change: (change: AnswerChange) => edit.change(changeAnswers(edit.getSnapshot().draft, change)),
  };
}

/**
 * Splits a focused edit's feedback: errors on the section's own fields (its Question shows
 * them), messages for the fields it doesn't own, and the save failure message.
 */
export function focusedEditFeedback(
  error: FieldErrors | string | null,
  section: ProfileEditSection,
): { errors: FieldErrors; others: string[]; message: string | null } {
  if (typeof error === "string") return { errors: {}, others: [], message: error };
  const errors: FieldErrors = {};
  const others: string[] = [];
  for (const [field, message] of Object.entries(error ?? {}) as [keyof Answers, string][]) {
    if (stepFields[section].includes(field)) errors[field] = message;
    else others.push(message);
  }
  return { errors, others, message: null };
}

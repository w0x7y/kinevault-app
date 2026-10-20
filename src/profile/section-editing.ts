import { stepFields, type Answers, type EditableStep } from "./answers.ts";
import { calorieState, changeAnswers, type AnswerChange } from "./calories.ts";
export type ProfileEditSection = EditableStep;

// A section draft is a patch, never a replacement for the latest saved record.
export function editedProfileAnswers(
  current: Answers,
  draft: Answers,
  section: ProfileEditSection,
): Answers {
  if (section === "body") {
    // Body also chooses the estimate, whose policy decides whether the formula's sex is kept.
    const policy = changeAnswers(current, {
      kind: "estimate",
      enabled: draft.estimateEnabled,
    });
    return changeAnswers(policy, {
      kind: "fields",
      patch: {
        height: draft.height,
        weight: draft.weight,
        sex: calorieState(policy).kind === "estimate" ? draft.sex : null,
      },
    });
  }
  const patch = Object.fromEntries(stepFields[section].map((field) => [field, draft[field]]));
  return changeAnswers(current, {
    kind: "fields",
    patch: patch as Extract<AnswerChange, { kind: "fields" }>["patch"],
  });
}

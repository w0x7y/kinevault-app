import type { Answers } from "./answers.ts";
import { calorieState, changeAnswers } from "./calories.ts";
export type ProfileEditSection = "name" | "age" | "body" | "goal" | "activity" | "calories";

// A section draft is a patch, never a replacement for the latest saved record.
export function editedProfileAnswers(
  current: Answers,
  draft: Answers,
  section: ProfileEditSection,
): Answers {
  switch (section) {
    case "name":
      return changeAnswers(current, {
        kind: "fields",
        patch: { name: draft.name },
      });
    case "age":
      return changeAnswers(current, {
        kind: "fields",
        patch: { age: draft.age },
      });
    case "goal":
      return changeAnswers(current, {
        kind: "fields",
        patch: { goal: draft.goal },
      });
    case "activity":
      return changeAnswers(current, {
        kind: "fields",
        patch: { activity: draft.activity },
      });
    case "calories":
      return changeAnswers(current, {
        kind: "fields",
        patch: {
          customCalories: draft.customCalories,
          customCarbs: draft.customCarbs,
          customProtein: draft.customProtein,
          customFat: draft.customFat,
        },
      });
    case "body": {
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
  }
}

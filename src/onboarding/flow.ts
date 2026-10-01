import {
  emptyAnswers,
  steps,
  type Answers,
  type EditableStep,
  type FieldErrors,
  type Step,
} from "../profile/answers.ts";
import {
  changeAnswers,
  validateAnswers,
  type AnswerChange,
} from "../profile/calories.ts";
import type { ProfileDocument } from "../profile/model.ts";

type Action =
  | { kind: "next" | "back" | "skip" | "cancel" }
  | { kind: "edit"; step: EditableStep };
type Effects = {
  save: (document: ProfileDocument) => Promise<boolean>;
  exit: (destination: "today" | "settings") => void;
};
type Snapshot = {
  answers: Answers;
  step: Step;
  editing: boolean;
  errors: FieldErrors;
  direction: number;
  saving: boolean;
  error: string | null;
  primaryLabel: string;
  showBack: boolean;
  showSkip: boolean;
};
const fieldsByStep: Record<Step, (keyof Answers)[]> = {
  welcome: [],
  age: ["age"],
  name: ["name"],
  goal: ["goal"],
  body: ["height", "weight", "sex", "eligible"],
  activity: ["activity"],
  calories: ["customCalories", "customCarbs", "customProtein", "customFat"],
  review: [
    "name",
    "goal",
    "age",
    "height",
    "weight",
    "sex",
    "eligible",
    "activity",
    "customCalories",
    "customCarbs",
    "customProtein",
    "customFat",
  ],
};

// Callers submit intentions. This module owns validation, staged edits, and save ordering.
export function createOnboardingFlow(
  initial: ProfileDocument,
  effects: Effects,
) {
  const editing = initial.kind === "complete";
  let returnToReview = false;
  let acting = false;
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = present({
    answers: { ...initial.answers },
    step: initial.kind === "draft" ? initial.step : "goal",
    editing,
    errors: {},
    direction: 1,
    saving: false,
    error: null,
  });

  function present(
    state: Omit<Snapshot, "primaryLabel" | "showBack" | "showSkip">,
  ): Snapshot {
    const welcome = state.step === "welcome";
    return {
      ...state,
      primaryLabel: state.saving
        ? "Saving…"
        : welcome
          ? "Let's go"
          : state.step === "review"
            ? editing
              ? "Save changes"
              : "Finish setup"
            : returnToReview
              ? "Back to review"
              : "Continue",
      showBack: !welcome && !(editing && state.step === "goal"),
      showSkip: !editing && state.step === "age",
    };
  }
  function publish(patch: Partial<Snapshot>) {
    snapshot = present({ ...snapshot, ...patch });
    for (const listener of listeners) listener();
  }
  async function persist(document: ProfileDocument) {
    publish({ saving: true, error: null });
    try {
      if (await effects.save(document)) return true;
    } catch {
      // The same retry behavior applies to thrown errors and rejected writes.
    }
    publish({ error: "Couldn't save your answers. Try again." });
    return false;
  }
  async function goTo(next: Step, reviewEdit = false) {
    if (
      !editing &&
      !(await persist({
        version: 1,
        kind: "draft",
        step: next,
        answers: snapshot.answers,
      }))
    )
      return;
    const direction =
      steps.indexOf(next) >= steps.indexOf(snapshot.step) ? 1 : -1;
    returnToReview = reviewEdit;
    publish({ step: next, direction, errors: {} });
  }
  function relevantErrors(action: "next" | "skip") {
    const all = validateAnswers(snapshot.answers);
    const errors: FieldErrors = {};
    for (const field of action === "skip"
      ? (["age"] as const)
      : fieldsByStep[snapshot.step])
      if (all[field]) errors[field] = all[field];
    publish({ errors });
    return Object.keys(errors).length > 0;
  }
  async function complete(answers: Answers) {
    if (await persist({ version: 1, kind: "complete", answers })) {
      publish({ answers });
      effects.exit(editing ? "settings" : "today");
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(change: AnswerChange) {
      if (!acting)
        publish({
          answers: changeAnswers(snapshot.answers, change),
          errors: {},
        });
    },
    async act(action: Action) {
      if (acting) return;
      acting = true;
      try {
        switch (action.kind) {
          case "cancel":
            if (editing) effects.exit("settings");
            return;
          case "edit":
            if (snapshot.step === "review") await goTo(action.step, true);
            return;
          case "skip":
            if (!snapshot.showSkip || relevantErrors("skip")) return;
            await complete({
              ...emptyAnswers,
              age: snapshot.answers.age,
              estimateEnabled: false,
            });
            return;
          case "next": {
            if (relevantErrors("next")) return;
            if (snapshot.step === "review") {
              await complete({
                ...snapshot.answers,
                name: snapshot.answers.name.trim(),
              });
            } else {
              const next = returnToReview
                ? "review"
                : steps[steps.indexOf(snapshot.step) + 1];
              if (next) await goTo(next);
            }
            return;
          }
          case "back": {
            if (returnToReview) await goTo("review");
            else if (steps.indexOf(snapshot.step) > (editing ? 1 : 0)) {
              const previous = steps[steps.indexOf(snapshot.step) - 1];
              if (previous) await goTo(previous);
            } else if (editing) effects.exit("settings");
            return;
          }
          default: {
            const exhaustive: never = action;
            return exhaustive;
          }
        }
      } finally {
        acting = false;
        if (snapshot.saving) publish({ saving: false });
      }
    },
  };
}

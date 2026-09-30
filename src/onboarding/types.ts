import type { Answers, FieldErrors, Step } from "../profile/model";

export type QuestionProps = {
  answers: Answers;
  update: (patch: Partial<Answers>) => void;
  errors: FieldErrors;
  edit: (step: Step) => void;
  disabled: boolean;
};

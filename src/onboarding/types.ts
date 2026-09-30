import type { AnswerChange } from "../profile/calories";
import type { Answers, FieldErrors, EditableStep } from "../profile/answers";

export type QuestionProps = {
  answers: Answers;
  update: (change: AnswerChange) => void;
  errors: FieldErrors;
  edit: (step: EditableStep) => void;
  disabled: boolean;
};

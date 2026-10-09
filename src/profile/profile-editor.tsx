import { ButtonRow, AppButton } from "../components/button";
import { AppText, Panel } from "../components/ui";
import { Question } from "../onboarding/steps";
import { ErrorText } from "../onboarding/controls";
import type { Answers } from "./answers";
import type { ProfileEditSection } from "./section-editing";
import { useFocusedProfileEdit } from "./use-focused-edit";
export function ProfileEditor({
  section,
  initial,
  close,
}: {
  section: ProfileEditSection;
  initial: Answers;
  close: () => void;
}) {
  const { edit, attempt, busy } = useFocusedProfileEdit({
    initial: { section, answers: initial },
    close,
  });
  if (!attempt) return null;
  const { draft, errors, error } = attempt;
  return (
    <Panel testID="profile-editor">
      <AppText variant="heading" accessibilityRole="header">
        Edit {section}
      </AppText>
      <Question
        step={section}
        answers={draft}
        disabled={busy}
        errors={errors}
        edit={() => {}}
        update={(change) => {
          edit.change(change);
        }}
      />
      {Object.entries(errors)
        .filter(
          ([field]) =>
            !(
              {
                name: ["name"],
                age: ["age"],
                body: ["height", "weight", "eligible", "sex"],
                goal: ["goal"],
                activity: ["activity"],
                calories: ["customCalories", "customCarbs", "customProtein", "customFat"],
              }[section] as string[]
            ).includes(field),
        )
        .map(([field, message]) => (
          <ErrorText key={field} message={message} />
        ))}
      {error && <ErrorText message={error} />}
      <ButtonRow>
        <AppButton
          fill
          label="Cancel"
          disabled={busy}
          onPress={() => {
            edit.cancel();
          }}
        />
        <AppButton
          fill
          primary
          label={busy ? "Saving…" : `Save ${section}`}
          disabled={busy}
          onPress={() => void edit.save()}
        />
      </ButtonRow>
    </Panel>
  );
}

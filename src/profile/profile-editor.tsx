import { useRef, useState } from "react";
import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Question } from "../onboarding/steps";
import { ErrorText } from "../onboarding/controls";
import { FoodButton } from "../food/food-button";
import type { Answers, FieldErrors } from "./answers";
import { changeAnswers, validateAnswers } from "./calories";
import { useProfile } from "./provider";
import {
  editedProfileAnswers,
  type ProfileEditSection,
} from "./section-editing";
import { spacing } from "../theme/tokens";
export function ProfileEditor({
  section,
  initial,
  close,
}: {
  section: ProfileEditSection;
  initial: Answers;
  close: () => void;
}) {
  const profile = useProfile();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const pending = useRef(false);
  async function save() {
    if (pending.current || profile.saving || profile.state.kind !== "ready")
      return;
    const answers = editedProfileAnswers(
      profile.state.document.answers,
      draft,
      section,
    );
    const nextErrors = validateAnswers(answers);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    pending.current = true;
    try {
      if (await profile.save({ version: 1, kind: "complete", answers }))
        close();
    } finally {
      pending.current = false;
    }
  }
  return (
    <Panel testID="profile-editor">
      <AppText variant="heading" accessibilityRole="header">
        Edit {section}
      </AppText>
      <Question
        step={section}
        answers={draft}
        disabled={profile.saving}
        errors={errors}
        edit={() => {}}
        update={(change) => {
          setDraft((value) => changeAnswers(value, change));
          setErrors({});
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
                calories: [
                  "customCalories",
                  "customCarbs",
                  "customProtein",
                  "customFat",
                ],
              }[section] as string[]
            ).includes(field),
        )
        .map(([field, message]) => (
          <ErrorText key={field} message={message} />
        ))}
      {profile.error && <ErrorText message={profile.error} />}
      <View style={{ flexDirection: "row", gap: spacing.layout }}>
        <View style={{ flex: 1 }}>
          <FoodButton
            label="Cancel"
            disabled={profile.saving}
            onPress={close}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FoodButton
            primary
            label={profile.saving ? "Saving…" : `Save ${section}`}
            disabled={profile.saving}
            onPress={() => void save()}
          />
        </View>
      </View>
    </Panel>
  );
}

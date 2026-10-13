import { ButtonRow, AppButton } from "../components/button";
import { AppText, Panel } from "../components/ui";
import { Field, ErrorText } from "../onboarding/controls";
import { useWaterGoalEdit } from "../water/use-goal-editing";
// The edit follows the saved goal itself.
export function WaterGoalEditor({ close }: { close: () => void }) {
  const { edit, draft, error, busy } = useWaterGoalEdit();
  return (
    <Panel testID="profile-water-goal-editor">
      <AppText variant="heading" accessibilityRole="header">
        Edit water goal
      </AppText>
      <Field
        label="Daily water goal (ml)"
        value={draft}
        onChangeText={(value) => {
          edit.change(value);
        }}
        editable={!busy}
        inputMode="numeric"
        keyboardType="number-pad"
      />
      {error && <ErrorText message={error} />}
      <ButtonRow>
        <AppButton
          fill
          label="Cancel"
          disabled={busy}
          onPress={() => {
            if (edit.cancel()) close();
          }}
        />
        <AppButton
          fill
          primary
          label={busy ? "Saving water goal…" : "Save water goal"}
          disabled={busy}
          onPress={() => {
            void edit.save().then((saved) => {
              if (saved) close();
            });
          }}
        />
      </ButtonRow>
    </Panel>
  );
}

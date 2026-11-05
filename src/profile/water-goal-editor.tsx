import { ButtonRow, AppButton } from "../components/button";
import { AppText } from "../components/ui";
import { EditorSection } from "./journal-ui";
import { TextField } from "../components/text-field";
import { useDocumentEdit } from "../persistence/use-document-edit";
import { createWaterGoalEdit } from "../water/goal-editing";
import { useWaterGoalPersistence } from "../water/goal-provider";
import { useUnits } from "../units/provider";
import { unitName } from "../units/units";
// The edit follows the saved goal itself. The goals view keys it by units, so its message does too.
export function WaterGoalEditor({ close }: { close: () => void }) {
  const goal = useWaterGoalPersistence();
  const { units } = useUnits();
  const { edit, draft, error, busy, saving } = useDocumentEdit(() =>
    createWaterGoalEdit(goal, units),
  );
  return (
    <EditorSection testID="profile-water-goal-editor">
      <AppText variant="heading" accessibilityRole="header">
        Edit water goal
      </AppText>
      <TextField
        size="large"
        label={`Daily water goal (${unitName("fluid", units)})`}
        quantity="fluid"
        value={draft}
        onChange={(value) => {
          edit.change(value);
        }}
        disabled={busy}
        kind="integer"
        filter
        error={error}
      />
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
          tone="primary"
          label={saving ? "Saving water goal…" : "Save water goal"}
          disabled={busy}
          onPress={() => {
            void edit.save().then((saved) => {
              if (saved) close();
            });
          }}
        />
      </ButtonRow>
    </EditorSection>
  );
}

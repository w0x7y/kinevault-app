import { ButtonRow, AppButton } from "../components/button";
import { AppText } from "../components/ui";
import { EditorSection } from "./journal-ui";
import { TextField } from "../components/text-field";
import { useDocumentEdit } from "../persistence/use-document-edit";
import { createWaterGoalEdit } from "../water/goal-editing";
import { useWaterGoalPersistence } from "../water/goal-provider";
// The edit follows the saved goal itself.
export function WaterGoalEditor({ close }: { close: () => void }) {
  const goal = useWaterGoalPersistence();
  const { edit, draft, error, busy, saving } = useDocumentEdit(() => createWaterGoalEdit(goal));
  return (
    <EditorSection testID="profile-water-goal-editor">
      <AppText variant="heading" accessibilityRole="header">
        Edit water goal
      </AppText>
      <TextField
        size="large"
        label="Daily water goal (ml)"
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

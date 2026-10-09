import { ButtonRow, AppButton } from "../components/button";
import { useRef, useState } from "react";
import { AppText, Panel } from "../components/ui";
import { Field, ErrorText } from "../onboarding/controls";
import { waterGoalFromText } from "../water/goal-model";
import { useWaterGoal } from "../water/goal-provider";
export function WaterGoalEditor({ initial, close }: { initial: number; close: () => void }) {
  const goal = useWaterGoal();
  const [draft, setDraft] = useState(String(initial)),
    [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function save() {
    if (pending.current || goal.saving || goal.state.kind !== "ready") return;
    const ml = waterGoalFromText(draft);
    if (ml === null) {
      setError("Enter a whole number from 1 to 10,000 ml.");
      return;
    }
    pending.current = true;
    setError(null);
    try {
      if (await goal.setGoal(ml)) close();
    } finally {
      pending.current = false;
    }
  }
  return (
    <Panel testID="profile-water-goal-editor">
      <AppText variant="heading" accessibilityRole="header">
        Edit water goal
      </AppText>
      <Field
        label="Daily water goal (ml)"
        value={draft}
        onChangeText={(value) => {
          setDraft(value);
          setError(null);
        }}
        editable={!goal.saving}
        inputMode="numeric"
        keyboardType="number-pad"
      />
      {(error || goal.error) && <ErrorText message={error || goal.error || ""} />}
      <ButtonRow>
        <AppButton fill label="Cancel" disabled={goal.saving} onPress={close} />
        <AppButton
          fill
          primary
          label={goal.saving ? "Saving water goal…" : "Save water goal"}
          disabled={goal.saving}
          onPress={() => void save()}
        />
      </ButtonRow>
    </Panel>
  );
}

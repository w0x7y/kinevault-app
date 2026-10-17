import { View } from "react-native";
import { AppButton } from "../components/button";
import { AppText, Overline, Panel } from "../components/ui";
import { KineStage } from "../onboarding/kine";
import { spacing } from "../theme/tokens";
import type { WorkoutSession } from "./model";

/** Stands in for the day's cards while the Active workout runs; its page opens from here. */
export function LiveWorkoutCard({
  session,
  onOpen,
}: {
  session: WorkoutSession;
  onOpen: () => void;
}) {
  return (
    <Panel testID="exercise-live-workout" style={{ alignItems: "center", gap: spacing.md }}>
      <KineStage pose="exercise" size={132} />
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Overline>In progress</Overline>
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4, textAlign: "center" }}
        >
          {session.name || "Workout"}
        </AppText>
        <AppText muted style={{ textAlign: "center" }}>
          Open your workout to log sets.
        </AppText>
      </View>
      <View style={{ alignSelf: "stretch" }}>
        <AppButton
          label="Open workout"
          accessibilityLabel="Open live workout"
          tone="primary"
          onPress={onOpen}
        />
      </View>
    </Panel>
  );
}

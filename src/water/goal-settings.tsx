import { AppButton } from "../components/button";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { useWaterGoal } from "./goal-provider";
import { useWaterGoalEdit } from "./use-goal-editing";

export function WaterGoalSettings() {
  const goal = useWaterGoal();
  const { edit, draft, error, busy, saved } = useWaterGoalEdit();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const savedMl = goal.state.kind === "ready" ? goal.state.document.dailyMl : undefined;

  return (
    <Panel testID="water-goal-settings">
      <AppText variant="heading" accessibilityRole="header">
        Daily water goal
      </AppText>
      <AppText muted>Your daily goal fills the cup on Home. Water and Drinks both count.</AppText>
      {goal.state.kind === "loading" && (
        <AppText accessibilityLiveRegion="polite" muted>
          Loading water goal...
        </AppText>
      )}
      {goal.state.kind === "error" && (
        <>
          <AppText accessibilityRole="alert" style={{ color: colors.error }}>
            Couldn't load your water goal.
          </AppText>
          <AppButton label="Retry water goal" onPress={goal.retryLoad} />
        </>
      )}
      {goal.state.kind === "ready" && (
        <>
          <AppText variant="caption" muted accessibilityLiveRegion="polite">
            {`Current goal: ${savedMl?.toLocaleString()} ml per day.`}
          </AppText>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">Daily water goal (ml)</AppText>
            <TextInput
              testID="water-goal-input"
              accessibilityLabel="Daily water goal (ml)"
              value={draft}
              keyboardType="number-pad"
              returnKeyType="done"
              editable={!busy}
              onChangeText={(text) => {
                edit.change(text);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={() => void edit.save()}
              style={{
                minHeight: 48,
                padding: spacing.layout,
                borderWidth: 1,
                borderRadius: radius.control,
                borderColor: focused ? colors.ring : colors.input,
                color: colors.foreground,
                backgroundColor: colors.card,
                fontFamily: fonts.regular,
                fontSize: 16,
              }}
            />
          </View>
          {error && (
            <AppText accessibilityRole="alert" style={{ color: colors.error }}>
              {error}
            </AppText>
          )}
          <AppButton
            primary
            label={busy ? "Saving water goal..." : "Save water goal"}
            disabled={busy}
            onPress={() => void edit.save()}
          />
          {saved && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon name="check" size={16} color={colors.primary} />
              <AppText testID="water-goal-saved" role="status" accessibilityLiveRegion="polite">
                Water goal saved.
              </AppText>
            </View>
          )}
        </>
      )}
    </Panel>
  );
}

import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { FoodButton } from "../food/food-button";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { waterGoalFromText } from "./goal-model";
import { useWaterGoal } from "./goal-provider";

export function WaterGoalSettings() {
  const goal = useWaterGoal();
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [focused, setFocused] = useState(false);
  const submitting = useRef(false);
  const savedMl = goal.state.kind === "ready" ? goal.state.document.dailyMl : undefined;
  useEffect(() => { if (savedMl !== undefined) setDraft(String(savedMl)); }, [savedMl]);

  async function save() {
    if (submitting.current || goal.saving || goal.state.kind !== "ready") return;
    setSaved(false);
    const ml = waterGoalFromText(draft);
    if (ml === null) {
      setError("Enter a whole number from 1 to 10,000 ml.");
      return;
    }
    submitting.current = true;
    setError(null);
    try { setSaved(await goal.setGoal(ml)); } finally { submitting.current = false; }
  }

  return (
    <Panel testID="water-goal-settings">
      <AppText variant="heading" accessibilityRole="header">Daily water goal</AppText>
      <AppText muted>Your daily goal fills the cup on Home. Water and Drinks both count.</AppText>
      {goal.state.kind === "loading" && <AppText accessibilityLiveRegion="polite" muted>Loading water goal...</AppText>}
      {goal.state.kind === "error" && <>
        <AppText accessibilityRole="alert" style={{ color: colors.error }}>Couldn't load your water goal.</AppText>
        <FoodButton label="Retry water goal" onPress={goal.retryLoad} />
      </>}
      {goal.state.kind === "ready" && <>
        <AppText variant="caption" muted accessibilityLiveRegion="polite">
          {`Current goal: ${savedMl?.toLocaleString()} ml per day.`}
        </AppText>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">Daily water goal (ml)</AppText>
          <TextInput testID="water-goal-input" accessibilityLabel="Daily water goal (ml)" value={draft}
            keyboardType="number-pad" returnKeyType="done" editable={!goal.saving}
            onChangeText={text => { setDraft(text); setError(null); setSaved(false); }}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onSubmitEditing={() => void save()}
            style={{ minHeight: 48, padding: spacing.layout, borderWidth: 1, borderRadius: radius.control,
              borderColor: focused ? colors.ring : colors.input, color: colors.foreground,
              backgroundColor: colors.card, fontFamily: fonts.regular, fontSize: 16 }} />
        </View>
        {(error || goal.error) && <AppText accessibilityRole="alert" style={{ color: colors.error }}>{error || goal.error}</AppText>}
        <FoodButton primary label={goal.saving ? "Saving water goal..." : "Save water goal"}
          disabled={goal.saving} onPress={() => void save()} />
        {saved && !goal.saving && !goal.error && <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Icon name="check" size={16} color={colors.primary} />
          <AppText testID="water-goal-saved" role="status" accessibilityLiveRegion="polite">Water goal saved.</AppText>
        </View>}
      </>}
    </Panel>
  );
}

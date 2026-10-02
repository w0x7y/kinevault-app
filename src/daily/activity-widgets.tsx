import { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon, type IconName } from "../components/icon";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import type { DayActivity } from "./activity";
import { WaterGoalCup } from "../water/goal-cup";

export function ActivityWidgets({ steps, water, onAddWater }: {
  steps: number;
  water: DayActivity["water"];
  onAddWater: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const { total, goal, progress } = water;
  const goalMl = goal.kind === "ready" ? goal.ml : null;
  const waterLabel = goalMl === null
    ? `Add water. ${total.kind === "ready" ? `${total.ml.toLocaleString()} ml consumed` : `Water total ${total.kind === "loading" ? "loading" : "unavailable"}`}. Daily goal ${goal.kind === "loading" ? "loading" : "unavailable"}. Progress unavailable.${goal.kind === "error" ? " Retry water goal in Settings." : ""}`
    : progress === null || total.kind !== "ready"
    ? `Add water. Water total ${total.kind === "loading" ? "loading" : "unavailable"}. Daily goal: ${goalMl.toLocaleString()} ml. Progress unavailable.`
    : `Add water. ${total.ml.toLocaleString()} ml consumed of a ${goalMl.toLocaleString()} ml daily goal. ${Math.round(progress * 100)}% of goal.`;
  const stats: { title: string; value: string; unit: string; icon: IconName }[] = [
    { title: "Steps", value: steps.toLocaleString(), unit: "steps", icon: "shoe-prints" },
    { title: "Water", value: total.kind === "ready" ? (total.ml / 1000).toLocaleString() : "—",
      unit: total.kind === "loading" ? "loading..." : total.kind === "error" ? "tap to retry" : "litres", icon: "glass-water" },
  ];
  return (
    <View testID="home-activity-row" style={{ flexDirection: "row", gap: spacing.layout }}>
      {stats.map(({ title, value, unit, icon }) => {
        const content = <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ flex: 1, minWidth: 0, gap: spacing.layout }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
                <AppText variant="label" accessibilityRole="header">{title}</AppText>
                {title !== "Water" && <Icon name={icon} color={colors.primary} size={20} />}
              </View>
              <View style={{ gap: 2 }}>
                <AppText testID={title === "Water" ? "home-water-amount" : undefined}
                  variant="title" selectable={title === "Steps"} style={{ fontSize: 28, lineHeight: 36 }}>{value}</AppText>
                <AppText variant="caption" muted>{unit}</AppText>
              </View>
            </View>
            {title === "Water" && <WaterGoalCup progress={progress} />}
          </View>
          {title === "Water" && <View style={{ gap: 2 }}>
            <AppText variant="caption" muted>Includes Drinks</AppText>
            {goalMl !== null && <AppText variant="caption" muted>Goal: {goalMl.toLocaleString()} ml</AppText>}
            <AppText testID="water-goal-progress" variant="caption" muted accessibilityLiveRegion="polite">
              {progress === null ? "Goal progress unavailable" : `${Math.round(progress * 100)}% of goal`}
            </AppText>
            {goal.kind !== "ready" && <AppText variant="caption" muted>
              {goal.kind === "loading" ? "Goal loading..." : "Goal unavailable"}
            </AppText>}
            {goal.kind === "error" && <AppText variant="caption" muted>Retry in Settings</AppText>}
          </View>}
        </>;
        return title === "Water" ? (
          <Pressable key={title} testID="home-water" accessibilityRole="button" accessibilityLabel={waterLabel}
            accessibilityHint="Edit manual water for the selected day. Drinks count separately in your Home total." onPress={onAddWater}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            style={({ pressed }) => ({ flex: 1, minWidth: 0, padding: spacing.layout, gap: spacing.layout,
              borderWidth: 1, borderRadius: radius.panel, borderColor: focused ? colors.ring : colors.border,
              backgroundColor: pressed ? colors.accent : colors.card })}>
            {content}
          </Pressable>
        ) : <Panel key={title} testID="home-steps" style={{ flex: 1, minWidth: 0, padding: spacing.layout, gap: spacing.layout }}>{content}</Panel>;
      })}
    </View>
  );
}

import { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon, type IconName } from "../components/icon";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import type { DailyActivity } from "./model";

export function ActivityWidgets({ day, waterStatus, onAddWater }: {
  day: DailyActivity;
  waterStatus: "loading" | "error" | "ready";
  onAddWater: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const stats: { title: string; value: string; unit: string; icon: IconName }[] = [
    { title: "Steps", value: day.steps.toLocaleString(), unit: "steps", icon: "shoe-prints" },
    { title: "Water", value: waterStatus === "ready" ? (day.waterMl / 1000).toLocaleString() : "—",
      unit: waterStatus === "loading" ? "loading..." : waterStatus === "error" ? "tap to retry" : "litres", icon: "glass-water" },
  ];
  return (
    <View testID="home-activity-row" style={{ flexDirection: "row", gap: spacing.layout }}>
      {stats.map(({ title, value, unit, icon }) => {
        const content = <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.layout }}>
            <AppText variant="label" accessibilityRole="header">{title}</AppText>
            <Icon name={icon} color={colors.primary} size={20} />
          </View>
          <View style={{ gap: 2 }}>
            <AppText variant="title" selectable={title === "Steps"} style={{ fontSize: 28, lineHeight: 36 }}>{value}</AppText>
            <AppText variant="caption" muted>{unit}</AppText>
            {title === "Water" && <AppText variant="caption" muted>Includes Drinks</AppText>}
          </View>
        </>;
        return title === "Water" ? (
          <Pressable key={title} testID="home-water" accessibilityRole="button" accessibilityLabel="Add water"
            accessibilityHint="Enter water for the selected day. Drinks are already included." onPress={onAddWater}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            style={({ pressed }) => ({ flex: 1, padding: spacing.layout, gap: spacing.layout,
              borderWidth: 1, borderRadius: radius.panel, borderColor: focused ? colors.ring : colors.border,
              backgroundColor: pressed ? colors.accent : colors.card })}>
            {content}
          </Pressable>
        ) : <Panel key={title} testID="home-steps" style={{ flex: 1, padding: spacing.layout, gap: spacing.layout }}>{content}</Panel>;
      })}
    </View>
  );
}

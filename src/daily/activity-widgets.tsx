import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon, type IconName } from "../components/icon";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { DailyActivity } from "./model";

export function ActivityWidgets({ day }: { day: DailyActivity }) {
  const { colors } = useTheme();
  const stats: { title: string; value: string; unit: string; icon: IconName }[] = [
    { title: "Steps", value: day.steps.toLocaleString(), unit: "steps", icon: "shoe-prints" },
    { title: "Water", value: (day.waterMl / 1000).toLocaleString(), unit: "litres", icon: "glass-water" },
  ];
  return (
    <View testID="home-activity-row" style={{ flexDirection: "row", gap: spacing.layout }}>
      {stats.map(({ title, value, unit, icon }) => (
        <Panel key={title} testID={title === "Steps" ? "home-steps" : "home-water"} style={{ flex: 1, padding: spacing.layout, gap: spacing.layout }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.layout }}>
            <AppText variant="label" accessibilityRole="header">{title}</AppText>
            <Icon name={icon} color={colors.primary} size={20} />
          </View>
          <View style={{ gap: 2 }}>
            <AppText variant="title" selectable style={{ fontSize: 28, lineHeight: 36 }}>{value}</AppText>
            <AppText variant="caption" muted>{unit}</AppText>
          </View>
        </Panel>
      ))}
    </View>
  );
}

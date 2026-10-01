import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { meals, type DailyActivity } from "./model";

export function MealsWidget({ day, query }: { day: DailyActivity; query: string }) {
  const { colors } = useTheme();
  return (
    <Panel testID="daily-food-log" style={{ padding: spacing.layout, gap: 0 }}>
      <AppText variant="heading" accessibilityRole="header">Daily food log</AppText>
      {meals.map(({ key, label, icon }, index) => {
        const allEntries = day.foods.filter((food) => food.meal === key);
        const entries = allEntries.filter((food) => food.name.toLowerCase().includes(query.trim().toLowerCase()));
        const calories = allEntries.reduce((total, food) => total + food.calories, 0);
        return (
          <View key={key} style={{ paddingVertical: spacing.layout, gap: spacing.layout,
            borderTopWidth: index ? 1 : 0, borderColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.layout }}>
              <Icon name={icon} size={17} color={colors.primary} />
              <AppText variant="label" accessibilityRole="header" style={{ flex: 1 }}>{label}</AppText>
              <AppText variant="caption" muted>{calories.toLocaleString()} kcal</AppText>
            </View>
            {entries.length ? entries.map((food) => (
              <View key={food.id} style={{ flexDirection: "row", gap: spacing.layout, justifyContent: "space-between" }}>
                <AppText style={{ flex: 1, fontSize: 14 }}>{food.name}</AppText>
                <AppText variant="caption" muted>{food.calories.toLocaleString()} kcal</AppText>
              </View>
            )) : query.trim() ? (
              <AppText variant="caption" muted>No matching foods logged.</AppText>
            ) : null}
          </View>
        );
      })}
    </Panel>
  );
}

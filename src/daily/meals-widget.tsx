import { View, type ViewProps } from "react-native";
import { DeleteButton } from "../components/delete-button";
import { AppText, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { meals, type DailyActivity, type FoodEntry } from "./model";
import { FoodButton } from "../food/food-button";

export function MealsWidget({ day, query, onRemove, onEdit, onLayout, saving, error }: {
  day: Pick<DailyActivity, "foods">;
  query: string;
  onRemove: (id: string) => Promise<boolean>;
  onEdit: (entry: FoodEntry) => void;
  onLayout?: ViewProps["onLayout"];
  saving: boolean;
  error: string | null;
}) {
  const { colors } = useTheme();
  return (
    <Panel testID="daily-food-log" onLayout={onLayout} style={{ padding: spacing.layout, gap: 0 }}>
      <AppText variant="heading" accessibilityRole="header">Daily food log</AppText>
      {error && <AppText variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText>}
      {meals.map(({ key, label, icon }, index) => {
        const allEntries = day.foods.filter((food) => food.meal === key);
        const entries = allEntries.filter((food) => food.name.toLowerCase().includes(query.trim().toLowerCase()));
        const calories = allEntries.reduce((total, food) => total + food.calories, 0);
        return (
          <View key={key} testID={`meal-${key}`} style={{ paddingVertical: spacing.layout, gap: spacing.layout,
            borderTopWidth: index ? 1 : 0, borderColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.layout }}>
              <Icon name={icon} size={17} color={colors.primary} />
              <AppText variant="label" accessibilityRole="header" style={{ flex: 1 }}>{label}</AppText>
              <AppText variant="caption" muted>{Math.round(calories).toLocaleString()} kcal</AppText>
            </View>
            {entries.length ? entries.map((food) => (
              <View key={food.id} style={{ flexDirection: "row", gap: spacing.layout, alignItems: "center" }}>
                <FoodButton label="Edit" accessibilityLabel={`Edit ${food.name} in ${label}`}
                  disabled={saving} onPress={() => onEdit(food)} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <AppText style={{ fontSize: 14 }} selectable>{food.name}</AppText>
                  <AppText variant="caption" muted selectable>{food.measurement === "volume"
                    ? `${food.drinkMl.toLocaleString()} ml`
                    : food.meal === "drinks" && food.drinkMl !== undefined
                    ? `${food.drinkMl.toLocaleString()} ml`
                    : `${food.grams.toLocaleString(undefined, { maximumFractionDigits: 1 })} g`} · {Math.round(food.calories).toLocaleString()} kcal</AppText>
                </View>
                <DeleteButton label="Remove" accessibilityLabel={`Remove ${food.name} from ${label}`}
                  confirmAccessibilityLabel={`Confirm remove ${food.name} from ${label}`}
                  disabled={saving} onDelete={() => onRemove(food.id)} />
              </View>
            )) : allEntries.length === 0 ? (
              <AppText variant="caption" muted>No food has been logged yet</AppText>
            ) : query.trim() ? (
              <AppText variant="caption" muted>No matching foods logged.</AppText>
            ) : null}
          </View>
        );
      })}
    </Panel>
  );
}

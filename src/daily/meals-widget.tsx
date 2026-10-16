import { useState } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import Animated from "react-native-reanimated";
import { useLayoutMotion } from "../components/motion";
import { AppText, Panel } from "../components/ui";
import { IconWell } from "../components/icon-well";
import { useTheme } from "../theme/provider";
import { fonts, spacing } from "../theme/tokens";
import { meals, type FoodDay, type FoodEntry, type Meal } from "./model";
import { FoodLogEntry } from "./food-log-entry";
import { InlineMessage } from "../components/inline-message";

export function MealsWidget({
  day,
  query,
  fresh,
  onRemove,
  onEdit,
  onLayout,
  saving,
  error,
}: {
  day: Pick<FoodDay, "foods">;
  query: string;
  /** Entries just logged while the log was on screen; they rise into their meal. */
  fresh?: ReadonlySet<string>;
  onRemove: (id: string) => Promise<boolean>;
  onEdit: (entry: FoodEntry) => void;
  onLayout?: ViewProps["onLayout"];
  saving: boolean;
  error: string | null;
}) {
  const { colors } = useTheme();
  const { layout } = useLayoutMotion();
  // The card whose rows are changing resizes in place; the cards below it glide to their new
  // place. A resizing card is left out of the glide, which would stretch its contents.
  const [armedMeal, setArmedMeal] = useState<Meal | null>(null);
  const [removing, setRemoving] = useState(false);
  const changing = new Set<Meal>(armedMeal ? [armedMeal] : []);
  for (const food of day.foods) if (fresh?.has(food.id)) changing.add(food.meal);
  return (
    <View testID="daily-food-log" onLayout={onLayout} style={{ gap: spacing.layout }}>
      <InlineMessage>{error}</InlineMessage>
      {meals.map(({ key, label, icon }) => {
        const allEntries = day.foods.filter((food) => food.meal === key);
        const entries = allEntries.filter((food) =>
          food.name.toLowerCase().includes(query.trim().toLowerCase()),
        );
        const calories = allEntries.reduce((sum, food) => sum + food.calories, 0);
        const empty =
          allEntries.length === 0
            ? "No food has been logged yet"
            : !entries.length && query.trim()
              ? "No matching foods logged."
              : null;
        return (
          <Animated.View key={key} layout={changing.has(key) ? undefined : layout}>
            <Panel testID={`meal-${key}`} style={{ paddingVertical: spacing.layout, gap: 0 }}>
              <View style={styles.header}>
                <IconWell
                  icon={icon}
                  color={key === "drinks" ? colors.water : colors.primary}
                  size="large"
                />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <AppText
                    variant="label"
                    accessibilityRole="header"
                    style={{ fontSize: 16, lineHeight: 22, fontFamily: fonts.bold }}
                  >
                    {label}
                  </AppText>
                  {empty && (
                    <AppText variant="caption" muted>
                      {empty}
                    </AppText>
                  )}
                </View>
                <AppText
                  variant="label"
                  selectable
                  style={{
                    fontFamily: fonts.bold,
                    fontVariant: ["tabular-nums"],
                    color: calories ? colors.foreground : colors.mutedForeground,
                  }}
                >
                  {Math.round(calories).toLocaleString()}
                  <AppText variant="caption" muted>
                    {" "}
                    kcal
                  </AppText>
                </AppText>
              </View>
              {entries.map((food) => (
                <FoodLogEntry
                  key={food.id}
                  food={food}
                  mealLabel={label}
                  fresh={fresh?.has(food.id) ?? false}
                  saving={saving || removing}
                  onEdit={onEdit}
                  onRemove={onRemove}
                  onArm={() => setArmedMeal(key)}
                  onLeaving={setRemoving}
                  style={{
                    marginTop: spacing.md,
                    paddingTop: spacing.xs,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                  }}
                />
              ))}
            </Panel>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 40 },
});

import { Link } from "expo-router";
import { Pressable, View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { progressFraction } from "./model";
import { calorieSegments } from "./nutrition";
import type { Nutrition } from "../food/catalog";

export function CalorieWidget({
  current,
  goal,
  macros,
  testIDPrefix = "home",
}: {
  current: number;
  goal: number | null;
  macros: Omit<Nutrition, "calories">;
  testIDPrefix?: string;
}) {
  const { colors } = useTheme();
  const fraction = progressFraction(current, goal);
  const percentage = Math.round(fraction * 100);
  return (
    <Panel
      testID={`${testIDPrefix}-calories`}
      style={{ padding: spacing.layout, gap: spacing.layout }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.layout,
          flexWrap: "wrap",
        }}
      >
        <AppText variant="heading" accessibilityRole="header">
          Calories
        </AppText>
        <AppText variant="label" selectable>
          {Math.round(current).toLocaleString()} / {goal === null ? "—" : goal.toLocaleString()}{" "}
          kcal
        </AppText>
      </View>
      <View
        testID={`${testIDPrefix}-calorie-track`}
        accessibilityRole="progressbar"
        accessibilityLabel={`${current} kilocalories consumed, calorie goal ${goal === null ? "unset" : `${goal} kilocalories`}`}
        accessibilityValue={{ min: 0, max: 100, now: percentage }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        style={{
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.muted,
          overflow: "hidden",
          flexDirection: "row",
        }}
      >
        {calorieSegments({ ...macros, calories: current }, goal).map((segment) => (
          <View
            key={segment.key}
            testID={`${testIDPrefix}-calorie-${segment.key}`}
            style={{
              height: "100%",
              width: `${segment.fraction * 100}%`,
              backgroundColor:
                segment.key === "other" ? colors.mutedForeground : colors[segment.key],
            }}
          />
        ))}
      </View>
      {goal === null && (
        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Set calorie and macro goals in Settings"
            style={({ pressed }) => ({
              minHeight: 44,
              justifyContent: "center",
              alignSelf: "flex-start",
              paddingHorizontal: spacing.layout,
              borderRadius: 8,
              backgroundColor: pressed ? colors.accent : "transparent",
            })}
          >
            <AppText
              variant="label"
              style={{ color: colors.primary, textDecorationLine: "underline" }}
            >
              Set your goals
            </AppText>
          </Pressable>
        </Link>
      )}
    </Panel>
  );
}

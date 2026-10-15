import { AppButton } from "../components/button";
import { useState } from "react";
import { View, type ViewProps } from "react-native";
import { parseDay } from "../calendar/dates.ts";
import { AppText, Panel } from "../components/ui";
import { CalorieWidget } from "../daily/calorie-widget";
import { summarizeDay, type FoodDay } from "../daily/model.ts";
import { sumDetailedNutrients } from "../daily/detailed-nutrition.ts";
import { useDayActivity } from "../daily/use-day";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { detailedNutrients } from "./nutrients.ts";
import { foodDatabase } from "./database";

const nutrientRows = [
  { key: "calories", label: "Calories", unit: "kcal", indented: false },
  { key: "carbs", label: "Carbs", unit: "g", indented: false },
  { key: "protein", label: "Protein", unit: "g", indented: false },
  { key: "fat", label: "Fat", unit: "g", indented: false },
  ...detailedNutrients,
] as const;

function formatNutrient(value: number | null): string {
  if (value === null) return "Not available";
  if (value > 0 && value < 0.01) return "<0.01";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function DailyMacros({
  day,
  onBack,
  onLayout,
}: {
  day: FoodDay;
  onBack: () => void;
  onLayout: ViewProps["onLayout"];
}) {
  const { targets } = useDayActivity(day.date);
  const { colors } = useTheme();
  const [showMissing, setShowMissing] = useState(false);
  if (targets.kind !== "ready") return null;
  const summary = summarizeDay(day);
  const details = sumDetailedNutrients(day.foods, foodDatabase.getById);
  const values = { ...summary, ...details };
  // Nutrients without data fold away behind one control instead of a column of placeholders.
  const missing = nutrientRows.filter(({ key }) => values[key] === null);
  const rows = showMissing ? nutrientRows : nutrientRows.filter(({ key }) => values[key] !== null);
  return (
    <View testID="daily-macro-view" onLayout={onLayout} style={{ gap: spacing.layout }}>
      <AppButton link icon="chevron-left" label="Back to food log" onPress={onBack} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.layout }}>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
          <AppText variant="heading" accessibilityRole="header">
            Daily macros
          </AppText>
          <AppText variant="caption" muted selectable>
            {parseDay(day.date).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </AppText>
        </View>
      </View>
      <CalorieWidget
        current={summary.calories}
        macros={summary}
        goal={targets.calories}
        testIDPrefix="day"
      />
      <Panel testID="daily-nutrient-details" style={{ gap: 0 }}>
        {rows.map(({ key, label, unit, indented }, index) => (
          <View
            key={key}
            testID={`daily-nutrient-${key}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.layout,
              paddingVertical: spacing.layout,
              borderTopWidth: index ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            <AppText
              testID="nutrient-label"
              variant="label"
              style={{
                flex: 1,
                paddingLeft: indented ? spacing.layout : 0,
                color:
                  key === "carbs" || key === "protein" || key === "fat"
                    ? colors[key]
                    : colors.foreground,
              }}
            >
              {label} ({unit})
            </AppText>
            <AppText
              testID="nutrient-value"
              variant="label"
              selectable
              style={{
                color: values[key] === null ? colors.mutedForeground : colors.foreground,
                fontVariant: ["tabular-nums"],
              }}
            >
              {key === "calories"
                ? Math.round(values[key]).toLocaleString()
                : formatNutrient(values[key])}
            </AppText>
          </View>
        ))}
        {missing.length > 0 && (
          <View style={{ paddingTop: spacing.sm }}>
            <AppButton
              link
              icon={showMissing ? "chevron-up" : "chevron-down"}
              label={
                showMissing
                  ? "Hide nutrients without data"
                  : `Show ${missing.length} ${missing.length === 1 ? "nutrient" : "nutrients"} without data`
              }
              expanded={showMissing}
              onPress={() => setShowMissing((shown) => !shown)}
            />
          </View>
        )}
      </Panel>
      {day.foods.length === 0 && <AppText muted>No food has been logged yet</AppText>}
    </View>
  );
}

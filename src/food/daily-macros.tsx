import { AppButton } from "../components/button";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SheetPage } from "../components/sheet-page";
import { parseDay } from "../calendar/dates.ts";
import { AppText, Overline, Panel } from "../components/ui";
import { macroCategories } from "../daily/nutrition.ts";
import { sumDetailedNutrients } from "../daily/detailed-nutrition.ts";
import type { DayActivity } from "../daily/activity";
import { GoalsLink } from "../daily/calorie-widget";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { detailedNutrients } from "./nutrients.ts";
import { getFoodDatabase } from "./database";

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

export function DailyMacros({ activity, onBack }: { activity: DayActivity; onBack: () => void }) {
  const { targets, food, nutrition } = activity;
  const { colors } = useTheme();
  const [showMissing, setShowMissing] = useState(false);
  // The page opens at once; its figures appear when the day's targets have loaded.
  if (targets.kind !== "ready" || food.kind !== "ready" || !nutrition)
    return <SheetPage title="Daily macros" closeLabel="Back to food log" onClose={onBack} />;
  const { day, summary } = food;
  const { calories } = nutrition;
  const details = sumDetailedNutrients(day.foods, getFoodDatabase().getById);
  const values = { ...summary, ...details };
  // Nutrients without data fold away behind one control instead of a column of placeholders.
  const missing = nutrientRows.filter(({ key }) => values[key] === null);
  const rows = showMissing ? nutrientRows : nutrientRows.filter(({ key }) => values[key] !== null);
  return (
    <SheetPage title="Daily macros" closeLabel="Back to food log" onClose={onBack}>
      <View testID="daily-macro-view" style={{ gap: spacing.layout }}>
        <Overline selectable style={{ textAlign: "center" }}>
          {parseDay(day.date).toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Overline>
        <Panel style={{ gap: 0 }}>
          <View testID="day-calories" style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Overline style={{ flex: 1 }}>Energy</Overline>
              {calories.remaining !== null && (
                <Overline
                  style={{
                    color:
                      calories.balance.caption === "over" ? colors.danger : colors.mutedForeground,
                  }}
                >
                  {`${calories.balance.value} ${calories.balance.caption}`}
                </Overline>
              )}
            </View>
            <AppText variant="hero" selectable>
              {calories.eaten.toLocaleString()}
              <AppText
                variant="body"
                muted
                style={{ fontFamily: fonts.semibold, letterSpacing: 0 }}
              >
                {` ${calories.ofTarget}`}
              </AppText>
            </AppText>
            <View
              testID="day-calorie-track"
              accessibilityRole="progressbar"
              accessibilityLabel={calories.label}
              accessibilityValue={{ min: 0, max: 100, now: calories.percentage }}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={calories.percentage}
              style={{
                height: 10,
                borderRadius: radius.pill,
                backgroundColor: colors.muted,
                overflow: "hidden",
                flexDirection: "row",
              }}
            >
              {calories.segments.map((segment) => (
                <View
                  key={segment.key}
                  testID={`day-calorie-${segment.key}`}
                  style={{
                    height: "100%",
                    width: `${segment.fraction * 100}%`,
                    backgroundColor:
                      segment.key === "other" ? colors.mutedForeground : colors[segment.key],
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm, paddingTop: spacing.xs }}>
              {macroCategories.map(({ key, label }) => (
                <View key={key} style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View
                      style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors[key] }}
                    />
                    <AppText
                      variant="caption"
                      style={{ color: colors[key], fontFamily: fonts.bold }}
                    >
                      {label}
                    </AppText>
                  </View>
                  <AppText
                    variant="label"
                    style={{ fontFamily: fonts.extrabold, fontVariant: ["tabular-nums"] }}
                  >
                    {nutrition[key].eaten.toLocaleString()}
                    <AppText variant="caption" muted>
                      {` ${nutrition[key].ofTarget}`}
                    </AppText>
                  </AppText>
                </View>
              ))}
            </View>
            {calories.target === null && (
              // Settings opens behind this page, so the page closes first.
              <GoalsLink onPress={onBack} />
            )}
          </View>
          <View
            testID="daily-nutrient-details"
            style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
          >
            <Overline style={{ paddingTop: spacing.lg, paddingBottom: spacing.xs }}>
              Nutrients
            </Overline>
            {rows.map(({ key, label, unit, indented }, index) => (
              <View
                key={key}
                testID={`daily-nutrient-${key}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.layout,
                  paddingVertical: spacing.md,
                  borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                  borderColor: colors.border,
                }}
              >
                <AppText
                  testID="nutrient-label"
                  variant="label"
                  style={{
                    flex: 1,
                    paddingLeft: indented ? spacing.layout : 0,
                    fontFamily: indented ? fonts.medium : fonts.semibold,
                    color:
                      key === "carbs" || key === "protein" || key === "fat"
                        ? colors[key]
                        : indented
                          ? colors.mutedForeground
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
                    fontFamily: values[key] === null ? fonts.medium : fonts.bold,
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
              <View
                style={{
                  paddingTop: spacing.xs,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                }}
              >
                <AppButton
                  tone="link"
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
          </View>
        </Panel>
        {day.foods.length === 0 && (
          <AppText muted style={{ textAlign: "center" }}>
            No food has been logged yet
          </AppText>
        )}
      </View>
    </SheetPage>
  );
}

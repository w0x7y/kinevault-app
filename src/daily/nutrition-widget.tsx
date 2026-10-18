import { View } from "react-native";
import { AppText } from "../components/ui";
import { ProgressFill } from "../components/motion";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { macroCategories } from "./nutrition";
import { unsetTarget, type NutritionProgress } from "./activity";

/** Macro progress rows. Sits inside the energy card, so it draws no surface of its own. */
export function NutritionWidget({
  nutrition,
  width,
}: {
  width?: number;
  nutrition: NutritionProgress;
}) {
  const { colors } = useTheme();
  const textSize = width !== undefined && width < 150 ? 12 : 13;

  return (
    <View testID="home-macros" style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
      <View testID="home-macro-rows" style={{ gap: spacing.md }}>
        {macroCategories.map(({ key, label }) => {
          const { eaten, target, fraction, percentage, label: progressLabel } = nutrition[key];
          return (
            <View key={key} style={{ gap: 6 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  columnGap: spacing.sm,
                }}
              >
                <AppText
                  testID={`macro-${key}-label`}
                  variant="label"
                  numberOfLines={1}
                  style={{ fontSize: textSize + 1, fontFamily: fonts.bold, color: colors[key] }}
                >
                  {label}
                </AppText>
                <AppText
                  testID={`macro-${key}-count`}
                  variant="caption"
                  muted
                  selectable
                  numberOfLines={1}
                  style={{ fontSize: textSize, fontVariant: ["tabular-nums"] }}
                >
                  {eaten.toLocaleString()} /{" "}
                  {target === null ? unsetTarget.shown : target.toLocaleString()} g
                </AppText>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={progressLabel}
                accessibilityValue={{ min: 0, max: 100, now: percentage }}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
                style={{
                  height: 6,
                  borderRadius: radius.pill,
                  backgroundColor: colors.muted,
                  overflow: "hidden",
                }}
              >
                <ProgressFill
                  testID={`home-macro-${key}-fill`}
                  fraction={fraction}
                  color={colors[key]}
                  style={{ borderRadius: radius.pill }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

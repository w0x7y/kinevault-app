import { View } from "react-native";
import { AppText } from "../components/ui";
import { ProgressFill } from "../components/motion";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { progressFraction, type summarizeDay } from "./model";
import { macroCategories } from "./nutrition";

type NutritionTargets = { carbs: number | null; protein: number | null; fat: number | null };

/** Macro progress rows. Sits inside the energy card, so it draws no surface of its own. */
export function NutritionWidget({
  targets,
  summary,
  width,
}: {
  width?: number;
  targets: NutritionTargets;
  summary: ReturnType<typeof summarizeDay>;
}) {
  const { colors } = useTheme();
  const textSize = width !== undefined && width < 150 ? 12 : 13;

  return (
    <View testID="home-macros" style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
      <View testID="home-macro-rows" style={{ gap: spacing.md }}>
        {macroCategories.map(({ key, label }) => {
          const value = summary[key];
          const target = targets[key];
          const progress = progressFraction(value, target);
          const percentage = Math.round(progress * 100);
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
                  {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} /{" "}
                  {target === null ? "—" : target.toLocaleString()} g
                </AppText>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={`${label}, ${value} grams consumed, target ${target === null ? "unset" : `${target} grams`}`}
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
                  fraction={progress}
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

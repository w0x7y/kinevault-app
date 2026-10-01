import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { progressFraction, type summarizeDay } from "./model";

type NutritionTargets = { carbs: number | null; protein: number | null; fat: number | null };

export function NutritionWidget({ targets, summary, width }: {
  width: number;
  targets: NutritionTargets;
  summary: ReturnType<typeof summarizeDay>;
}) {
  const { colors } = useTheme();
  const compact = width < 200;
  const textSize = width < 150 ? 10 : compact ? 12 : 14;
  const macros = [
    { key: "carbs", label: "Carbs", icon: "wheat-awn" },
    { key: "protein", label: "Protein", icon: "egg" },
    { key: "fat", label: "Fat", icon: "seedling" },
  ] as const;

  return (
    <Panel testID="home-macros" style={{ flexGrow: 1, flexShrink: 0, minHeight: width, padding: spacing.layout, gap: spacing.layout }}>
      {macros.map(({ key, label, icon }) => {
        const value = summary[key];
        const target = targets[key];
        const progress = progressFraction(value, target);
        const percentage = Math.round(progress * 100);
        return (
          <View key={key} style={{ gap: 5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: compact ? 4 : 6 }}>
              <AppText variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flex: 1, minWidth: 0, fontSize: textSize }}>
                <AppText testID={`macro-${key}-label`} variant="label" style={{ fontSize: textSize }}>{label}</AppText>
                {" "}
                <AppText testID={`macro-${key}-count`} variant="caption" muted selectable style={{ fontSize: textSize }}>
                  {value.toLocaleString()} / {target === null ? "—" : target.toLocaleString()} g
                </AppText>
              </AppText>
              <Icon name={icon} size={compact ? 10 : 12} color={colors.primary} />
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`${label}, ${value} grams consumed, target ${target === null ? "unset" : `${target} grams`}`}
              accessibilityValue={{ min: 0, max: 100, now: percentage }}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage}
              style={{ height: 7, borderRadius: 4, backgroundColor: colors.muted, overflow: "hidden" }}
            >
              <View style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${progress * 100}%`, backgroundColor: colors.primary, borderRadius: 4 }} />
            </View>
          </View>
        );
      })}
    </Panel>
  );
}

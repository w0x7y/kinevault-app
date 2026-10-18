import { useState, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { AppText, Overline } from "../components/ui";
import { IconWell } from "../components/icon-well";
import { Tappable } from "../components/tappable";
import { useTheme } from "../theme/provider";
import { cardShadow, fonts, radius, spacing } from "../theme/tokens";
import type { DayActivity } from "./activity";
import { WaterGoalCup, waterCupSize } from "../water/goal-cup";

const tilePadding = 16;
const besideGap = spacing.sm;

export function ActivityWidgets({
  steps,
  water,
  onLogSteps,
  onAddWater,
}: {
  steps: DayActivity["steps"]["tile"];
  water: DayActivity["water"];
  onLogSteps: () => void;
  onAddWater: () => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const { progress, tile } = water;

  // Figures share the space beside the cup (or the steps icon), so long totals shrink to fit
  // narrow phones instead of running under it.
  const availableRow = rowWidth || Math.max(0, Math.min(width, 768) - spacing.gutter * 2);
  const tileWidth = (availableRow - spacing.layout) / 2;
  const figureRoom = Math.max(0, tileWidth - tilePadding * 2 - 2 - waterCupSize.width - besideGap);
  const figureSize = (value: string) =>
    Math.max(10, Math.min(28, Math.floor(figureRoom / (value.length * 0.64))));

  const waterValue = tile.value ?? "—";
  const stepsValue = steps.value === null ? "—" : steps.value.toLocaleString();
  // Tiles split the row from a zero basis; padding lives on the inner surface so it can't
  // skew the split.
  const slot = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 } as const;
  const tileStyle = {
    flexGrow: 1,
    padding: tilePadding,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.panel,
    borderColor: colors.border,
    boxShadow: cardShadow(colors),
  } as const;

  return (
    <View
      testID="home-activity-row"
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: "row", gap: spacing.layout }}
    >
      <Tappable
        testID="home-steps"
        label={steps.label}
        hint="Log steps for the selected day. Steps your phone counts are added automatically."
        onPress={onLogSteps}
        ring="outline"
        style={slot}
        surface={({ pressed }) => [
          tileStyle,
          { backgroundColor: pressed ? colors.muted : colors.card },
        ]}
      >
        <TileTop
          title="Steps"
          side={<IconWell icon="shoe-prints" color={colors.mutedForeground} />}
        >
          <Figure
            testID="home-steps-total"
            value={stepsValue}
            size={figureSize(stepsValue)}
            unit={steps.value === null ? undefined : "steps"}
          />
        </TileTop>
        <View style={{ gap: 2 }}>
          {steps.captions.map((caption) => (
            <AppText key={caption} variant="caption" muted>
              {caption}
            </AppText>
          ))}
        </View>
      </Tappable>
      <Tappable
        testID="home-water"
        label={tile.label}
        hint="Edit manual water for the selected day. Drinks count separately in your Home total."
        onPress={onAddWater}
        ring="outline"
        // The hit target stays square so the tile's rounded corners still open the editor.
        style={slot}
        surface={({ pressed }) => [
          tileStyle,
          { backgroundColor: pressed ? colors.muted : colors.card },
        ]}
      >
        <TileTop title="Water" side={<WaterGoalCup progress={progress} />}>
          <Figure
            testID="home-water-amount"
            value={waterValue}
            size={figureSize(waterValue)}
            unit={tile.value === null ? undefined : "L"}
          />
          {tile.status && (
            <AppText variant="caption" muted>
              {tile.status}
            </AppText>
          )}
        </TileTop>
        <View style={{ gap: 2 }}>
          <AppText
            testID="water-goal-progress"
            variant="caption"
            accessibilityLiveRegion="polite"
            style={{
              fontFamily: fonts.semibold,
              color: progress === null ? colors.mutedForeground : colors.foreground,
            }}
          >
            {tile.progress}
          </AppText>
          {tile.captions.map((caption) => (
            <AppText key={caption} variant="caption" muted>
              {caption}
            </AppText>
          ))}
        </View>
      </Tappable>
    </View>
  );
}

function TileTop({
  title,
  side,
  children,
}: {
  title: string;
  side: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: besideGap }}>
      <View style={{ flex: 1, minWidth: 0, gap: spacing.sm }}>
        <Overline accessibilityRole="header">{title}</Overline>
        <View style={{ gap: 2 }}>{children}</View>
      </View>
      {side}
    </View>
  );
}

function Figure({
  value,
  size,
  unit,
  testID,
}: {
  value: string;
  size: number;
  unit?: string;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 3 }}>
      <AppText
        testID={testID}
        style={{
          fontFamily: fonts.extrabold,
          fontSize: size,
          // Manrope's glyph box is ~1.37em; a shorter line would clip it.
          lineHeight: Math.ceil(size * 1.38),
          letterSpacing: -0.04 * size,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </AppText>
      {unit && (
        <AppText variant="caption" muted style={{ fontFamily: fonts.bold, fontSize: 14 }}>
          {unit}
        </AppText>
      )}
    </View>
  );
}

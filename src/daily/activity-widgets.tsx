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
  onAddWater,
}: {
  steps: number | null;
  water: DayActivity["water"];
  onAddWater: () => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const { total, goal, progress } = water;
  const goalMl = goal.kind === "ready" ? goal.ml : null;
  const waterLabel =
    goalMl === null
      ? `Add water. ${total.kind === "ready" ? `${total.ml.toLocaleString()} ml consumed` : `Water total ${total.kind === "loading" ? "loading" : "unavailable"}`}. Daily goal ${goal.kind === "loading" ? "loading" : "unavailable"}. Progress unavailable.${goal.kind === "error" ? " Retry water goal in Settings." : ""}`
      : progress === null || total.kind !== "ready"
        ? `Add water. Water total ${total.kind === "loading" ? "loading" : "unavailable"}. Daily goal: ${goalMl.toLocaleString()} ml. Progress unavailable.`
        : `Add water. ${total.ml.toLocaleString()} ml consumed of a ${goalMl.toLocaleString()} ml daily goal. ${Math.round(progress * 100)}% of goal.`;

  // Figures share the space beside the cup (or the steps icon), so long totals shrink to fit
  // narrow phones instead of running under it.
  const availableRow = rowWidth || Math.max(0, Math.min(width, 768) - spacing.gutter * 2);
  const tileWidth = (availableRow - spacing.layout) / 2;
  const figureRoom = Math.max(0, tileWidth - tilePadding * 2 - 2 - waterCupSize.width - besideGap);
  const figureSize = (value: string) =>
    Math.max(10, Math.min(28, Math.floor(figureRoom / (value.length * 0.64))));

  const waterValue = total.kind === "ready" ? (total.ml / 1000).toLocaleString() : "—";
  const stepsValue = steps === null ? "—" : steps.toLocaleString();
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
      <View testID="home-steps" style={slot}>
        <View style={[tileStyle, { backgroundColor: colors.card }]}>
          <TileTop
            title="Steps"
            side={<IconWell icon="shoe-prints" color={colors.mutedForeground} />}
          >
            <Figure
              value={stepsValue}
              size={figureSize(stepsValue)}
              unit={steps === null ? undefined : "steps"}
              selectable
            />
          </TileTop>
          {steps === null && (
            <AppText variant="caption" muted>
              Not connected
            </AppText>
          )}
        </View>
      </View>
      <Tappable
        testID="home-water"
        label={waterLabel}
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
            unit={total.kind === "ready" ? "L" : undefined}
          />
          {total.kind !== "ready" && (
            <AppText variant="caption" muted>
              {total.kind === "loading" ? "loading..." : "tap to retry"}
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
            {progress === null
              ? "Goal progress unavailable"
              : `${Math.round(progress * 100)}% of goal`}
          </AppText>
          {goalMl !== null && (
            <AppText variant="caption" muted>
              Goal: {goalMl.toLocaleString()} ml
            </AppText>
          )}
          {goal.kind !== "ready" && (
            <AppText variant="caption" muted>
              {goal.kind === "loading" ? "Goal loading..." : "Goal unavailable"}
            </AppText>
          )}
          {goal.kind === "error" && (
            <AppText variant="caption" muted>
              Retry in Settings
            </AppText>
          )}
          <AppText variant="caption" muted>
            Includes Drinks
          </AppText>
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
  selectable,
}: {
  value: string;
  size: number;
  unit?: string;
  testID?: string;
  selectable?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 3 }}>
      <AppText
        testID={testID}
        selectable={selectable}
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

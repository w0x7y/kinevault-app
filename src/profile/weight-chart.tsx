import { useId } from "react";
import { Platform, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { AppText } from "../components/ui";
import { Icon } from "../components/icon";
import { parseDay } from "../calendar/dates";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { JournalFigure } from "./journal-ui";
import { weightTrend, type WeightEntry } from "./weight-model";
import { ChartSeriesLayer } from "./chart-reveal";

export const weightLabel = (kg: number) => kg.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const weightDateLabel = (date: string) =>
  parseDay(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function WeightChart({ entries }: { entries: readonly WeightEntry[] }) {
  const { colors, appearance } = useTheme();
  const gradientId = `weight-fill-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  // Keep the drawing bounded. The full history remains available below it.
  const trend = weightTrend(entries.slice(-30));
  if (!trend.points.length)
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md + 2,
          borderRadius: radius.control,
          backgroundColor: colors.muted,
        }}
      >
        <Icon name="weight-scale" size={20} color={colors.mutedForeground} />
        <AppText variant="label" muted style={{ flex: 1, fontFamily: fonts.medium }}>
          No measurements yet. Log your weight to start your trend.
        </AppText>
      </View>
    );
  const first = trend.points[0]!,
    latest = trend.points.at(-1)!;
  const x = (value: number) => 44 + value * 254;
  const y = (value: number) => 116 - value * 94;
  const path = trend.points
    .map((point, index) => `${index ? "L" : "M"}${x(point.x)},${y(point.y)}`)
    .join(" ");
  const area = `${path} L${x(latest.x)},116 L${x(first.x)},116 Z`;
  const description = trend.points
    .map((point) => `${point.date}: ${weightLabel(point.kg)} kg`)
    .join("; ");
  const shortDate = (date: string) =>
    parseDay(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const grid = appearance === "dark" ? colors.input : colors.border;
  return (
    <View style={{ gap: spacing.sm }}>
      <View>
        <JournalFigure value={weightLabel(latest.kg)} unit="kg" />
        <AppText variant="caption" muted>
          {weightDateLabel(latest.date)}
          {trend.change !== null &&
            ` · ${trend.change > 0 ? "+" : trend.change < 0 ? "−" : ""}${weightLabel(Math.abs(trend.change))} kg since ${shortDate(first.date)}`}
        </AppText>
      </View>
      <View
        testID="body-weight-trend"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Body weight trend, ${trend.points.length} measurements. ${description}`}
      >
        <Svg width="100%" height={150} viewBox="0 0 320 150" aria-hidden {...hidden}>
          {[0, 0.5, 1].map((value) => (
            <Line
              key={value}
              x1={44}
              x2={298}
              y1={y(value)}
              y2={y(value)}
              stroke={grid}
              strokeWidth={1}
              strokeDasharray={value ? "3 4" : undefined}
            />
          ))}
          {[0, 1].map((value) => (
            <SvgText
              key={value}
              x={36}
              y={y(value) + 4}
              textAnchor="end"
              fill={colors.mutedForeground}
              fontFamily={fonts.medium}
              fontSize={11}
            >
              {weightLabel(Math.round((value ? trend.maximum : trend.minimum) * 10) / 10)}
            </SvgText>
          ))}
          <SvgText
            x={trend.points.length > 1 ? 44 : x(first.x)}
            y={141}
            textAnchor={trend.points.length > 1 ? "start" : "middle"}
            fill={colors.mutedForeground}
            fontFamily={fonts.medium}
            fontSize={11}
          >
            {shortDate(first.date)}
          </SvgText>
          {trend.points.length > 1 && (
            <SvgText
              x={298}
              y={141}
              textAnchor="end"
              fill={colors.mutedForeground}
              fontFamily={fonts.medium}
              fontSize={11}
            >
              {shortDate(latest.date)}
            </SvgText>
          )}
        </Svg>
        <ChartSeriesLayer dataKey={description}>
          <Svg width="100%" height={150} viewBox="0 0 320 150" aria-hidden {...hidden}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={colors.brand}
                  stopOpacity={appearance === "dark" ? 0.3 : 0.18}
                />
                <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {trend.points.length > 1 && (
              <>
                <Path d={area} fill={`url(#${gradientId})`} />
                <Path
                  d={path}
                  fill="none"
                  stroke={colors.brand}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            )}
            {trend.points.map((point, index) => (
              <Circle
                key={point.date}
                cx={x(point.x)}
                cy={y(point.y)}
                r={index === trend.points.length - 1 ? 5 : 3.5}
                fill={index === trend.points.length - 1 ? colors.brand : colors.card}
                stroke={colors.brand}
                strokeWidth={index === trend.points.length - 1 ? 2.5 : 2}
              />
            ))}
          </Svg>
        </ChartSeriesLayer>
      </View>
    </View>
  );
}

const hidden =
  Platform.OS === "web"
    ? {}
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants" as const,
      };

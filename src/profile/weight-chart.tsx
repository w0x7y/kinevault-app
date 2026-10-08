import { Platform, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { parseDay } from "../calendar/dates";
import { useTheme } from "../theme/provider";
import { fonts } from "../theme/tokens";
import { JournalText } from "./journal-ui";
import { weightTrend, type WeightEntry } from "./weight-model";

export const weightLabel = (kg: number) => kg.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const weightDateLabel = (date: string) =>
  parseDay(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function WeightChart({ entries }: { entries: readonly WeightEntry[] }) {
  const { colors } = useTheme();
  // Keep the drawing bounded. The full history remains available below it.
  const trend = weightTrend(entries.slice(-30));
  if (!trend.points.length)
    return (
      <JournalText muted>No measurements yet. Log your weight to start your trend.</JournalText>
    );
  const first = trend.points[0]!,
    latest = trend.points.at(-1)!;
  const x = (value: number) => 44 + value * 254;
  const y = (value: number) => 116 - value * 94;
  const path = trend.points
    .map((point, index) => `${index ? "L" : "M"}${x(point.x)},${y(point.y)}`)
    .join(" ");
  const description = trend.points
    .map((point) => `${point.date}: ${weightLabel(point.kg)} kg`)
    .join("; ");
  return (
    <View style={{ gap: 6 }}>
      <JournalText size={18} variant="heading">
        {weightLabel(latest.kg)} kg
        <JournalText size={10} muted>
          {" "}
          · {weightDateLabel(latest.date)}
        </JournalText>
      </JournalText>
      {trend.change !== null && (
        <JournalText size={11} muted>
          {`${trend.change > 0 ? "+" : ""}${weightLabel(trend.change)} kg since ${weightDateLabel(first.date)}`}
        </JournalText>
      )}
      <View
        testID="body-weight-trend"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Body weight trend, ${trend.points.length} measurements. ${description}`}
      >
        <Svg
          width="100%"
          height={150}
          viewBox="0 0 320 150"
          aria-hidden
          {...(Platform.OS === "web"
            ? {}
            : {
                accessibilityElementsHidden: true,
                importantForAccessibility: "no-hide-descendants" as const,
              })}
        >
          {[0, 0.5, 1].map((value) => (
            <Line
              key={value}
              x1={44}
              x2={298}
              y1={y(value)}
              y2={y(value)}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {[0, 1].map((value) => (
            <SvgText
              key={value}
              x={37}
              y={y(value) + 3}
              textAnchor="end"
              fill={colors.mutedForeground}
              fontFamily={fonts.regular}
              fontSize={9}
            >
              {weightLabel(value ? trend.maximum : trend.minimum)}
            </SvgText>
          ))}
          {trend.points.length > 1 && (
            <Path
              d={path}
              fill="none"
              stroke={colors.primary}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}
          {trend.points.map((point) => (
            <Circle
              key={point.date}
              cx={x(point.x)}
              cy={y(point.y)}
              r={3.5}
              fill={colors.primary}
              stroke={colors.card}
              strokeWidth={1}
            />
          ))}
          <SvgText
            x={44}
            y={141}
            fill={colors.mutedForeground}
            fontFamily={fonts.regular}
            fontSize={9}
          >
            {first.date}
          </SvgText>
          {trend.points.length > 1 && (
            <SvgText
              x={298}
              y={141}
              textAnchor="end"
              fill={colors.mutedForeground}
              fontFamily={fonts.regular}
              fontSize={9}
            >
              {latest.date}
            </SvgText>
          )}
        </Svg>
      </View>
    </View>
  );
}

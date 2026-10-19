import { useId, useMemo, useRef, useState } from "react";
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
import { Icon } from "../components/icon";
import { Tappable } from "../components/tappable";
import { useExercises } from "../exercise/provider";
import { useTheme } from "../theme/provider";
import { AppText, Panel } from "../components/ui";
import { fonts, radius, spacing } from "../theme/tokens";
import { parseDay } from "../calendar/dates";
import { workoutGraph, workoutWeekLabel, type WorkoutMetric, type WorkoutRange } from "./activity";
import { SourceStatus } from "./profile-controls";
import { SegmentedControl } from "../components/segmented-control";
import { JournalDisclosure, JournalFigure, JournalHeading } from "./journal-ui";
import { ChartSeriesLayer } from "./chart-reveal";
import { trackingMode } from "../exercise/tracking";
export function WorkoutChart({ today }: { today: string }) {
  const exercise = useExercises(),
    { colors, appearance } = useTheme();
  const gradientId = `workout-fill-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const grid = appearance === "dark" ? colors.input : colors.border;
  const [metric, setMetric] = useState<WorkoutMetric>("volume"),
    [weeks, setWeeks] = useState<WorkoutRange>(12);
  const [key, setKey] = useState<string | undefined>();
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [width, setWidth] = useState(320);
  const pressX = useRef<number | null>(null);
  const sessions = exercise.state.kind === "ready" ? exercise.state.document.sessions : null;
  const graph = useMemo(
    () => workoutGraph({ today, weeks, metric, sessions: sessions ?? [], exerciseKey: key }),
    [today, weeks, metric, sessions, key],
  );
  if (exercise.state.kind !== "ready")
    return (
      <Panel>
        <JournalHeading title="Workout progress" />
        <SourceStatus name="workouts" kind={exercise.state.kind} retry={exercise.retryLoad} />
      </Panel>
    );
  const { weeks: points, latest, options } = graph;
  const selected = selectedWeek ? points.find((point) => point.date === selectedWeek) : null;
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [point.total ?? 0, point.left ?? 0, point.right ?? 0]),
  );
  // Round the axis up to a friendly step so the half line is a round number too.
  const magnitude = Math.pow(10, Math.floor(Math.log10(maximum)));
  const top =
    maximum > 1
      ? ([1, 2, 3, 4, 5, 6, 8, 10].find((step) => step * magnitude >= maximum) ?? 10) * magnitude
      : 1;
  const x = (i: number) => 42 + (i / Math.max(1, points.length - 1)) * 264;
  const y = (v: number) => 121 - (v / top) * 98;
  const number = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const series =
    graph.tracking === "sides"
      ? [
          { field: "left" as const, color: colors.protein, label: "Left" },
          { field: "right" as const, color: colors.fat, label: "Right" },
        ]
      : [{ field: "total" as const, color: colors.brand, label: "Total" }];
  // The plotted data; a change crossfades the series instead of swapping it.
  const dataKey = [
    metric,
    weeks,
    graph.exerciseKey,
    ...points.map((point) => `${point.total}/${point.left}/${point.right}`),
  ].join("|");
  const shortDate = (day: string) =>
    parseDay(day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  return (
    <Panel testID="profile-workout-chart">
      <JournalHeading
        title="Workout progress"
        leading={
          <View testID="profile-workout-icon">
            <Icon name="chart-line" size={15} color={colors.mutedForeground} />
          </View>
        }
      />
      <SegmentedControl
        label="Workout metric"
        shape="pill"
        size="small"
        options={[
          { value: "volume", label: "Volume" },
          { value: "duration", label: "Duration" },
          { value: "weight", label: "Exercise weight", short: "Weight" },
        ]}
        value={metric}
        onChange={(value) => {
          setMetric(value);
          setSelectedWeek(null);
        }}
      />
      {metric === "weight" && (
        <View style={{ zIndex: 3, alignItems: "flex-start" }}>
          {options.length ? (
            <JournalDisclosure
              align="left"
              label="Choose exercise"
              values={options.map((option) => ({
                value: option.key,
                // The mode tells apart history logged under different Tracking modes.
                label: [option.name, trackingMode(option.tracking).tag].filter(Boolean).join(" · "),
              }))}
              value={graph.exerciseKey!}
              onChange={(value) => {
                setKey(value);
                setSelectedWeek(null);
              }}
            />
          ) : (
            <AppText variant="caption" muted>
              No completed exercises yet.
            </AppText>
          )}
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: spacing.sm,
          zIndex: 2,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          {graph.tracking === "sides" ? (
            <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
              {series.map(({ field, color, label: side }) => (
                <View key={field} style={{ gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }}
                    />
                    <AppText variant="caption" muted>
                      {side}
                    </AppText>
                  </View>
                  <JournalFigure
                    size={26}
                    value={latest[field] === null ? "—" : number(latest[field])}
                    unit={latest[field] === null ? undefined : graph.unit}
                  />
                </View>
              ))}
            </View>
          ) : (
            <JournalFigure
              value={latest.total === null ? "—" : number(latest.total)}
              unit={latest.total === null ? undefined : graph.unit}
            />
          )}
          <AppText variant="caption" muted>
            Latest week
          </AppText>
        </View>
        <JournalDisclosure
          label="Workout range"
          values={([4, 12, 52] as const).map((value) => ({
            value,
            label: `${value} weeks`,
          }))}
          value={weeks}
          onChange={(value) => {
            setWeeks(value);
            setSelectedWeek(null);
          }}
        />
      </View>
      {graph.pending ? (
        <AppText
          testID="profile-workout-chart-pending"
          variant="label"
          muted
          style={{
            padding: spacing.md + 2,
            borderRadius: radius.control,
            backgroundColor: colors.muted,
            fontFamily: fonts.medium,
          }}
        >
          {graph.pending}
        </AppText>
      ) : (
        // The box keeps the drawing's aspect ratio from the first frame, so measuring its width
        // (for touch positions) never resizes the card.
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={{ width: "100%", aspectRatio: 320 / 149 }}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 320 149"
            accessibilityLabel={`Workout ${metric} in ${graph.unit}. Tap the graph for weekly values.`}
          >
            {[top, top / 2, 0].map((value) => (
              <Line
                key={value}
                x1={42}
                x2={308}
                y1={y(value)}
                y2={y(value)}
                stroke={grid}
                strokeWidth={1}
                strokeDasharray={value ? "3 4" : undefined}
              />
            ))}
            {[top, top / 2, 0].map((value) => (
              <SvgText
                key={value}
                x={32}
                y={y(value) + 4}
                textAnchor="end"
                fill={colors.mutedForeground}
                fontFamily={fonts.medium}
                fontSize={11}
              >
                {value
                  .toLocaleString(undefined, {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  })
                  .toLowerCase()}
              </SvgText>
            ))}
            {selected && (
              <Line
                x1={x(points.indexOf(selected))}
                x2={x(points.indexOf(selected))}
                y1={y(top)}
                y2={121}
                stroke={colors.mutedForeground}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            )}
            {[
              { date: points[0].date, x: 42, anchor: "start" as const },
              {
                date: points[Math.floor(points.length / 2)].date,
                x: 174,
                anchor: "middle" as const,
              },
              { date: today, x: 308, anchor: "end" as const },
            ].map((item) => (
              <SvgText
                key={item.x}
                x={item.x}
                y={143}
                textAnchor={item.anchor}
                fill={colors.mutedForeground}
                fontFamily={fonts.medium}
                fontSize={11}
              >
                {shortDate(item.date)}
              </SvgText>
            ))}
          </Svg>
          <ChartSeriesLayer dataKey={dataKey}>
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 320 149"
              aria-hidden
              {...hiddenFromAccessibility}
            >
              <Defs>
                {series.map(({ field, color }) => (
                  <LinearGradient
                    key={field}
                    id={`${gradientId}-${field}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <Stop
                      offset="0"
                      stopColor={color}
                      stopOpacity={appearance === "dark" ? 0.32 : 0.2}
                    />
                    <Stop offset="1" stopColor={color} stopOpacity={0} />
                  </LinearGradient>
                ))}
              </Defs>
              {series.map(({ field, color }) => {
                const segments: { index: number; value: number }[][] = [];
                points.forEach((point, index) => {
                  const value = point[field];
                  if (value === null) return;
                  if (!index || points[index - 1][field] === null) segments.push([]);
                  segments.at(-1)!.push({ index, value });
                });
                return segments.map((segment, index) => {
                  const first = segment[0],
                    last = segment.at(-1)!;
                  const line = segment
                    .map((p, i) => `${i ? "L" : "M"}${x(p.index)},${y(p.value)}`)
                    .join(" ");
                  return (
                    <ChartSeries
                      key={`${field}-${index}`}
                      line={line}
                      area={`${line} L${x(last.index)},121 L${x(first.index)},121 Z`}
                      color={color}
                      fill={`url(#${gradientId}-${field})`}
                      lastX={x(last.index)}
                      lastY={y(last.value)}
                      showDot={last.index === points.findLastIndex((p) => p[field] !== null)}
                      card={colors.card}
                    />
                  );
                });
              })}
              {selected &&
                series.map(({ field, color }) =>
                  selected[field] === null ? null : (
                    <Circle
                      key={`selected-${field}`}
                      cx={x(points.indexOf(selected))}
                      cy={y(selected[field]!)}
                      r={5}
                      fill={colors.card}
                      stroke={color}
                      strokeWidth={2.5}
                    />
                  ),
                )}
            </Svg>
          </ChartSeriesLayer>
          <Tappable
            label="Select workout graph point"
            hint="Tap the graph for the selected week's date and unit labels."
            feedback="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: `${(124 / 149) * 100}%`,
            }}
            onPressIn={(event) => {
              pressX.current = Number.isFinite(event.nativeEvent.locationX)
                ? event.nativeEvent.locationX
                : null;
            }}
            onPress={(event) => {
              const touchX = Number.isFinite(event.nativeEvent.locationX)
                ? event.nativeEvent.locationX
                : (pressX.current ?? width);
              pressX.current = null;
              const fraction = ((touchX / width) * 320 - 42) / 264;
              const index = Math.max(
                0,
                Math.min(points.length - 1, Math.round(fraction * (points.length - 1))),
              );
              setSelectedWeek(points[index].date);
            }}
          />
        </View>
      )}
      {selected && (
        <AppText
          variant="caption"
          selectable
          accessibilityLiveRegion="polite"
          style={{
            alignSelf: "flex-start",
            paddingVertical: 6,
            paddingHorizontal: spacing.md,
            borderRadius: radius.pill,
            backgroundColor: colors.muted,
            color: colors.foreground,
          }}
        >
          {workoutWeekLabel(graph, selected)}
        </AppText>
      )}
    </Panel>
  );
}
function ChartSeries({
  line,
  area,
  color,
  fill,
  lastX,
  lastY,
  showDot,
  card,
}: {
  line: string;
  area: string;
  color: string;
  fill: string;
  lastX: number;
  lastY: number;
  showDot: boolean;
  card: string;
}) {
  return (
    <>
      <Path d={area} fill={fill} />
      <Path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showDot && (
        <Circle cx={lastX} cy={lastY} r={4.5} fill={color} stroke={card} strokeWidth={2} />
      )}
    </>
  );
}

const hiddenFromAccessibility =
  Platform.OS === "web"
    ? {}
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants" as const,
      };

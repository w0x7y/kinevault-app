import { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { Icon } from "../components/icon";
import { FoodButton } from "../food/food-button";
import { useExercises } from "../exercise/provider";
import { useTheme } from "../theme/provider";
import { fonts } from "../theme/tokens";
import { parseDay } from "../calendar/dates";
import {
  workoutExerciseOptions,
  workoutGraph,
  type WorkoutMetric,
  type WorkoutRange,
} from "./activity";
import { chartWeeks } from "./chart-weeks";
import { ProfileChoices, SourceStatus } from "./profile-controls";
import {
  JournalDisclosure,
  JournalHeading,
  JournalPanel,
  JournalText,
} from "./journal-ui";
export function WorkoutChart({ today }: { today: string }) {
  const exercise = useExercises(),
    { colors } = useTheme();
  const [metric, setMetric] = useState<WorkoutMetric>("volume"),
    [weeks, setWeeks] = useState<WorkoutRange>(12);
  const [key, setKey] = useState<string | undefined>(),
    [date, setDate] = useState<string | null>(null),
    [all, setAll] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [width, setWidth] = useState(320);
  const pressX = useRef<number | null>(null);
  if (exercise.state.kind !== "ready")
    return (
      <JournalPanel>
        <JournalHeading title="Workout progress" />
        <SourceStatus
          name="workouts"
          kind={exercise.state.kind}
          retry={exercise.retryLoad}
        />
      </JournalPanel>
    );
  const sessions = exercise.state.document.sessions;
  const options = workoutExerciseOptions(sessions, today);
  const selectedKey = options.some((option) => option.key === key)
    ? key
    : options[0]?.key;
  const graph = workoutGraph({
    today,
    weeks,
    metric,
    sessions,
    exerciseKey: selectedKey,
  });
  const points = chartWeeks(graph.points, metric);
  const selected = selectedWeek
    ? points.find((point) => point.date === selectedWeek)
    : date
      ? graph.points.find((point) => point.date === date)
      : null;
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [
      point.total ?? 0,
      point.left ?? 0,
      point.right ?? 0,
    ]),
  );
  const top =
    maximum > 1
      ? Math.ceil(maximum / Math.pow(10, Math.floor(Math.log10(maximum)) - 1)) *
        Math.pow(10, Math.floor(Math.log10(maximum)) - 1)
      : 1;
  const x = (i: number) => 42 + (i / Math.max(1, points.length - 1)) * 264;
  const y = (v: number) => 121 - (v / top) * 98;
  const number = (v: number) =>
    v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const label = (point: (typeof graph.points)[number]) =>
    `${point.date}: ${graph.tracking === "sides" ? `Left ${point.left === null ? "not logged" : `${number(point.left)} ${graph.unit}`}, Right ${point.right === null ? "not logged" : `${number(point.right)} ${graph.unit}`}` : point.total === null ? "No measurement recorded" : `${number(point.total)} ${graph.unit}`}${point.partialDuration ? " · Some workout durations were not recorded" : ""}`;
  const series =
    graph.tracking === "sides"
      ? [
          { field: "left" as const, color: colors.protein },
          { field: "right" as const, color: colors.fat },
        ]
      : [{ field: "total" as const, color: colors.primary }];
  const latest = points.at(-1)!;
  const shortDate = (day: string) =>
    parseDay(day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  return (
    <JournalPanel testID="profile-workout-chart">
      <JournalHeading title="Workout progress">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={all ? "Hide workout data" : "Show workout data"}
          accessibilityState={{ expanded: all }}
          aria-expanded={all}
          onPress={() => setAll((v) => !v)}
          style={{
            width: 44,
            height: 44,
            marginVertical: -3,
            marginRight: -12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="chart-line" size={14} color={colors.mutedForeground} />
        </Pressable>
      </JournalHeading>
      <ProfileChoices
        label="Workout metric"
        values={[
          { value: "volume", label: "Volume" },
          { value: "duration", label: "Duration" },
          { value: "weight", label: "Exercise weight" },
        ]}
        selected={metric}
        select={(value) => {
          setMetric(value);
          setDate(null);
          setSelectedWeek(null);
        }}
      />
      {metric === "weight" && (
        <View style={{ marginTop: 12, zIndex: 3 }}>
          {options.length ? (
            <JournalDisclosure
              label="Choose exercise"
              values={options.map((option) => ({
                value: option.key,
                label: `${option.name}${option.tracking === "sides" ? " · Left / Right" : ""}`,
              }))}
              value={selectedKey!}
              onChange={(value) => {
                setKey(value);
                setDate(null);
                setSelectedWeek(null);
              }}
            />
          ) : (
            <JournalText size={10} muted>
              No completed exercises yet.
            </JournalText>
          )}
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          marginBottom: 5,
          zIndex: 2,
        }}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <JournalText size={22} lineHeight={30.8} variant="heading">
            {graph.tracking === "sides"
              ? `L ${latest.left === null ? "—" : number(latest.left)} · R ${latest.right === null ? "—" : number(latest.right)}`
              : latest.total === null
                ? "—"
                : number(latest.total)}
          </JournalText>
          <JournalText size={9} muted>
            {metric === "volume" ? "kg × reps" : graph.unit} ·{" "}
            {metric === "weight" ? "heaviest set · latest week" : "latest week"}
            {latest.partialDuration ? " · incomplete" : ""}
          </JournalText>
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
            setDate(null);
            setSelectedWeek(null);
          }}
        />
      </View>
      {graph.tracking === "sides" && (
        <View style={{ flexDirection: "row", gap: 12 }}>
          <JournalText size={10} style={{ color: colors.protein }}>
            Left
          </JournalText>
          <JournalText size={10} style={{ color: colors.fat }}>
            Right
          </JournalText>
        </View>
      )}
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <Svg
          width="100%"
          height={(width * 149) / 320}
          viewBox="0 0 320 149"
          accessibilityLabel={`Workout ${metric} in ${graph.unit}. Select a date below for values.`}
        >
          {[top, top / 2, 0].map((value) => (
            <Line
              key={value}
              x1={42}
              x2={308}
              y1={y(value)}
              y2={y(value)}
              stroke={colors.border}
            />
          ))}
          {[top, top / 2, 0].map((value) => (
            <SvgText
              key={value}
              x={2}
              y={y(value) + 3}
              fill={colors.mutedForeground}
              fontFamily={fonts.regular}
              fontSize={9}
            >
              {value
                .toLocaleString(undefined, {
                  notation: "compact",
                  maximumFractionDigits: 1,
                })
                .toLowerCase()}
            </SvgText>
          ))}
          {series.map(({ field, color }) => {
            const segments: { index: number; value: number }[][] = [];
            points.forEach((point, index) => {
              const value = point[field];
              if (value === null) return;
              if (!index || points[index - 1][field] === null)
                segments.push([]);
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
                  fill={graph.tracking === "single" ? colors.accent : color}
                  lastX={x(last.index)}
                  lastY={y(last.value)}
                  showDot={
                    last.index ===
                    points.findLastIndex((p) => p[field] !== null)
                  }
                  card={colors.card}
                />
              );
            });
          })}
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
              y={144}
              textAnchor={item.anchor}
              fill={colors.mutedForeground}
              fontFamily={fonts.regular}
              fontSize={9}
            >
              {shortDate(item.date)}
            </SvgText>
          ))}
        </Svg>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select workout graph point"
          accessibilityHint="Tap the graph, or use Show workout data for date and unit labels."
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: (width * 124) / 320,
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
              Math.min(
                points.length - 1,
                Math.round(fraction * (points.length - 1)),
              ),
            );
            setDate(null);
            setSelectedWeek(points[index].date);
          }}
        />
      </View>
      <JournalText size={9} muted style={{ marginTop: 7 }}>
        Completed workouts only
        {points.every(
          (point) =>
            point.total === null && point.left === null && point.right === null,
        )
          ? " · No measurements in this range"
          : ""}
      </JournalText>
      {selected && (
        <JournalText
          size={10}
          selectable
          accessibilityLiveRegion="polite"
          style={{ marginTop: 8 }}
        >
          {selectedWeek ? "Week ending " : ""}
          {label(selected)}
        </JournalText>
      )}
      {all && (
        <>
          <JournalText size={10} muted style={{ marginTop: 8 }}>
            Gaps mean no measurement was recorded.
          </JournalText>
          <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
            <View style={{ gap: 8 }}>
              {graph.points.map((point) => (
                <FoodButton
                  key={point.date}
                  label={label(point)}
                  selected={selected?.date === point.date}
                  onPress={() => {
                    setSelectedWeek(null);
                    setDate(point.date);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        </>
      )}
    </JournalPanel>
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
      <Path d={area} fill={fill} fillOpacity={fill === color ? 0.15 : 1} />
      <Path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showDot && (
        <Circle
          cx={lastX}
          cy={lastY}
          r={4.5}
          fill={color}
          stroke={card}
          strokeWidth={2}
        />
      )}
    </>
  );
}

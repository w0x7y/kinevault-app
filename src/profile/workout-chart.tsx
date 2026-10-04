import { Fragment, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { AppText, Panel } from "../components/ui";
import { FoodButton } from "../food/food-button";
import { useExercises } from "../exercise/provider";
import { useTheme } from "../theme/provider";
import { fonts, spacing } from "../theme/tokens";
import {
  workoutExerciseOptions,
  workoutGraph,
  type WorkoutMetric,
  type WorkoutRange,
} from "./activity";
import { ProfileChoices, SourceStatus } from "./profile-controls";
export function WorkoutChart({ today }: { today: string }) {
  const exercise = useExercises(),
    { colors } = useTheme();
  const [metric, setMetric] = useState<WorkoutMetric>("volume"),
    [weeks, setWeeks] = useState<WorkoutRange>(12);
  const [key, setKey] = useState<string | undefined>(),
    [date, setDate] = useState<string | null>(null),
    [all, setAll] = useState(false);
  const [width, setWidth] = useState(280);
  const pressX = useRef<number | null>(null);
  if (exercise.state.kind !== "ready")
    return (
      <Panel>
        <AppText variant="heading">Workout progress</AppText>
        <SourceStatus
          name="workouts"
          kind={exercise.state.kind}
          retry={exercise.retryLoad}
        />
      </Panel>
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
  const rows = graph.points.filter(
    (point) => point.total !== null || point.partialDuration,
  );
  const selected =
    graph.points.find((point) => point.date === date) ?? rows.at(-1);
  const maximum = Math.max(
    1,
    ...graph.points.flatMap((point) => [
      point.total ?? 0,
      point.left ?? 0,
      point.right ?? 0,
    ]),
  );
  const x = (index: number) =>
    36 +
    (index / Math.max(1, graph.points.length - 1)) * Math.max(1, width - 48);
  const y = (value: number) => 140 - (value / maximum) * 118;
  const number = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const label = (point: (typeof graph.points)[number]) =>
    `${point.date}: ${
      graph.tracking === "sides"
        ? `Left ${point.left === null ? "not logged" : `${number(point.left)} ${graph.unit}`}, Right ${point.right === null ? "not logged" : `${number(point.right)} ${graph.unit}`}`
        : point.total === null
          ? "No measurement recorded"
          : `${number(point.total)} ${graph.unit}`
    }${point.partialDuration ? " · Some workout durations were not recorded" : ""}`;
  const series =
    graph.tracking === "sides"
      ? [
          { field: "left" as const, color: colors.protein },
          { field: "right" as const, color: colors.fat },
        ]
      : [{ field: "total" as const, color: colors.primary }];
  return (
    <Panel testID="profile-workout-chart">
      <AppText variant="heading" accessibilityRole="header">
        Workout progress
      </AppText>
      <ProfileChoices
        label="Workout metric"
        values={(["volume", "duration", "weight"] as const).map((value) => ({
          value,
          label: value[0].toUpperCase() + value.slice(1),
        }))}
        selected={metric}
        select={(value) => {
          setMetric(value);
          setDate(null);
        }}
      />
      <ProfileChoices
        label="Workout range"
        values={([4, 12, 52] as const).map((value) => ({
          value,
          label: `${value} weeks`,
        }))}
        selected={weeks}
        select={(value) => {
          setWeeks(value);
          setDate(null);
        }}
      />
      {metric === "weight" && (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">Exercise · heaviest logged set</AppText>
          {options.length ? (
            options.map((option) => (
              <FoodButton
                key={option.key}
                label={`${option.name}${option.tracking === "sides" ? " · Left / Right" : ""}`}
                selected={selectedKey === option.key}
                onPress={() => {
                  setKey(option.key);
                  setDate(null);
                }}
              />
            ))
          ) : (
            <AppText muted>No completed exercises yet.</AppText>
          )}
        </View>
      )}
      {graph.tracking === "sides" && (
        <View style={{ flexDirection: "row", gap: spacing.layout }}>
          <AppText variant="label" style={{ color: colors.protein }}>
            Left
          </AppText>
          <AppText variant="label" style={{ color: colors.fat }}>
            Right
          </AppText>
        </View>
      )}
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <Svg
          width="100%"
          height={172}
          viewBox={`0 0 ${width} 172`}
          accessibilityLabel={`Workout ${metric} in ${graph.unit}. Select a date below for values.`}
        >
          {[0, maximum / 2, maximum].map((value) => (
            <Line
              key={value}
              x1={36}
              x2={width - 8}
              y1={y(value)}
              y2={y(value)}
              stroke={colors.border}
            />
          ))}
          <SvgText
            x={0}
            y={27}
            fill={colors.mutedForeground}
            fontFamily={fonts.regular}
            fontSize={10}
          >
            {maximum.toLocaleString(undefined, {
              notation: "compact",
              maximumFractionDigits: 1,
            })}
          </SvgText>
          <SvgText
            x={0}
            y={144}
            fill={colors.mutedForeground}
            fontFamily={fonts.regular}
            fontSize={10}
          >
            0
          </SvgText>
          {series.map(({ field, color }) =>
            graph.points.map((point, index) => {
              const value = point[field];
              if (value === null) return null;
              const previous = graph.points[index - 1]?.[field];
              return (
                <Fragment key={`${field}:${point.date}`}>
                  {previous !== null && previous !== undefined && (
                    <Line
                      x1={x(index - 1)}
                      x2={x(index)}
                      y1={y(previous)}
                      y2={y(value)}
                      stroke={color}
                      strokeWidth={2}
                    />
                  )}
                  <Circle
                    cx={x(index)}
                    cy={y(value)}
                    r={selected?.date === point.date ? 6 : 4}
                    fill={color}
                  />
                </Fragment>
              );
            }),
          )}
          <SvgText
            x={36}
            y={165}
            fill={colors.mutedForeground}
            fontFamily={fonts.regular}
            fontSize={10}
          >
            {graph.points[0].date}
          </SvgText>
          <SvgText
            x={width - 8}
            y={165}
            textAnchor="end"
            fill={colors.mutedForeground}
            fontFamily={fonts.regular}
            fontSize={10}
          >
            {today}
          </SvgText>
        </Svg>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select workout graph point"
          accessibilityHint="Tap a date on the graph, or use Show workout data for date and unit labels."
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 144,
          }}
          onPressIn={(event) => {
            pressX.current = Number.isFinite(event.nativeEvent.locationX)
              ? event.nativeEvent.locationX
              : null;
          }}
          onPress={(event) => {
            const touchX = Number.isFinite(event.nativeEvent.locationX)
              ? event.nativeEvent.locationX
              : (pressX.current ?? width - 12);
            pressX.current = null;
            const fraction = Number.isFinite(touchX)
              ? (touchX - 36) / Math.max(1, width - 48)
              : 1;
            const index = Math.max(
              0,
              Math.min(
                graph.points.length - 1,
                Math.round(fraction * (graph.points.length - 1)),
              ),
            );
            setDate(graph.points[index].date);
          }}
        />
      </View>
      {rows.length === 0 && (
        <AppText muted>
          No{" "}
          {metric === "weight"
            ? "positive weight measurements"
            : "completed workout measurements"}{" "}
          in this range.
        </AppText>
      )}
      {selected && (
        <AppText accessibilityLiveRegion="polite" selectable>
          {label(selected)}
        </AppText>
      )}
      <AppText variant="caption" muted>
        {graph.unit} · Completed workouts only. Gaps mean no measurement was
        recorded.
      </AppText>
      <FoodButton
        label={all ? "Hide workout data" : "Show workout data"}
        expanded={all}
        onPress={() => setAll((value) => !value)}
      />
      {all && (
        <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
          <View style={{ gap: spacing.sm }}>
            {graph.points.map((point) => (
              <FoodButton
                key={point.date}
                label={label(point)}
                selected={selected?.date === point.date}
                onPress={() => setDate(point.date)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </Panel>
  );
}

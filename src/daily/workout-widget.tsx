import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon, type IconName } from "../components/icon";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { CompletedWorkout } from "./workout";
import { Pressable } from "react-native";

export function WorkoutWidget({ workout, detailed = false, query = "", sourceState = "ready", onRetry }: {
  workout: CompletedWorkout;
  detailed?: boolean;
  query?: string;
  sourceState?: "ready" | "loading" | "error";
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const stats: { label: string; value: string; icon: IconName }[] = [
    { label: "Total lifted", value: `${workout.volume.toLocaleString()} kg`, icon: "weight-hanging" },
    { label: workout.durationKnown === undefined ? "Duration" : "Recorded duration", value: workout.durationKnown === false ? "Not recorded" : `${Math.floor(workout.durationSeconds / 60)} min`, icon: "stopwatch" },
    { label: "Sets", value: String(workout.sets), icon: "layer-group" },
    { label: "Reps", value: String(workout.reps), icon: "repeat" },
    ...(detailed ? [
      { label: "Exercises", value: String(workout.exercises.length), icon: "dumbbell" as const },
      { label: "Avg. per set", value: `${workout.averageRepsPerSet} reps`, icon: "chart-simple" as const },
    ] : []),
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const exercises = workout.exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(normalizedQuery),
  );
  if (sourceState !== "ready") return (
    <Panel testID={detailed ? "exercise-workout" : "home-workout"}>
      <AppText variant="heading">Workouts</AppText>
      <AppText accessibilityRole={sourceState === "error" ? "alert" : undefined}>
        {sourceState === "loading" ? "Loading your workouts..." : "Couldn't load your workouts."}
      </AppText>
      {sourceState === "error" && onRetry && <Pressable accessibilityRole="button" accessibilityLabel="Retry workouts"
        onPress={onRetry} style={{ minHeight: 44, justifyContent: "center" }}>
        <AppText variant="label" style={{ color: colors.primary }}>Retry workouts</AppText>
      </Pressable>}
    </Panel>
  );
  return (
    <Panel testID={detailed ? "exercise-workout" : "home-workout"} style={{ padding: spacing.layout, gap: spacing.layout }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.layout }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="heading" accessibilityRole="header">{workout.name ?? "Workout of the day"}</AppText>
          <AppText variant="caption" muted>{workout.name !== null ? "Your session summary" : "No workout logged"}</AppText>
        </View>
        <Icon name="dumbbell" size={20} color={colors.primary} style={{ alignSelf: "flex-start", marginTop: 4 }} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing.layout }}>
        {stats.map(({ label, value, icon }) => (
          <View key={label} style={{ width: "50%", gap: 4, paddingRight: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name={icon} size={12} color={colors.mutedForeground} />
              <AppText variant="caption" muted>{label}</AppText>
            </View>
            <AppText selectable variant="heading" style={{ fontVariant: ["tabular-nums"] }}>{value}</AppText>
          </View>
        ))}
      </View>
      {detailed && (
        <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.layout, gap: spacing.layout }}>
          <AppText variant="label" accessibilityRole="header">Completed exercises</AppText>
          <View style={{ flexDirection: "row", gap: spacing.layout }}>
            <AppText variant="caption" muted style={{ flex: 1 }}>Sets</AppText>
            <AppText variant="caption" muted style={{ flex: 1 }}>Reps</AppText>
            <AppText variant="caption" muted style={{ flex: 2 }}>Weight</AppText>
          </View>
          {exercises.map((exercise) => {
            let weight: string;
            switch (exercise.load.kind) {
              case "bodyweight":
                weight = "Bodyweight";
                break;
              case "weight":
                weight = `${exercise.load.weightKg.toLocaleString()} kg`;
                break;
              case "range":
                weight = `${exercise.load.minKg.toLocaleString()}–${exercise.load.maxKg.toLocaleString()} kg`;
                break;
              default: {
                const unreachable: never = exercise.load;
                return unreachable;
              }
            }
            return (
              <View key={exercise.id} style={{ gap: spacing.layout, paddingTop: spacing.layout, borderTopWidth: 1, borderColor: colors.border }}>
                <AppText variant="label">{exercise.name}</AppText>
                <View style={{ flexDirection: "row", gap: spacing.layout }}>
                  <AppText variant="label" accessibilityLabel={`${exercise.name}, ${exercise.sets} sets`} style={{ flex: 1 }}>{exercise.sets}</AppText>
                  <AppText variant="label" accessibilityLabel={`${exercise.name}, ${exercise.reps} reps`} style={{ flex: 1 }}>{exercise.reps}</AppText>
                  <AppText variant="label" accessibilityLabel={`${exercise.name}, weight ${weight}`} style={{ flex: 2 }}>{weight}</AppText>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

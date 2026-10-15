import { Pressable, View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import type { CompletedWorkout } from "./workout";

export function WorkoutWidget({
  workout,
  detailed = false,
  query = "",
  sourceState = "ready",
  onRetry,
  showEmptyGuidance = false,
  activeWorkoutName,
  onAddWorkout,
}: {
  workout: CompletedWorkout;
  detailed?: boolean;
  query?: string;
  sourceState?: "ready" | "loading" | "error";
  onRetry?: () => void;
  showEmptyGuidance?: boolean;
  activeWorkoutName?: string;
  onAddWorkout?: () => void;
}) {
  const { colors } = useTheme();
  const stats: { label: string; value: string }[] = [
    {
      label: "Total lifted",
      value: `${workout.volume.toLocaleString()} kg`,
    },
    {
      label: "Duration",
      value:
        activeWorkoutName && workout.name === null
          ? "In progress"
          : workout.durationKnown === false
            ? "Not recorded"
            : `${Math.floor(workout.durationSeconds / 60)} min`,
    },
    { label: "Sets", value: String(workout.sets) },
    { label: "Reps", value: String(workout.reps) },
    ...(detailed
      ? [
          {
            label: "Exercises",
            value: String(workout.exercises.length),
          },
          {
            label: "Avg. per set",
            value: `${workout.averageRepsPerSet} reps`,
          },
        ]
      : []),
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const exercises = workout.exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(normalizedQuery),
  );
  if (sourceState !== "ready")
    return (
      <Panel testID={detailed ? "exercise-workout" : "home-workout"}>
        <AppText variant="heading">Workouts</AppText>
        <AppText accessibilityRole={sourceState === "error" ? "alert" : undefined}>
          {sourceState === "loading" ? "Loading your workouts..." : "Couldn't load your workouts."}
        </AppText>
        {sourceState === "error" && onRetry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry workouts"
            onPress={onRetry}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <AppText variant="label" style={{ color: colors.primary }}>
              Retry workouts
            </AppText>
          </Pressable>
        )}
      </Panel>
    );
  if (showEmptyGuidance && workout.name === null && !activeWorkoutName)
    return (
      <Panel testID={detailed ? "exercise-workout-empty" : "home-workout-empty"}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add workout"
          accessibilityHint="Opens the saved workout menu"
          disabled={!onAddWorkout}
          accessibilityState={{ disabled: !onAddWorkout }}
          onPress={onAddWorkout}
          style={({ pressed }) => ({
            minHeight: 44,
            padding: spacing.layout,
            borderRadius: radius.control,
            backgroundColor: pressed ? colors.accent : colors.secondary,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
          })}
        >
          <Icon name="circle-plus" size={14} color={colors.secondaryForeground} />
          <AppText variant="label" style={{ color: colors.secondaryForeground }}>
            Add workout
          </AppText>
        </Pressable>
      </Panel>
    );
  const [lead, ...rest] = stats;
  return (
    <Panel
      testID={detailed ? "exercise-workout" : "home-workout"}
      style={{ padding: spacing.layout, gap: spacing.layout }}
    >
      <View style={{ gap: 2 }}>
        <AppText variant="heading" accessibilityRole="header">
          {workout.name ?? activeWorkoutName ?? "Workout of the day"}
        </AppText>
        {workout.name === null && (
          <AppText variant="caption" muted>
            {activeWorkoutName ? "Workout in progress" : "No workout logged"}
          </AppText>
        )}
      </View>
      <View style={{ gap: 2 }}>
        <AppText variant="caption" muted>
          {lead.label}
        </AppText>
        <AppText selectable variant="title" numeric>
          {lead.value}
        </AppText>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing.layout }}>
        {rest.map(({ label, value }) => (
          <View key={label} style={{ width: "33.33%", gap: 2, paddingRight: 6 }}>
            <AppText variant="caption" muted>
              {label}
            </AppText>
            <AppText selectable variant="label" style={{ fontSize: 16, lineHeight: 22 }}>
              {value}
            </AppText>
          </View>
        ))}
      </View>
      {detailed && workout.exercises.length > 0 && (
        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: spacing.layout,
            gap: spacing.layout,
          }}
        >
          <AppText variant="label" accessibilityRole="header">
            Completed exercises
          </AppText>
          <View style={{ flexDirection: "row", gap: spacing.layout }}>
            <AppText variant="caption" muted style={{ flex: 1 }}>
              Sets
            </AppText>
            <AppText variant="caption" muted style={{ flex: 1 }}>
              Reps
            </AppText>
            <AppText variant="caption" muted style={{ flex: 2 }}>
              Weight
            </AppText>
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
              <View
                key={exercise.id}
                style={{
                  gap: spacing.layout,
                  paddingTop: spacing.layout,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <AppText variant="label">{exercise.name}</AppText>
                <View style={{ flexDirection: "row", gap: spacing.layout }}>
                  <AppText
                    variant="label"
                    accessibilityLabel={`${exercise.name}, ${exercise.sets} sets`}
                    style={{ flex: 1 }}
                  >
                    {exercise.sets}
                  </AppText>
                  <AppText
                    variant="label"
                    accessibilityLabel={`${exercise.name}, ${exercise.reps} reps`}
                    style={{ flex: 1 }}
                  >
                    {exercise.reps}
                  </AppText>
                  <AppText
                    variant="label"
                    accessibilityLabel={`${exercise.name}, weight ${weight}`}
                    style={{ flex: 2 }}
                  >
                    {weight}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

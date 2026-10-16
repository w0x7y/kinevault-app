import { View } from "react-native";
import { AppButton } from "../components/button";
import { LoadFailure } from "../components/load-failure";
import { AppText, Overline, Panel } from "../components/ui";
import { Icon, type IconName } from "../components/icon";
import { IconWell } from "../components/icon-well";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { LiveDot } from "../exercise/timer";
import type { CompletedWorkout } from "./workout";

/** A day's completed training in one line: volume when weights were logged, then duration. */
export function workoutSummary(
  workout: CompletedWorkout,
  sourceState: "ready" | "loading" | "error",
): string | null {
  if (sourceState !== "ready") return null;
  if (workout.sets === 0) return "No workouts yet";
  const parts = [
    workout.volume > 0
      ? `${Math.round(workout.volume).toLocaleString()} kg`
      : `${workout.sets} ${workout.sets === 1 ? "set" : "sets"}`,
  ];
  if (workout.durationKnown && workout.durationSeconds > 0)
    parts.push(`${Math.round(workout.durationSeconds / 60)} min`);
  return parts.join(" · ");
}

/** "WORKOUT" with a small status chip on the right. */
function WidgetTop({ status }: { status?: { label: string; icon?: IconName; live?: boolean } }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 26,
        gap: spacing.sm,
      }}
    >
      <Overline>Workout</Overline>
      {status && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: colors.muted,
          }}
        >
          {status.live ? (
            <LiveDot color={colors.success} />
          ) : (
            status.icon && <Icon name={status.icon} size={13} color={colors.primary} />
          )}
          <AppText variant="caption" style={{ fontFamily: fonts.bold, fontSize: 12 }}>
            {status.label}
          </AppText>
        </View>
      )}
    </View>
  );
}

export function WorkoutWidget({
  workout,
  detailed = false,
  sourceState = "ready",
  onRetry,
  showEmptyGuidance = false,
  activeWorkoutName,
  onAddWorkout,
}: {
  workout: CompletedWorkout;
  detailed?: boolean;
  sourceState?: "ready" | "loading" | "error";
  onRetry: () => void;
  showEmptyGuidance?: boolean;
  activeWorkoutName?: string;
  onAddWorkout?: () => void;
}) {
  const { colors } = useTheme();
  const testID = detailed ? "exercise-workout" : "home-workout";
  const stats: { label: string; value: string }[] = [
    {
      label: "Duration",
      value:
        workout.durationKnown === false
          ? "Not recorded"
          : `${Math.floor(workout.durationSeconds / 60)} min`,
    },
    { label: "Sets", value: String(workout.sets) },
    { label: "Reps", value: String(workout.reps) },
  ];
  if (sourceState !== "ready")
    return (
      <Panel testID={testID}>
        <WidgetTop />
        {sourceState === "loading" ? (
          <AppText variant="label" muted>
            Loading your workouts...
          </AppText>
        ) : (
          <LoadFailure
            message="Couldn't load your workouts."
            retryLabel="Retry workouts"
            onRetry={onRetry}
          />
        )}
      </Panel>
    );
  if (showEmptyGuidance && workout.name === null && !activeWorkoutName)
    return (
      <Panel testID={detailed ? "exercise-workout-empty" : "home-workout-empty"}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconWell icon="dumbbell" color={colors.primary} size="large" />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Overline>Workout</Overline>
            <AppText variant="label" muted>
              Nothing logged yet today.
            </AppText>
          </View>
        </View>
        <AppButton
          label="Add workout"
          icon="plus"
          accessibilityHint="Opens the saved workout menu"
          disabled={!onAddWorkout}
          onPress={() => onAddWorkout?.()}
        />
      </Panel>
    );
  // A workout under way with nothing completed yet: its totals arrive when it ends.
  if (workout.name === null && activeWorkoutName)
    return (
      <Panel testID={testID} style={{ gap: spacing.sm }}>
        <WidgetTop status={{ label: "Live", live: true }} />
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }}
        >
          {activeWorkoutName}
        </AppText>
        <AppText variant="caption" muted>
          Workout in progress. Totals appear here when you end it.
        </AppText>
      </Panel>
    );
  const lifted = workout.volume.toLocaleString();
  return (
    <Panel testID={testID} style={{ gap: spacing.layout }}>
      <View style={{ gap: spacing.xs }}>
        <WidgetTop
          status={
            workout.name !== null
              ? activeWorkoutName
                ? { label: "Live", live: true }
                : { label: "Done", icon: "check" }
              : undefined
          }
        />
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }}
        >
          {workout.name ?? activeWorkoutName ?? "Workout of the day"}
        </AppText>
      </View>
      <View style={{ gap: 0 }}>
        <AppText variant="caption" muted>
          Total lifted
        </AppText>
        <AppText selectable variant="hero" style={{ fontSize: 38, lineHeight: 44 }}>
          {lifted}
          <AppText
            variant="heading"
            muted
            style={{ fontFamily: fonts.bold, fontSize: 18, letterSpacing: 0 }}
          >
            {" kg"}
          </AppText>
        </AppText>
        {detailed && (
          <AppText variant="caption" muted>
            <AppText variant="caption" muted>
              {String(workout.exercises.length)}
            </AppText>
            {workout.exercises.length === 1 ? " exercise · " : " exercises · "}
            <AppText variant="caption" muted>
              {`${workout.averageRepsPerSet} reps`}
            </AppText>
            {" per set on average"}
          </AppText>
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderColor: colors.border,
        }}
      >
        {stats.map(({ label, value }, index) => (
          <View
            key={label}
            style={{
              flex: 1,
              minWidth: 0,
              gap: 2,
              paddingLeft: index ? spacing.md : 0,
              borderLeftWidth: index ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            <AppText variant="caption" muted>
              {label}
            </AppText>
            <AppText
              selectable
              variant="label"
              style={{
                fontFamily: fonts.extrabold,
                fontSize: 17,
                lineHeight: 23,
                fontVariant: ["tabular-nums"],
              }}
            >
              {value}
            </AppText>
          </View>
        ))}
      </View>
      {detailed && workout.exercises.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          <Overline style={{ marginTop: spacing.xs }}>Exercises</Overline>
          {workout.exercises.map((exercise, index) => {
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
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  borderTopWidth: index ? 1 : 0,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <AppText variant="label" style={{ fontSize: 15, lineHeight: 21 }}>
                    {exercise.name}
                  </AppText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 6 }}>
                    <AppText
                      variant="caption"
                      muted
                      accessibilityLabel={`${exercise.name}, ${exercise.sets} sets`}
                    >
                      {exercise.sets === 1 ? "1 set" : `${exercise.sets} sets`}
                    </AppText>
                    <AppText variant="caption" muted aria-hidden>
                      ·
                    </AppText>
                    <AppText
                      variant="caption"
                      muted
                      accessibilityLabel={`${exercise.name}, ${exercise.reps} reps`}
                    >
                      {exercise.reps === 1 ? "1 rep" : `${exercise.reps} reps`}
                    </AppText>
                  </View>
                </View>
                <AppText
                  variant="label"
                  accessibilityLabel={`${exercise.name}, weight ${weight}`}
                  style={{ fontFamily: fonts.bold, fontVariant: ["tabular-nums"] }}
                >
                  {weight}
                </AppText>
              </View>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

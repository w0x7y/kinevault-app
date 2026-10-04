import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { useFoodLog } from "../food/log-provider";
import { useWaterLog } from "../water/provider";
import { useExercises } from "../exercise/provider";
import { parseDay } from "../calendar/dates";
import { profileStreak } from "./activity";
import { SourceStatus } from "./profile-controls";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
export function ProfileStreak({ today }: { today: string }) {
  const food = useFoodLog(),
    water = useWaterLog(),
    exercise = useExercises();
  const { colors } = useTheme();
  const ready =
    food.state.kind === "ready" &&
    water.state.kind === "ready" &&
    exercise.state.kind === "ready";
  const streak =
    food.state.kind === "ready" &&
    water.state.kind === "ready" &&
    exercise.state.kind === "ready"
      ? profileStreak({
          today,
          food: food.state.document,
          water: water.state.document,
          sessions: exercise.state.document.sessions,
        })
      : null;
  return (
    <Panel testID="profile-streak">
      <AppText variant="heading" accessibilityRole="header">
        Tracking streaks
      </AppText>
      {!ready && (
        <AppText muted>
          Streaks will appear when all activity records are available.
        </AppText>
      )}
      {food.state.kind !== "ready" && (
        <SourceStatus
          name="food log"
          kind={food.state.kind}
          retry={food.retryLoad}
        />
      )}
      {water.state.kind !== "ready" && (
        <SourceStatus
          name="water log"
          kind={water.state.kind}
          retry={water.retryLoad}
        />
      )}
      {exercise.state.kind !== "ready" && (
        <SourceStatus
          name="workouts"
          kind={exercise.state.kind}
          retry={exercise.retryLoad}
        />
      )}
      {streak && (
        <>
          <View style={{ flexDirection: "row", gap: spacing.layout }}>
            {(
              [
                {
                  label: "Current streak",
                  value: streak.current,
                  icon: "fire",
                },
                {
                  label: "Longest streak",
                  value: streak.longest,
                  icon: "trophy",
                },
              ] as const
            ).map((item) => (
              <View key={item.label} style={{ flex: 1, gap: spacing.xs }}>
                <Icon name={item.icon} size={20} color={colors.primary} />
                <AppText variant="heading">
                  {item.value} {item.value === 1 ? "day" : "days"}
                </AppText>
                <AppText variant="caption" muted>
                  {item.label}
                </AppText>
              </View>
            ))}
          </View>
          <View
            testID="streak-week"
            style={{ flexDirection: "row", gap: spacing.xs }}
          >
            {streak.week.map((day) => (
              <View
                key={day.date}
                testID={`streak-day-${day.date}`}
                accessible
                accessibilityLabel={`${day.date}: ${day.logged ? "Activity logged" : "No activity logged"}`}
                style={{
                  flex: 1,
                  gap: spacing.xs,
                  alignItems: "center",
                  paddingVertical: spacing.sm,
                  borderRadius: 10,
                  backgroundColor: day.logged
                    ? colors.accent
                    : colors.background,
                }}
              >
                <AppText variant="caption" muted>
                  {parseDay(day.date).toLocaleDateString(undefined, {
                    weekday: "narrow",
                  })}
                </AppText>
                <AppText variant="label">
                  {parseDay(day.date).getDate()}
                </AppText>
                <Icon
                  name={day.logged ? "check" : "minus"}
                  size={12}
                  color={colors.primary}
                />
              </View>
            ))}
          </View>
          <AppText variant="caption" muted>
            Food, water, or a completed workout counts as a logged day.
          </AppText>
        </>
      )}
    </Panel>
  );
}

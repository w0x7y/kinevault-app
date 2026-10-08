import { View } from "react-native";
import { Icon } from "../components/icon";
import { useFoodLog } from "../food/log-provider";
import { useWaterLog } from "../water/provider";
import { useExercises } from "../exercise/provider";
import { parseDay } from "../calendar/dates";
import { profileStreak } from "./activity";
import { SourceStatus } from "./profile-controls";
import { useTheme } from "../theme/provider";
import { JournalPanel, JournalText } from "./journal-ui";
export function ProfileStreak({ today }: { today: string }) {
  const food = useFoodLog(),
    water = useWaterLog(),
    exercise = useExercises();
  const { colors } = useTheme();
  const streak =
    food.state.kind === "ready" && water.state.kind === "ready" && exercise.state.kind === "ready"
      ? profileStreak({
          today,
          food: food.state.document,
          water: water.state.document,
          sessions: exercise.state.document.sessions,
        })
      : null;
  return (
    <JournalPanel testID="profile-streak" accessibilityLabel="Tracking streaks">
      {food.state.kind !== "ready" && (
        <SourceStatus name="food log" kind={food.state.kind} retry={food.retryLoad} />
      )}
      {water.state.kind !== "ready" && (
        <SourceStatus name="water log" kind={water.state.kind} retry={water.retryLoad} />
      )}
      {exercise.state.kind !== "ready" && (
        <SourceStatus name="workouts" kind={exercise.state.kind} retry={exercise.retryLoad} />
      )}
      {streak && (
        <>
          <View style={{ flexDirection: "row", gap: 12 }}>
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
            ).map((item, i) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  ...(i
                    ? {
                        borderLeftWidth: 1,
                        borderColor: colors.border,
                        paddingLeft: 12,
                      }
                    : {}),
                }}
              >
                <Icon name={item.icon} size={18} color={colors.primary} />
                <View>
                  <JournalText size={18} variant="heading">
                    {item.value}
                    <JournalText size={10}> {item.value === 1 ? "day" : "days"}</JournalText>
                  </JournalText>
                  <JournalText size={10} muted>
                    {item.label}
                  </JournalText>
                </View>
              </View>
            ))}
          </View>
          <View
            testID="streak-week"
            style={{
              flexDirection: "row",
              gap: 5,
              marginTop: 15,
              marginBottom: 8,
            }}
          >
            {streak.week.map((day) => (
              <View
                key={day.date}
                testID={`streak-day-${day.date}`}
                accessible
                accessibilityLabel={`${day.date}: ${day.logged ? "Activity logged" : "No activity logged"}`}
                style={{ flex: 1, gap: 6, alignItems: "center" }}
              >
                <JournalText size={9} muted>
                  {day.date === today
                    ? "Today"
                    : parseDay(day.date).toLocaleDateString(undefined, {
                        weekday: "narrow",
                      })}
                </JournalText>
                <View
                  style={{
                    width: 35,
                    height: 35,
                    marginVertical: -4,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 18,
                    borderWidth: day.date === today ? 1 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <View
                    style={{
                      width: 27,
                      height: 27,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: day.logged ? colors.primary : colors.secondary,
                    }}
                  >
                    <Icon
                      name={day.logged ? "check" : "minus"}
                      size={10}
                      color={day.logged ? colors.primaryForeground : colors.mutedForeground}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </JournalPanel>
  );
}

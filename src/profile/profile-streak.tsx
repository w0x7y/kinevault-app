import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useAppear } from "../components/motion";
import { Icon } from "../components/icon";
import { useFoodLog } from "../food/log-provider";
import { useWaterLog } from "../water/provider";
import { useExercises } from "../exercise/provider";
import { parseDay } from "../calendar/dates";
import { profileStreak } from "./activity";
import { SourceStatus } from "./profile-controls";
import { useTheme } from "../theme/provider";
import { AppText, Panel } from "../components/ui";
import { fonts, radius, spacing } from "../theme/tokens";
import { JournalHeading } from "./journal-ui";
export function ProfileStreak({ today }: { today: string }) {
  const food = useFoodLog(),
    water = useWaterLog(),
    exercise = useExercises();
  const { colors } = useTheme();
  const streak = useMemo(
    () =>
      food.state.kind === "ready" && water.state.kind === "ready" && exercise.state.kind === "ready"
        ? profileStreak({
            today,
            food: food.state.document,
            water: water.state.document,
            sessions: exercise.state.document.sessions,
          })
        : null,
    [today, food.state, water.state, exercise.state],
  );
  return (
    <Panel testID="profile-streak" accessibilityLabel="Tracking streaks">
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
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <JournalHeading
                title="Current streak"
                leading={<Icon name="fire" size={15} color={colors.mutedForeground} />}
              />
              <AppText variant="hero">
                {streak.current}
                <AppText variant="heading" muted style={{ fontFamily: fonts.semibold }}>
                  {streak.current === 1 ? " day" : " days"}
                </AppText>
              </AppText>
            </View>
            <View
              style={{
                alignItems: "flex-end",
                gap: 2,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.control,
                backgroundColor: colors.muted,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Icon name="trophy" size={13} color={colors.mutedForeground} />
                <AppText variant="caption" muted>
                  Longest
                </AppText>
              </View>
              <AppText variant="label" numeric style={{ fontSize: 15 }}>
                {streak.longest}
                <AppText variant="caption" muted>
                  {streak.longest === 1 ? " day" : " days"}
                </AppText>
              </AppText>
            </View>
          </View>
          <View
            testID="streak-week"
            style={{ flexDirection: "row", gap: 4, marginTop: spacing.xs }}
          >
            {streak.week.map((day, index) => {
              const isToday = day.date === today;
              return (
                <View
                  key={day.date}
                  testID={`streak-day-${day.date}`}
                  accessible
                  accessibilityLabel={`${day.date}: ${day.logged ? "Activity logged" : "No activity logged"}`}
                  style={{ flex: 1, gap: 6, alignItems: "center" }}
                >
                  <AppText
                    variant="overline"
                    muted={!isToday}
                    style={{ letterSpacing: 0.6, textTransform: "none" }}
                  >
                    {isToday
                      ? "Today"
                      : parseDay(day.date).toLocaleDateString(undefined, { weekday: "narrow" })}
                  </AppText>
                  <View
                    style={{
                      width: "100%",
                      maxWidth: 38,
                      aspectRatio: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radius.pill,
                      borderWidth: isToday ? 2 : 0,
                      borderColor: colors.primary,
                    }}
                  >
                    <StreakDot
                      // A day that becomes logged remounts, so its check pops in.
                      key={day.logged ? "done" : "open"}
                      logged={day.logged}
                      today={isToday}
                      index={index}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Panel>
  );
}

/** A day's dot. Logged days fill in left to right as the card appears. */
function StreakDot({ logged, today, index }: { logged: boolean; today: boolean; index: number }) {
  const { colors } = useTheme();
  const appear = useAppear("pop", { duration: 240, delay: index * 40 });
  return (
    <Animated.View
      style={[
        {
          width: today ? "74%" : "84%",
          aspectRatio: 1,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: logged ? colors.primary : colors.muted,
        },
        logged && appear,
      ]}
    >
      {logged && <Icon name="check" size={15} color={colors.primaryForeground} />}
    </Animated.View>
  );
}

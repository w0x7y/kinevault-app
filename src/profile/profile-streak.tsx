import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useAppear } from "../components/motion";
import { Icon } from "../components/icon";
import { parseDay } from "../calendar/dates";
import { useDayActivity } from "../daily/use-day";
import { SourceStatus } from "./profile-controls";
import { useTheme } from "../theme/provider";
import { AppText, Panel } from "../components/ui";
import { fonts, radius, spacing } from "../theme/tokens";
import { JournalHeading } from "./journal-ui";
export function ProfileStreak({ today }: { today: string }) {
  const activity = useDayActivity({ date: today });
  const { food, water, workouts } = activity.sources;
  const { colors } = useTheme();
  // Counted once per Daily activity, which only changes with its sources.
  const streak = activity.streak();
  return (
    <Panel testID="profile-streak" accessibilityLabel="Tracking streaks">
      {food.kind !== "ready" && (
        <SourceStatus name="food log" kind={food.kind} retry={food.retry} />
      )}
      {water.kind !== "ready" && (
        <SourceStatus name="water log" kind={water.kind} retry={water.retry} />
      )}
      {workouts.kind !== "ready" && (
        <SourceStatus name="workouts" kind={workouts.kind} retry={workouts.retry} />
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

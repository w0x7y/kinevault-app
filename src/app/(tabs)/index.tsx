import { useEffect, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { useIsFocused, useRouter } from "expo-router";
import { routeRequest } from "../../navigation/track-tabs";
import { View, useWindowDimensions } from "react-native";
import { AppText, Screen } from "../../components/ui";
import { Kine } from "../../onboarding/kine";
import { useDayActivity } from "../../daily/use-day";
import { NutritionWidget } from "../../daily/nutrition-widget";
import { CalorieRing, CalorieWidget } from "../../daily/calorie-widget";
import { WorkoutWidget } from "../../daily/workout-widget";
import { ActivityWidgets } from "../../daily/activity-widgets";
import { FoodLogStatus } from "../../food/log-status";
import { WaterEntryModal } from "../../water/entry-modal";
import { StepsEntryModal } from "../../steps/entry-modal";
import { useProfile } from "../../profile/provider";
import { useSelectedDay } from "../../calendar/provider";
import { parseDay } from "../../calendar/dates";
import { spacing } from "../../theme/tokens";
import { useLayoutMotion } from "../../components/motion";

export default function HomeScreen() {
  const router = useRouter();
  const activity = useDayActivity({ phoneSteps: true });
  const { width } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(0);
  const [waterEntryDay, setWaterEntryDay] = useState<string | null>(null);
  const [stepsEntryDay, setStepsEntryDay] = useState<string | null>(null);
  useEffect(() => {
    setWaterEntryDay(null);
    setStepsEntryDay(null);
  }, [activity.date]);
  const { targets } = activity;
  const motion = useLayoutMotion();
  // The cards rise in once, the first time Home has data to show. Later mounts (the calorie card
  // replacing its loader, a remount after a retry) fade or appear in place, and day changes keep
  // the same cards, so browsing days never replays the entrance.
  const arrived = useRef(false);
  const ready = targets.kind === "ready";
  useEffect(() => {
    if (ready) arrived.current = true;
  }, [ready]);
  if (!ready) return null;
  const enter = (index: number) => (arrived.current ? undefined : motion.enter(index));
  const { nutrition } = activity;
  // The ring sits beside the macro rows; narrow phones get a smaller ring so the rows keep
  // room for their figures.
  const cardInner =
    (contentWidth || Math.max(0, Math.min(width, 768) - spacing.gutter * 2)) - spacing.card * 2;
  const ringSize = cardInner >= 300 ? 132 : cardInner >= 260 ? 112 : 96;
  return (
    <Screen title="Home" showTitle={false}>
      <Animated.View
        entering={enter(0)}
        onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
      >
        <Greeting foodLoading={activity.food.kind === "loading"} />
      </Animated.View>
      {nutrition ? (
        <Animated.View key="calories" entering={arrived.current ? motion.fade : enter(1)}>
          <CalorieWidget calories={nutrition.calories}>
            <View
              testID="home-nutrition-row"
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.card }}
            >
              <CalorieRing
                testID="home-calorie-hero"
                calories={nutrition.calories}
                size={ringSize}
              />
              <NutritionWidget width={cardInner - ringSize - spacing.card} nutrition={nutrition} />
            </View>
          </CalorieWidget>
        </Animated.View>
      ) : (
        <Animated.View key="food-status" entering={enter(1)}>
          <FoodLogStatus />
        </Animated.View>
      )}
      <Animated.View entering={enter(2)}>
        <ActivityWidgets
          steps={activity.steps.tile}
          water={activity.water}
          onLogSteps={() => setStepsEntryDay(activity.date)}
          onAddWater={() => setWaterEntryDay(activity.date)}
        />
      </Animated.View>
      <Animated.View entering={enter(3)}>
        <WorkoutWidget
          workout={activity.workout}
          sourceState={activity.workoutState}
          onRetry={activity.sources.workouts.retry}
          showEmptyGuidance
          activeWorkoutName={activity.activeWorkoutName}
          onAddWorkout={() => router.push(routeRequest("workoutMenu", activity.date))}
        />
      </Animated.View>
      {stepsEntryDay === activity.date && (
        <StepsEntryModal
          key={stepsEntryDay}
          date={stepsEntryDay}
          phone={activity.steps.phone}
          onDismiss={() =>
            setStepsEntryDay((current) => (current === stepsEntryDay ? null : current))
          }
        />
      )}
      {waterEntryDay === activity.date && (
        <WaterEntryModal
          key={waterEntryDay}
          date={waterEntryDay}
          onDismiss={() =>
            setWaterEntryDay((current) => (current === waterEntryDay ? null : current))
          }
        />
      )}
    </Screen>
  );
}

/** Today greets on one line and names the person, larger, on the next; other days are titled
 * by their weekday. */
function Greeting({ foodLoading }: { foodLoading: boolean }) {
  const { selectedDay, today } = useSelectedDay();
  const profile = useProfile();
  const first =
    profile.state.kind === "ready"
      ? profile.state.document.answers.name.trim().split(/\s+/)[0]
      : "";
  const name = first ? first[0]!.toUpperCase() + first.slice(1) : "";
  const narrow = useWindowDimensions().width < 360;
  // Re-renders on focus so returning to Home past noon or 6 pm updates the time of day.
  useIsFocused();
  let greeting: string;
  if (selectedDay === today) {
    const hour = new Date().getHours();
    const part =
      hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "evening";
    greeting = `Good ${part}`;
  } else {
    greeting = parseDay(selectedDay).toLocaleDateString(undefined, { weekday: "long" });
  }
  const showName = selectedDay === today && name !== "";
  return (
    <View
      testID="home-greeting"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingTop: spacing.sm,
      }}
    >
      <AppText
        variant="title"
        accessibilityRole="header"
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: narrow ? 22 : 24,
          lineHeight: narrow ? 30 : 32,
          letterSpacing: -0.6,
        }}
      >
        {showName ? `${greeting},` : greeting}
        {showName && (
          <AppText
            variant="title"
            style={{
              fontSize: narrow ? 30 : 34,
              lineHeight: narrow ? 38 : 44,
              letterSpacing: -1,
            }}
          >
            {`\n${name}`}
          </AppText>
        )}
      </AppText>
      {/* While the food log loads, the loading card below carries Kine instead. */}
      {!foodLoading && <Kine pose="today" size={narrow ? 84 : 96} />}
    </View>
  );
}

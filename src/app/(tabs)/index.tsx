import { useEffect, useState } from "react";
import { Screen } from "../../components/ui";
import { KineSplitRow } from "../../components/kine-split-row";
import { useProfile } from "../../profile/provider";
import { calorieState } from "../../profile/calories";
import { macroTargets } from "../../profile/macros";
import { useDayActivity } from "../../daily/use-day";
import { NutritionWidget } from "../../daily/nutrition-widget";
import { CalorieWidget } from "../../daily/calorie-widget";
import { WorkoutWidget } from "../../daily/workout-widget";
import { ActivityWidgets } from "../../daily/activity-widgets";
import { FoodLogStatus } from "../../food/log-status";
import { WaterEntryModal } from "../../water/entry-modal";

export default function HomeScreen() {
  const { state } = useProfile();
  const activity = useDayActivity();
  const [waterEntryDay, setWaterEntryDay] = useState<string | null>(null);
  useEffect(() => { setWaterEntryDay(null); }, [activity.date]);
  if (state.kind !== "ready") return null;
  if (activity.food.kind !== "ready") return <Screen title="Home" showTitle={false} fill><FoodLogStatus fill /></Screen>;
  const answers = state.document.answers;
  const { summary } = activity.food;
  return (
    <Screen title="Home" showTitle={false}>
      <KineSplitRow pose="today" testIDPrefix="home" rowTestID="home-nutrition-row">
        {(columnWidth) => (
          <NutritionWidget
            width={columnWidth}
            targets={macroTargets(answers)}
            summary={summary}
          />
        )}
      </KineSplitRow>
      <CalorieWidget current={summary.calories} goal={calorieState(answers).target} macros={summary} />
      <WorkoutWidget workout={activity.workout} />
      <ActivityWidgets steps={activity.steps} water={activity.water}
        onAddWater={() => setWaterEntryDay(activity.date)} />
      {waterEntryDay === activity.date && <WaterEntryModal key={waterEntryDay} date={waterEntryDay}
        onDismiss={() => setWaterEntryDay(current => current === waterEntryDay ? null : current)} />}
    </Screen>
  );
}

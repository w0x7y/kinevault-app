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
import { useFoodLog } from "../../food/log-provider";
import { FoodLogStatus } from "../../food/log-status";
import { useWaterLog } from "../../water/provider";
import { WaterEntryModal } from "../../water/entry-modal";

export default function HomeScreen() {
  const { state } = useProfile();
  const { day, summary } = useDayActivity();
  const foodLog = useFoodLog();
  const waterLog = useWaterLog();
  const [waterEntryDay, setWaterEntryDay] = useState<string | null>(null);
  useEffect(() => { setWaterEntryDay(null); }, [day.date]);
  if (state.kind !== "ready") return null;
  if (foodLog.state.kind !== "ready") return <Screen title="Home" showTitle={false} fill><FoodLogStatus fill /></Screen>;
  const answers = state.document.answers;
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
      <WorkoutWidget workout={summary.workout} />
      <ActivityWidgets day={day} waterStatus={waterLog.state.kind} onAddWater={() => setWaterEntryDay(day.date)} />
      {waterEntryDay === day.date && <WaterEntryModal key={waterEntryDay} date={waterEntryDay}
        onDismiss={() => setWaterEntryDay(current => current === waterEntryDay ? null : current)} />}
    </Screen>
  );
}

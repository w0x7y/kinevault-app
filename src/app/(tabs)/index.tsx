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

export default function HomeScreen() {
  const { state } = useProfile();
  const { day, summary } = useDayActivity();
  const foodLog = useFoodLog();
  if (state.kind !== "ready") return null;
  if (foodLog.state.kind !== "ready") return <Screen title="Home" showTitle={false}><FoodLogStatus /></Screen>;
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
      <ActivityWidgets day={day} />
    </Screen>
  );
}

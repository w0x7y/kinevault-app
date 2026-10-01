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

export default function HomeScreen() {
  const { state } = useProfile();
  const { day, summary } = useDayActivity();
  if (state.kind !== "ready") return null;
  const answers = state.document.answers;
  return (
    <Screen title="Home" showTitle={false}>
      <CalorieWidget current={summary.calories} goal={calorieState(answers).target} />
      <KineSplitRow pose="today" testIDPrefix="home" rowTestID="home-nutrition-row">
        {(columnWidth) => (
          <NutritionWidget
            width={columnWidth}
            targets={macroTargets(answers)}
            summary={summary}
          />
        )}
      </KineSplitRow>
      <WorkoutWidget workout={summary.workout} />
      <ActivityWidgets day={day} />
    </Screen>
  );
}

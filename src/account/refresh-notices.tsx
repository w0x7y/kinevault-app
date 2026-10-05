import { RefreshNotice } from "../persistence/refresh-notice";
import { useExercises } from "../exercise/provider";
import { useCustomFoods } from "../food/custom-provider";
import { useFoodLog } from "../food/log-provider";
import { useWaterLog } from "../water/provider";
import { useWaterGoal } from "../water/goal-provider";

export function TrackingRefreshNotices() {
  const exercise = useExercises();
  const foods = useCustomFoods();
  const foodLog = useFoodLog();
  const water = useWaterLog();
  const goal = useWaterGoal();
  return <>
    <RefreshNotice label="Exercises" document={exercise} />
    <RefreshNotice label="Custom foods" document={foods} />
    <RefreshNotice label="Food log" document={foodLog} />
    <RefreshNotice label="Water log" document={water} />
    <RefreshNotice label="Water goal" document={goal} />
  </>;
}

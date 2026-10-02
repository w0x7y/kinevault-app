import { useMemo } from "react";
import { useSelectedDay } from "../calendar/provider";
import { interpretDayActivity } from "./activity";
import { useFoodLog } from "../food/log-provider";
import { useWaterLog } from "../water/provider";
import { useWaterGoal } from "../water/goal-provider";

export function useDayActivity() {
  const { selectedDay } = useSelectedDay();
  const { state } = useFoodLog();
  const { state: waterState } = useWaterLog();
  const { state: goalState } = useWaterGoal();
  return useMemo(() => interpretDayActivity({ selectedDay, food: state, water: waterState, goal: goalState }),
    [selectedDay, state, waterState, goalState]);
}

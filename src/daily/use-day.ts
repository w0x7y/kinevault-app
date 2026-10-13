import { useMemo } from "react";
import { useSelectedDay } from "../calendar/provider";
import { interpretDayActivity } from "./activity";
import { useProfile } from "../profile/provider";
import { useFoodLog } from "../food/log-provider";
import { useWaterLog } from "../water/provider";
import { useWaterGoal } from "../water/goal-provider";
import { useExercises } from "../exercise/provider";

// Defaults to the Selected day; the Personal journal passes Today.
export function useDayActivity(date?: string) {
  const { selectedDay } = useSelectedDay();
  const day = date ?? selectedDay;
  const { state: profileState } = useProfile();
  const { state } = useFoodLog();
  const { state: waterState } = useWaterLog();
  const { state: goalState } = useWaterGoal();
  const { state: exerciseState } = useExercises();
  return useMemo(
    () =>
      interpretDayActivity({
        date: day,
        profile: profileState,
        food: state,
        water: waterState,
        goal: goalState,
        exercise: exerciseState,
      }),
    [day, profileState, state, waterState, goalState, exerciseState],
  );
}

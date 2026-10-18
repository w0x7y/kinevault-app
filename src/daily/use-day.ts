import { useMemo } from "react";
import { useSelectedDay } from "../calendar/provider";
import { interpretDayActivity } from "./activity";
import { useProfile } from "../profile/provider";
import { useFoodLog } from "../food/log-provider";
import { useWaterLog } from "../water/provider";
import { useWaterGoal } from "../water/goal-provider";
import { useExercises } from "../exercise/provider";
import { useStepsLog } from "../steps/provider";
import { useDeviceSteps } from "../steps/use-device-steps";

/**
 * Daily activity from every saved source, each with its own retry. Defaults to the Selected
 * day; the Personal journal passes Today. Only Home reads Phone steps (`phoneSteps`); elsewhere
 * they stay loading.
 */
export function useDayActivity({
  date,
  phoneSteps = false,
}: { date?: string; phoneSteps?: boolean } = {}) {
  const { selectedDay, today } = useSelectedDay();
  const day = date ?? selectedDay;
  const { state: profileState } = useProfile();
  const food = useFoodLog();
  const water = useWaterLog();
  const goal = useWaterGoal();
  const exercise = useExercises();
  const steps = useStepsLog();
  const phone = useDeviceSteps(phoneSteps ? day : null);
  return useMemo(
    () =>
      interpretDayActivity({
        date: day,
        today,
        profile: profileState,
        food: { state: food.state, retryLoad: food.retryLoad },
        water: { state: water.state, retryLoad: water.retryLoad },
        goal: { state: goal.state, retryLoad: goal.retryLoad },
        exercise: { state: exercise.state, retryLoad: exercise.retryLoad },
        phoneSteps: phone,
        loggedSteps: { state: steps.state, retryLoad: steps.retryLoad },
      }),
    // Saving and refresh flags don't change the day; only each source's state and retry do.
    [
      day,
      today,
      profileState,
      food.state,
      food.retryLoad,
      water.state,
      water.retryLoad,
      goal.state,
      goal.retryLoad,
      exercise.state,
      exercise.retryLoad,
      phone,
      steps.state,
      steps.retryLoad,
    ],
  );
}

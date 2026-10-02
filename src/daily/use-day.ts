import { useMemo } from "react";
import { useSelectedDay } from "../calendar/provider";
import { emptyDay, summarizeDay } from "./model";
import { useFoodLog } from "../food/log-provider";
import { useWaterLog } from "../water/provider";

export function useDayActivity() {
  const { selectedDay } = useSelectedDay();
  const { state } = useFoodLog();
  const { state: waterState } = useWaterLog();
  return useMemo(() => {
    const foods = state.kind === "ready" ? state.document.days[selectedDay] ?? [] : [];
    const drinkMl = foods.reduce((sum, entry) => sum + (entry.meal === "drinks" ? entry.drinkMl ?? 0 : 0), 0);
    const day = { ...emptyDay(selectedDay),
      foods,
      waterMl: waterState.kind === "ready" && state.kind === "ready" ? (waterState.document.days[selectedDay] ?? 0) + drinkMl : 0 };
    return { day, summary: summarizeDay(day) };
  }, [selectedDay, state, waterState]);
}

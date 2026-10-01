import { useMemo } from "react";
import { useSelectedDay } from "../calendar/provider";
import { emptyDay, summarizeDay } from "./model";
import { useFoodLog } from "../food/log-provider";

export function useDayActivity() {
  const { selectedDay } = useSelectedDay();
  const { state } = useFoodLog();
  return useMemo(() => {
    const day = { ...emptyDay(selectedDay), foods: state.kind === "ready" ? state.document.days[selectedDay] ?? [] : [] };
    return { day, summary: summarizeDay(day) };
  }, [selectedDay, state]);
}

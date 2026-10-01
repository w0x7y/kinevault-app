import { useMemo } from "react";
import { useSelectedDay } from "../calendar/provider";
import { emptyDay, summarizeDay } from "./model";

export function useDayActivity() {
  const { selectedDay } = useSelectedDay();
  return useMemo(() => {
    const day = emptyDay(selectedDay);
    return { day, summary: summarizeDay(day) };
  }, [selectedDay]);
}

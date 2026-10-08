import type { WorkoutGraphPoint, WorkoutMetric } from "./activity.ts";
/** Week buckets end on the selected day; absent measurements remain gaps. */
export function chartWeeks(
  points: readonly WorkoutGraphPoint[],
  metric: WorkoutMetric,
): WorkoutGraphPoint[] {
  const weeks: WorkoutGraphPoint[] = [];
  for (let index = 0; index < points.length; index += 7) {
    const days = points.slice(index, index + 7);
    const aggregate = (field: "total" | "left" | "right") => {
      const values = days.flatMap((day) => (day[field] === null ? [] : [day[field]!]));
      return values.length
        ? metric === "weight"
          ? Math.max(...values)
          : values.reduce((sum, value) => sum + value, 0)
        : null;
    };
    weeks.push({
      date: days.at(-1)!.date,
      total: aggregate("total"),
      left: aggregate("left"),
      right: aggregate("right"),
      workouts: days.reduce((sum, day) => sum + day.workouts, 0),
      partialDuration: days.some((day) => day.partialDuration),
    });
  }
  return weeks;
}

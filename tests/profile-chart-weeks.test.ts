import assert from "node:assert/strict";
import test from "node:test";
import { chartWeeks } from "../src/profile/chart-weeks.ts";
import type { WorkoutGraphPoint } from "../src/profile/activity.ts";
const day = (
  index: number,
  total: number | null,
  extra: Partial<WorkoutGraphPoint> = {},
): WorkoutGraphPoint => ({
  date: `2026-09-${String(index + 1).padStart(2, "0")}`,
  total,
  left: null,
  right: null,
  workouts: total === null ? 0 : 1,
  partialDuration: false,
  ...extra,
});
test("weekly chart sums recorded volume and duration, preserving empty weeks and zero", () => {
  const points = Array.from({ length: 21 }, (_, i) =>
    day(i, i === 0 ? 100 : i === 3 ? 250 : i === 20 ? 0 : null),
  );
  const result = chartWeeks(points, "volume");
  assert.deepEqual(
    result.map((p) => [p.date, p.total, p.workouts]),
    [
      ["2026-09-07", 350, 2],
      ["2026-09-14", null, 0],
      ["2026-09-21", 0, 1],
    ],
  );
  assert.equal(chartWeeks(points, "duration")[0].total, 350);
});
test("weekly weights retain independent side maxima and duration incompleteness", () => {
  const points = Array.from({ length: 7 }, (_, i) =>
    day(
      i,
      i === 0 ? 10 : i === 1 ? 30 : null,
      i === 0
        ? { left: 25, right: 10, partialDuration: true }
        : i === 1
          ? { left: 15, right: 30 }
          : {},
    ),
  );
  const [weight] = chartWeeks(points, "weight");
  assert.equal(weight.total, 30);
  assert.equal(weight.left, 25);
  assert.equal(weight.right, 30);
  assert.equal(weight.partialDuration, true);
});

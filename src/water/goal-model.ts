export type WaterGoalDocument = { version: 1; dailyMl: number };

export const defaultWaterGoalMl = 1500;

function validGoal(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 10000;
}

export function parseWaterGoal(raw: string | null): WaterGoalDocument {
  if (raw === null) return { version: 1, dailyMl: defaultWaterGoalMl };
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      !("version" in value) || value.version !== 1 || !("dailyMl" in value) ||
      (value.dailyMl !== null && !validGoal(value.dailyMl))) throw new Error("Invalid water goal");
  return { version: 1, dailyMl: value.dailyMl === null ? defaultWaterGoalMl : value.dailyMl };
}

export function waterGoalFromText(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const ml = Number(trimmed);
  return validGoal(ml) ? ml : null;
}

export function waterGoalProgress(consumedMl: number | null, goalMl: number | null): number | null {
  if (consumedMl === null || !Number.isFinite(consumedMl) || consumedMl < 0 || !validGoal(goalMl)) return null;
  return Math.min(consumedMl / goalMl, 1);
}

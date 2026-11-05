import type { ExerciseSet } from "./model.ts";
import { decimal, isWarmUp, setLines } from "./tracking.ts";
import { fieldText, figure, unitName, type UnitSystem } from "../units/units.ts";

/** The Plate calculator's bars in kilograms, heaviest first; 0 is no bar. */
export const barChoices = [20, 15, 10, 0] as const;
export type BarKg = (typeof barChoices)[number];
export const defaultBarKg: BarKg = 20;
/**
 * Each system's bars, in the order of `barChoices`, and its plates, heaviest first. A pound bar is
 * the saved kilogram bar's counterpart: 20 kg is 45 lb, 15 kg 35 lb and 10 kg 15 lb.
 */
export const plateKit = {
  metric: { bars: barChoices, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
  imperial: { bars: [45, 35, 15, 0], plates: [45, 35, 25, 10, 5, 2.5] },
} as const satisfies Record<UnitSystem, { bars: readonly number[]; plates: readonly number[] }>;
/** A bar in `units`: the saved kilogram bar's counterpart. */
export function barWeight(bar: BarKg, units: UnitSystem): number {
  return plateKit[units].bars[barChoices.indexOf(bar)]!;
}
/** A plate or bar weight, already in `units`, to read: "2.5 kg", "45 lb". */
export function plateText(weight: number, units: UnitSystem): string {
  return `${figure(weight, 3)} ${unitName("weight", units)}`;
}

/** A saved bar choice, or null for anything else. */
export function parseBarKg(value: string | null): BarKg | null {
  return barChoices.find((bar) => value === String(bar)) ?? null;
}

/**
 * The plates for each side of a bar loaded to `weight`, heaviest first, and the part of that
 * weight no pair of plates can make up, all in `units`. Null when the weight is lighter than the
 * bar.
 */
export function platesPerSide(
  weight: number,
  bar: BarKg,
  units: UnitSystem = "metric",
): { plates: number[]; remainder: number } | null {
  // Thousandths keep the 1.25 kg plates exact.
  let side = (Math.round(weight * 1000) - barWeight(bar, units) * 1000) / 2;
  if (side < 0) return null;
  const plates: number[] = [];
  for (const plate of plateKit[units].plates)
    while (side >= plate * 1000) {
      plates.push(plate);
      side -= plate * 1000;
    }
  return { plates, remainder: (side * 2) / 1000 };
}

/** The plates to load on each side for `weight` in `units`, in words, and what no plates can make up. */
export function plateLoading(weight: number, bar: BarKg, units: UnitSystem = "metric") {
  const result = platesPerSide(weight, bar, units);
  if (!result) return { plates: "Lighter than the bar", remainder: null };
  return {
    plates: result.plates.length
      ? `${result.plates.map((plate) => plateText(plate, units)).join(" + ")} per side`
      : bar
        ? "Just the bar"
        : "No plates",
    remainder:
      result.remainder > 0 ? `${plateText(result.remainder, units)} can't be loaded` : null,
  };
}

/**
 * Each set line with a weight to load, named as its set ("Set 2 left"), with its weight as the set
 * field shows it in `units`. Blank, zero and invalid weights have nothing to load.
 */
export function plateLines(sets: readonly ExerciseSet[], units: UnitSystem = "metric") {
  return sets.flatMap((set, index) =>
    setLines(set).flatMap(({ side, values }) => {
      let weightKg = 0;
      try {
        weightKg = decimal(values.weightKg ?? "", 0);
      } catch {
        // An invalid weight shows its error when the workout saves.
      }
      if (weightKg <= 0) return [];
      // Plates load the figure the set shows: 135 lb, not the 134.9999 lb its kilograms make.
      const weight =
        units === "metric" ? weightKg : Number(fieldText("weight", String(weightKg), units));
      return [
        {
          key: `${set.id}-${side ?? "set"}`,
          name: `Set ${index + 1}${side ? ` ${side}` : ""}`,
          warmUp: isWarmUp(set),
          weight,
        },
      ];
    }),
  );
}

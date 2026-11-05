import { parseDatedEntries, saveDatedEntry, validateWeightDate } from "./weight-model.ts";
import { limitText, unitName, type UnitSystem } from "../units/units.ts";

export const measurements = ["waist", "chest", "hips", "arm", "thigh"] as const;
export type Measurement = (typeof measurements)[number];
export const measurementLabels: Record<Measurement, string> = {
  waist: "Waist",
  chest: "Chest",
  hips: "Hips",
  arm: "Arm",
  thigh: "Thigh",
};
/** A Body measurement: any non-empty subset of the measurements, in centimeters. */
export type MeasurementEntry = { date: string; cm: Partial<Record<Measurement, number>> };
export type SaveMeasurementInput = MeasurementEntry & { previousDate?: string };

function validateCm(cm: unknown): number {
  if (typeof cm !== "number" || !Number.isFinite(cm) || cm < 10 || cm > 300)
    throw new Error("Enter a measurement between 10 and 300 cm.");
  if (Math.abs(cm * 10 - Math.round(cm * 10)) > 0.00000001)
    throw new Error("Enter cm with up to one decimal place.");
  return cm;
}

/** Saved centimeter text as a measurement; messages name the limits in `units`. */
export function cmFromInput(value: string, units: UnitSystem = "metric"): number {
  const text = value.trim();
  const unit = unitName("length", units);
  if (text.length > 16 || !/^\d+(?:[.,]\d)?$/.test(text))
    throw new Error(`Enter ${unit} with up to one decimal place.`);
  const cm = Number(text.replace(",", "."));
  if (cm < 10 || cm > 300)
    throw new Error(
      `Enter a measurement between ${limitText("length", 10, units, "min")} and ${limitText("length", 300, units, "max")} ${unit}.`,
    );
  return validateCm(cm);
}

export function validateMeasurementEntry(date: unknown, cm: unknown): MeasurementEntry {
  if (typeof cm !== "object" || cm === null || Array.isArray(cm))
    throw new Error("Invalid body measurement");
  const values: MeasurementEntry["cm"] = {};
  for (const name of measurements) if (name in cm) values[name] = validateCm(Reflect.get(cm, name));
  if (!Object.keys(values).length) throw new Error("Enter at least one measurement.");
  return { date: validateWeightDate(date), cm: values };
}

export function parseMeasurementEntries(value: unknown): MeasurementEntry[] {
  return parseDatedEntries(value, (entry) => {
    if (!("date" in entry) || !("cm" in entry)) throw new Error("Invalid body measurement");
    return validateMeasurementEntry(entry.date, entry.cm);
  });
}

export function saveMeasurementEntry(
  entries: readonly MeasurementEntry[],
  input: SaveMeasurementInput,
): MeasurementEntry[] {
  const next = validateMeasurementEntry(input.date, input.cm);
  return saveDatedEntry(entries, next, input.previousDate, parseMeasurementEntries);
}

/** One measurement's dated values, for the chart. */
export function measurementSeries(entries: readonly MeasurementEntry[], name: Measurement) {
  return entries.flatMap(({ date, cm }) =>
    cm[name] === undefined ? [] : [{ date, value: cm[name] }],
  );
}

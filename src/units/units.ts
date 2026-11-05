/**
 * Metric and Imperial units. Saved values stay metric (kilograms, centimeters, meters, milliliters
 * and grams); only these functions know what the user reads and types.
 */
export type UnitSystem = "metric" | "imperial";

/** A saved Units setting, or Metric for anything else. */
export function parseUnitSystem(value: unknown): UnitSystem {
  return value === "imperial" ? value : "metric";
}

/**
 * Each measured value: its unit in each system, how many saved metric units one of it is, and the
 * decimals its figures show. An imperial field takes up to `digits` decimals and saves to `saved`
 * metric decimals, which still shows back exactly as typed.
 */
const scales = {
  /** Set weights, Workout volume and records; kilograms saved to the gram. */
  weight: {
    metric: { unit: "kg", size: 1, digits: 3 },
    imperial: { unit: "lb", size: 0.45359237, digits: 1, saved: 3 },
  },
  /** Body weight; kilograms saved to two decimals. */
  bodyWeight: {
    metric: { unit: "kg", size: 1, digits: 2 },
    imperial: { unit: "lb", size: 0.45359237, digits: 1, saved: 2 },
  },
  /** Body measurements and height; centimeters saved to one decimal. */
  length: {
    metric: { unit: "cm", size: 1, digits: 1 },
    imperial: { unit: "in", size: 2.54, digits: 1, saved: 1 },
  },
  /** Cardio distances; meters saved in tens. */
  distance: {
    metric: { unit: "km", size: 1000, digits: 2 },
    imperial: { unit: "mi", size: 1609.344, digits: 2, saved: -1 },
  },
  /** Water, drinks and the Water goal; whole milliliters. */
  fluid: {
    metric: { unit: "ml", size: 1, digits: 0 },
    imperial: { unit: "fl oz", size: 29.5735295625, digits: 0, saved: 0 },
  },
  /** Food weighed for logging; grams. */
  food: {
    metric: { unit: "g", size: 1, digits: 1 },
    imperial: { unit: "oz", size: 28.349523125, digits: 1, saved: 2 },
  },
} as const;
export type Quantity = keyof typeof scales;

export function unitName(quantity: Quantity, units: UnitSystem): string {
  return scales[quantity][units].unit;
}
/** A saved metric value (meters for a distance) in `units`, unrounded. */
export function inUnits(quantity: Quantity, value: number, units: UnitSystem): number {
  return value / scales[quantity][units].size;
}
/** A value in `units` as the metric value it saves. */
export function fromUnits(quantity: Quantity, value: number, units: UnitSystem): number {
  return value * scales[quantity][units].size;
}

/** A number to read, with up to `digits` decimals: "1,102.3". */
export function figure(value: number, digits: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}
/** A saved value's number in `units`: "61.2" kg or "135" lb. `digits` caps its decimals. */
export function measureFigure(
  quantity: Quantity,
  value: number,
  units: UnitSystem,
  digits: number = scales[quantity][units].digits,
): string {
  return figure(inUnits(quantity, value, units), digits);
}
/** A saved value to read in `units`: "61.2 kg" or "135 lb". `digits` caps its decimals. */
export function measureText(
  quantity: Quantity,
  value: number,
  units: UnitSystem,
  digits?: number,
): string {
  return `${measureFigure(quantity, value, units, digits)} ${unitName(quantity, units)}`;
}
/**
 * A validation limit's number in `units`: imperial rounds a minimum up and a maximum down, so the
 * figure named is one the rule accepts.
 */
export function limitText(
  quantity: Quantity,
  value: number,
  units: UnitSystem,
  bound: "min" | "max",
): string {
  if (units === "metric") return figure(inUnits(quantity, value, units), 3);
  const { digits } = scales[quantity].imperial;
  const scaled = inUnits(quantity, value, units) * 10 ** digits;
  // A hair of tolerance keeps an exact limit from rounding past itself.
  const rounded = bound === "min" ? Math.ceil(scaled - 1e-9) : Math.floor(scaled + 1e-9);
  return figure(rounded / 10 ** digits, digits);
}

/** `value` with at most `digits` decimals (negative rounds to tens), with no exponent. */
function decimalText(value: number, digits: number): string {
  if (digits <= 0) return String(Math.round(value / 10 ** -digits) * 10 ** -digits);
  return value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Text typed into a field in `units` as the saved metric text: "135" lb is "61.235" kg. A metric
 * distance is typed in km and saved as whole meters. More decimals than the unit takes save
 * exactly, so a field whose rule keeps fewer rejects them and one that doesn't shows them back.
 * Text that isn't a number stays as typed, so validation rejects it.
 */
export function savedText(quantity: Quantity, typed: string, units: UnitSystem): string {
  if (units === "metric") return quantity === "distance" ? metersFromKm(typed) : typed;
  const match = /^(\d*)(?:[.,](\d*))?$/.exec(typed.trim());
  if (!match || !(match[1] || match[2])) return typed;
  const { size, digits, saved } = scales[quantity].imperial;
  const decimals = match[2]?.length ?? 0;
  const value = Number(`${match[1] || "0"}.${match[2] ?? ""}`) * size;
  return decimalText(value, decimals > digits ? Math.min(decimals + 4, 10) : saved);
}

/**
 * Saved metric text as a field shows it in `units`: the shortest figure (up to four decimals) that
 * saves back to the same text, so a typed value shows as typed, otherwise the unit's rounding.
 * Text that isn't a number shows as it is.
 */
export function fieldText(quantity: Quantity, saved: string, units: UnitSystem): string {
  if (units === "metric") return quantity === "distance" ? kmFromMeters(saved) : saved;
  const text = saved.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return saved;
  const value = Number(text.replace(",", ".")) / scales[quantity].imperial.size;
  for (let digits = 0; digits <= 4; digits++) {
    const shown = decimalText(value, digits);
    if (savedText(quantity, shown, units) === saved) return shown;
  }
  return decimalText(value, scales[quantity].imperial.digits);
}

/** Kilometers typed into a Cardio set as the whole meters it saves: "5.25" is "5250". */
function metersFromKm(km: string): string {
  const match = /^(\d*)(?:\.(\d{0,3}))?$/.exec(km.trim());
  if (!match || !(match[1] || match[2])) return km;
  return `${match[1]}${(match[2] ?? "").padEnd(3, "0")}`.replace(/^0+(?=\d)/, "");
}
/** Saved meters as the kilometers a Cardio set's field shows; other text shows as it is. */
function kmFromMeters(meters: string): string {
  if (!/^\d+$/.test(meters)) return meters;
  const digits = meters.padStart(4, "0");
  const fraction = digits.slice(-3).replace(/0+$/, "");
  return `${digits.slice(0, -3).replace(/^0+(?=\d)/, "")}${fraction && `.${fraction}`}`;
}

/** A height to read: "175 cm", or "5 ft 9 in" to the tenth of an inch. */
export function heightText(cm: number, units: UnitSystem): string {
  if (units === "metric") return measureText("length", cm, units);
  const inches = Math.round(inUnits("length", cm, units) * 10) / 10;
  const feet = Math.floor(inches / 12);
  return `${feet} ft ${figure(inches - feet * 12, 1)} in`;
}
/** Saved centimeter text as imperial feet and inches fields; blank or unreadable text is blank. */
export function heightFields(cm: string): { feet: string; inches: string } {
  const total = fieldText("length", cm, "imperial");
  if (!/^\d+(?:\.\d+)?$/.test(total)) return { feet: "", inches: "" };
  const feet = Math.floor(Number(total) / 12);
  return { feet: String(feet), inches: decimalText(Number(total) - feet * 12, 9) };
}
/** Feet and inches fields as saved centimeter text; blank fields are blank, unreadable ones stay
 * readable as typed so validation rejects them. */
export function heightSaved({ feet, inches }: { feet: string; inches: string }): string {
  if (!feet.trim() && !inches.trim()) return "";
  const whole = /^\d*$/.test(feet.trim());
  const part = /^(\d*)(?:[.,](\d*))?$/.exec(inches.trim());
  if (!whole || !part || (inches.trim() && !(part[1] || part[2]))) return `${feet} ft ${inches} in`;
  const decimals = part[2]?.length ?? 0;
  const total = Number(feet.trim() || 0) * 12 + Number(`${part[1] || "0"}.${part[2] ?? ""}`);
  return savedText("length", decimalText(total, decimals), "imperial");
}

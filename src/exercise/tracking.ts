import type { ExerciseDefinition, ExerciseSet, SetSide } from "./model.ts";

/**
 * A Tracking mode: what an Exercise definition's sets hold. Each set's `kind` is its exercise's
 * mode, so a set alone says what it means.
 */
export type TrackingMode = ExerciseDefinition["tracking"];
/** A value a set holds. */
export type SetField = "reps" | "weightKg" | "rir" | "seconds";
/**
 * One row of a set's values: one side of a left/right set, or the whole set. A hint line holds
 * undefined where there is nothing to suggest.
 */
export type SetLine = { side: "left" | "right" | null; values: Partial<Record<SetField, string>> };
type Column = { field: SetField; label: string; name: string };

const reps: Column = { field: "reps", label: "Reps", name: "reps" };
const weight: Column = { field: "weightKg", label: "Weight (kg)", name: "weight (kg)" };
/** Reps in reserve: optional, and never a set's only value (see `setMeasurements`). */
const rir: Column = { field: "rir", label: "RIR", name: "reps in reserve" };
const modes = {
  single: {
    name: "Single weight",
    short: "Weight",
    tag: null,
    columns: [reps, weight, rir],
    sided: false,
    clock: false,
    chartable: true,
  },
  sides: {
    name: "Left and right",
    short: "L / R",
    tag: "Left and right",
    columns: [reps, weight, rir],
    sided: true,
    clock: false,
    chartable: true,
  },
  alternating: {
    name: "Alternating",
    short: "Alt.",
    tag: "Alternating",
    columns: [{ field: "reps", label: "Reps/side", name: "reps per side" }, weight, rir],
    sided: false,
    clock: false,
    chartable: true,
  },
  time: {
    name: "Timed",
    short: "Timed",
    tag: "Timed",
    columns: [{ field: "seconds", label: "Seconds", name: "seconds" }],
    sided: false,
    clock: true,
    chartable: false,
  },
} satisfies Record<
  TrackingMode,
  {
    name: string;
    /** The name on a narrow segmented control. */
    short: string;
    /** The mode named beside an exercise, e.g. in search results; none for the default. */
    tag: string | null;
    /** The values each set line holds, with their column headings and accessible names. */
    columns: readonly Column[];
    /** Sets hold a left and a right line. */
    sided: boolean;
    /** Sets are timed with a stopwatch or countdown. */
    clock: boolean;
    /** Sets record a weight the Workout graph can draw. */
    chartable: boolean;
  }
>;
export const trackingModes = Object.keys(modes) as TrackingMode[];
export function trackingMode(mode: TrackingMode) {
  return modes[mode];
}

export function createEmptySet(mode: TrackingMode, id: string): ExerciseSet {
  switch (mode) {
    case "single":
    case "alternating":
      return { id, kind: mode, reps: "", weightKg: "" };
    case "sides":
      return {
        id,
        kind: mode,
        left: { reps: "", weightKg: "" },
        right: { reps: "", weightKg: "" },
      };
    case "time":
      return { id, kind: mode, seconds: "" };
  }
}
/** A set's values line by line, in its mode's column order. */
export function setLines(set: ExerciseSet): SetLine[] {
  switch (set.kind) {
    case "sides":
      return (["left", "right"] as const).map((side) => ({ side, values: liftValues(set[side]) }));
    case "time":
      return [{ side: null, values: { seconds: set.seconds } }];
    default:
      return [{ side: null, values: liftValues(set) }];
  }
}
// Sets saved before RIR have none; a line still holds one value per column.
function liftValues(value: SetSide) {
  return { reps: value.reps, weightKg: value.weightKg, rir: value.rir ?? "" };
}
export function isBlankSet(set: ExerciseSet): boolean {
  return setLines(set).every((line) => Object.values(line.values).every((value) => !value?.trim()));
}
/** `set` with one entered value; a field or side the set doesn't hold leaves it unchanged. */
export function withSetValue(
  set: ExerciseSet,
  side: SetLine["side"],
  field: SetField,
  value: string,
): ExerciseSet {
  if (set.kind === "time") return field === "seconds" ? { ...set, seconds: value } : set;
  if (field === "seconds") return set;
  if (set.kind !== "sides") return side === null ? { ...set, [field]: value } : set;
  return side === null ? set : { ...set, [side]: { ...set[side], [field]: value } };
}
/**
 * The Previous sets hint for `set` from `source`, line by line. A one-line source fills both
 * sides; a left/right source gives its left side to a one-line set; values the set doesn't hold
 * are dropped.
 */
export function setHint(set: ExerciseSet, source: ExerciseSet | undefined): SetLine[] {
  const from = source ? setLines(source) : [];
  const fields = modes[set.kind].columns.map((column) => column.field);
  return setLines(set).map(({ side }) => {
    const line = from.find((value) => value.side === (side ?? "left")) ?? from[0];
    return {
      side,
      values: Object.fromEntries(fields.map((field) => [field, line?.values[field] || undefined])),
    };
  });
}

/** A nonnegative decimal of up to 100,000, or `blank` for an empty entry when allowed. */
export function decimal(value: string, blank: number | null): number {
  const input = value.trim();
  if (input === "" && blank !== null) return blank;
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(input))
    throw new Error("Enter weights and minutes as numbers of 0 or more.");
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000)
    throw new Error("Enter weights and minutes of 100,000 or less.");
  return amount;
}
function measurement(value: SetSide, zeroAllowed: boolean) {
  const rir = value.rir?.trim() ?? "";
  if (zeroAllowed && !value.reps.trim() && !value.weightKg.trim() && !rir)
    return { reps: 0, weightKg: 0 };
  if (!/^\d+$/.test(value.reps.trim())) throw new Error("Enter whole repetitions for each set.");
  const reps = Number(value.reps.trim());
  if (!Number.isSafeInteger(reps) || reps < (zeroAllowed ? 0 : 1) || reps > 100000)
    throw new Error("Enter from 1 to 100,000 repetitions for each set.");
  if (rir && (!/^\d+$/.test(rir) || Number(rir) > 10))
    throw new Error("Enter reps in reserve as a whole number from 0 to 10, or leave it blank.");
  return { reps, weightKg: decimal(value.weightKg, 0) };
}
export type SetMeasurements = {
  /** Every repetition, both sides counted: an alternating set of 10 reps per side is 20. */
  reps: number;
  /** Kilograms times repetitions. */
  volume: number;
  /** The weights lifted, one per side that has repetitions. */
  weights: number[];
  /** A left/right set's weight per side; null for a side without repetitions or another mode. */
  left: number | null;
  right: number | null;
  /** A timed set's seconds; 0 otherwise. */
  seconds: number;
};
/**
 * A Timed set's valid seconds, from 1 to 86,400 whole seconds: where its Set clock counts down
 * from. Null for any other text (the clock runs as a stopwatch) and for other kinds of set.
 */
export function timedSeconds(set: ExerciseSet): number | null {
  if (set.kind !== "time") return null;
  const text = set.seconds.trim(),
    seconds = Number(text);
  return /^\d+$/.test(text) && seconds >= 1 && seconds <= 86400 ? seconds : null;
}

/** A completed set's numbers; throws the message to show for an invalid one. */
export function setMeasurements(set: ExerciseSet): SetMeasurements {
  const none = { reps: 0, volume: 0, weights: [], left: null, right: null, seconds: 0 };
  if (set.kind === "time") {
    const seconds = timedSeconds(set);
    if (seconds === null)
      throw new Error("Enter from 1 to 86,400 whole seconds for each timed set.");
    return { ...none, seconds };
  }
  if (set.kind !== "sides") {
    const { reps, weightKg } = measurement(set, false);
    const count = set.kind === "alternating" ? reps * 2 : reps;
    return { ...none, reps: count, volume: count * weightKg, weights: [weightKg] };
  }
  const left = measurement(set.left, true),
    right = measurement(set.right, true);
  if (left.reps + right.reps === 0)
    throw new Error("Enter repetitions on at least one side of each set.");
  const sideWeight = (side: typeof left) => (side.reps > 0 ? side.weightKg : null);
  return {
    ...none,
    reps: left.reps + right.reps,
    volume: left.reps * left.weightKg + right.reps * right.weightKg,
    weights: [left, right].filter((side) => side.reps > 0).map((side) => side.weightKg),
    left: sideWeight(left),
    right: sideWeight(right),
  };
}

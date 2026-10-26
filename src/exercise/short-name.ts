export type WorkspaceExercise = { id: string; exercise: { name: string } };

/** Chip labels are capped at this many characters so every chip in the bar is the same size. */
const chipLength = 3;

/**
 * A chip-sized exercise name: any parenthetical part is dropped, then a name of several words
 * becomes the uppercase initials of its first three words and a single word its first three
 * letters, e.g. "Shoulder Press Machine (Wide Grip/Top Half)" becomes "SPM" and "Squat" "SQU".
 * Words split on spaces, hyphens and slashes; labels use letters and digits only.
 */
export function shortExerciseName(name: string): string {
  // A name that is only a parenthetical, "(Warm-up)", keeps its inner words.
  const base = name.replace(/\([^)]*\)?/g, " ").trim() || name.replace(/[()]/g, " ").trim();
  const words = base.split(/[\s/-]+/).filter(Boolean);
  const initials = words.map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? "").join("");
  const label =
    words.length > 1 && initials ? initials : base.replace(/[^\p{L}\p{N}]/gu, "") || base;
  // Counted in characters, after uppercasing ("ß" becomes "SS"), so no emoji is split in half.
  return Array.from(label.toLocaleUpperCase()).slice(0, chipLength).join("");
}

/** A row's accessible name: a name the workout repeats adds its position, "Squat exercise 2". */
export function exerciseRowLabel(
  exercises: readonly WorkspaceExercise[],
  row: WorkspaceExercise,
): string {
  return exercises.filter((item) => item.exercise.name === row.exercise.name).length > 1
    ? `${row.exercise.name} exercise ${exercises.indexOf(row) + 1}`
    : row.exercise.name;
}

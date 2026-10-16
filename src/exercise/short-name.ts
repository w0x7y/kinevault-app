/** Names up to this many characters fit an exercise chip as they are. */
const fitLength = 12;

/**
 * A chip-sized exercise name: any parenthetical part is dropped, a single word or a name that
 * fits stays as it is, and a longer name becomes the uppercase initials of its words, e.g.
 * "Shoulder Press Machine (Wide Grip/Top Half)" becomes "SPM". Words split on spaces, hyphens
 * and slashes; initials use letters and digits only.
 */
export function shortExerciseName(name: string): string {
  const base = name
    .replace(/\([^)]*\)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return name.trim();
  const words = base.split(/[\s/-]+/).filter(Boolean);
  if (words.length <= 1 || base.length <= fitLength) return base;
  const initials = words
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
    .join("")
    .toLocaleUpperCase();
  return initials || base;
}

/**
 * Chip labels for a workout's exercise rows. Rows whose short labels collide keep their
 * position, like the accessible "Squat exercise 2", so "SPM 1" and "SPM 3" stay apart.
 */
export function exerciseChipLabels(names: readonly string[]): string[] {
  const short = names.map(shortExerciseName);
  return short.map((label, index) =>
    short.filter((other) => other === label).length > 1 ? `${label} ${index + 1}` : label,
  );
}

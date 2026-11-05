// Supersets: adjacent rows of a Workout template or log that share a group key. A key that no
// neighbor shares groups nothing.

export type Grouped = { superset?: string };

/** The first and last index of the superset row `index` is in, or null when it's in none. */
export function supersetSpan(rows: readonly Grouped[], index: number): [number, number] | null {
  const key = rows[index]?.superset;
  if (key === undefined) return null;
  let first = index,
    last = index;
  while (rows[first - 1]?.superset === key) first--;
  while (rows[last + 1]?.superset === key) last++;
  return first === last ? null : [first, last];
}

function ungrouped<Row extends Grouped>(row: Row): Row {
  const { superset: _, ...rest } = row;
  return rest as Row;
}

/** Rows whose superset key no neighbor shares leave it, so a superset of one stops being one. */
export function validGroups<Row extends Grouped>(rows: readonly Row[]): Row[] {
  return rows.map((row, index) =>
    row.superset === undefined || supersetSpan(rows, index) ? row : ungrouped(row),
  );
}

/** A key no row uses yet. */
function unusedKey(rows: readonly Grouped[]): string {
  let number = 1;
  while (rows.some((row) => row.superset === String(number))) number++;
  return String(number);
}

/**
 * Rows with row `from` moved to index `to`. A row moved into a superset it isn't in lands just
 * past it, so a move never splits one; a row moved away from its superset leaves it.
 */
export function moveRow<Row extends Grouped>(rows: readonly Row[], from: number, to: number) {
  const row = rows[from]!;
  const rest = rows.filter((_, index) => index !== from);
  const key = rest[to]?.superset;
  if (key !== undefined && key !== row.superset && rest[to - 1]?.superset === key) {
    if (to > from) while (rest[to]?.superset === key) to++;
    else while (rest[to - 1]?.superset === key) to--;
  }
  rest.splice(to, 0, row);
  return validGroups(rest);
}

/**
 * Joins row `index` and the row after it into one superset (`linked`), taking in any superset
 * either is in, or splits their superset between them. The same rows when nothing changes.
 */
export function linkToNext<Row extends Grouped>(
  rows: readonly Row[],
  index: number,
  linked: boolean,
): readonly Row[] {
  const row = rows[index],
    next = rows[index + 1];
  const span = supersetSpan(rows, index);
  if (!row || !next || (span !== null && span[1] > index) === linked) return rows;
  if (linked) {
    const key = row.superset ?? next.superset ?? unusedKey(rows);
    const last = supersetSpan(rows, index + 1)?.[1] ?? index + 1;
    return rows.map((value, at) =>
      at >= index && at <= last ? { ...value, superset: key } : value,
    );
  }
  // The rows after the split get a key of their own; one left alone leaves the superset.
  const key = unusedKey(rows);
  return validGroups(
    rows.map((value, at) => (at > index && at <= span![1] ? { ...value, superset: key } : value)),
  );
}

/**
 * Exercise names in order for one line, a superset's joined by "+" ("Squat + Bench press · Row"),
 * and the same line for screen readers ("superset of Squat and Bench press, Row").
 */
export function exerciseListText(
  rows: readonly (Grouped & { name: string })[],
  separator: string,
): { text: string; label: string } {
  const runs: string[][] = [];
  rows.forEach((row, index) => {
    const first = supersetSpan(rows, index)?.[0];
    if (first !== undefined && first < index) runs.at(-1)!.push(row.name);
    else runs.push([row.name]);
  });
  return {
    text: runs.map((names) => names.join(" + ")).join(separator),
    label: runs
      .map((names) =>
        names.length > 1
          ? `superset of ${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
          : names[0],
      )
      .join(", "),
  };
}

import type { CatalogExercise } from "./catalog.ts";

/** Accent-folded lowercase words; a trailing plural "s" is dropped so "curls" finds "curl". */
export function demoSearchWords(text: string): string[] {
  return (
    text
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/['’]/gu, "")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).map((word) =>
    word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word) ? word.slice(0, -1) : word,
  );
}

function withinOneEdit(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let a = 0;
  let b = 0;
  let edits = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) {
      a++;
      b++;
      continue;
    }
    if (++edits > 1) return false;
    if (left.length > right.length) a++;
    else if (right.length > left.length) b++;
    else {
      a++;
      b++;
    }
  }
  return edits + (left.length - a) + (right.length - b) <= 1;
}

// Lower is better: exact name 0, exact alias 1, name prefix 2, alias prefix 3,
// name with a typo 4, alias with a typo 5.
function rank(terms: readonly string[], target: readonly string[], alias: boolean): number | null {
  const offset = alias ? 1 : 0;
  if (terms.length === target.length && terms.every((term, index) => term === target[index]))
    return offset;
  let typo = false;
  for (const term of terms) {
    if (target.some((word) => word.startsWith(term))) continue;
    if (term.length >= 5 && target.some((word) => word.length >= 5 && withinOneEdit(term, word))) {
      typo = true;
      continue;
    }
    return null;
  }
  return (typo ? 4 : 2) + offset;
}

export function createDemoCatalogSearch(entries: readonly CatalogExercise[]) {
  const indexed = entries
    .filter((entry) => entry.status === "published")
    .map((entry) => ({
      entry,
      name: demoSearchWords(entry.name),
      aliases: entry.aliases.map(demoSearchWords),
    }));
  return (query: string, limit = 8): CatalogExercise[] => {
    const terms = demoSearchWords(query);
    if (!terms.length) return [];
    const matches: { entry: CatalogExercise; rank: number }[] = [];
    for (const item of indexed) {
      const ranks = [
        rank(terms, item.name, false),
        ...item.aliases.map((alias) => rank(terms, alias, true)),
      ].filter((value): value is number => value !== null);
      if (ranks.length) matches.push({ entry: item.entry, rank: Math.min(...ranks) });
    }
    return matches
      .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name))
      .slice(0, limit)
      .map((match) => match.entry);
  };
}

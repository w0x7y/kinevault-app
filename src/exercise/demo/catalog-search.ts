import type { CatalogExercise } from "./catalog.ts";

function dropPlural(word: string, minLength: number): string {
  return word.length > minLength && word.endsWith("s") && !/(ss|us|is)$/.test(word)
    ? word.slice(0, -1)
    : word;
}

/** Accent-folded lowercase words; a trailing plural "s" is dropped so "curls" finds "curl". */
export function demoSearchWords(text: string): string[] {
  return (
    text
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/['’]/gu, "")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).map((word) => dropPlural(word, 3));
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

interface Target {
  words: string[];
  /** The words run together, so "Push-up" is also "pushup". */
  joined: string;
}
interface Query {
  terms: string[];
  /** The terms run together; a short plural last term is also tried singular ("push ups"). */
  joined: string[];
}

function target(words: string[]): Target {
  return { words, joined: words.join("") };
}

function query(terms: string[]): Query {
  const joined = [terms.join("")];
  if (terms.length > 1) {
    const last = dropPlural(terms[terms.length - 1]!, 2);
    joined.push(terms.slice(0, -1).join("") + last);
  }
  return { terms, joined };
}

// Lower is better: exact name 0, exact alias 1, name prefix 2, alias prefix 3,
// name with a typo 4, alias with a typo 5. A spelling that only differs by hyphens, spaces or
// a plural "s" is exact when the words match, otherwise a prefix.
function rank(search: Query, { words, joined }: Target, alias: boolean): number | null {
  const offset = alias ? 1 : 0;
  const { terms } = search;
  if (
    (terms.length === words.length && terms.every((term, index) => term === words[index])) ||
    search.joined.includes(joined)
  )
    return offset;
  const prefix = search.joined.some((key) => joined.startsWith(key));
  let typo = false;
  for (const term of terms) {
    if (words.some((word) => word.startsWith(term) || term === `${word}s`)) continue;
    if (term.length >= 5 && words.some((word) => word.length >= 5 && withinOneEdit(term, word))) {
      typo = true;
      continue;
    }
    return prefix ? 2 + offset : null;
  }
  return (typo && !prefix ? 4 : 2) + offset;
}

export function createDemoCatalogSearch(entries: readonly CatalogExercise[]) {
  const indexed = entries
    .filter((entry) => entry.status === "published")
    .map((entry) => ({
      entry,
      name: target(demoSearchWords(entry.name)),
      aliases: entry.aliases.map((alias) => target(demoSearchWords(alias))),
    }));
  return (text: string, limit = 8): CatalogExercise[] => {
    const terms = demoSearchWords(text);
    if (!terms.length) return [];
    const search = query(terms);
    const matches: { entry: CatalogExercise; rank: number }[] = [];
    for (const item of indexed) {
      const ranks = [
        rank(search, item.name, false),
        ...item.aliases.map((alias) => rank(search, alias, true)),
      ].filter((value): value is number => value !== null);
      if (ranks.length) matches.push({ entry: item.entry, rank: Math.min(...ranks) });
    }
    return matches
      .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name))
      .slice(0, limit)
      .map((match) => match.entry);
  };
}

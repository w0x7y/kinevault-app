import MiniSearch from "minisearch";
import { drinkAliasesFor } from "./drink-aliases.ts";
import type { CatalogFood } from "./catalog.ts";
import { foodKey } from "./food-identity.ts";
import { canonicalFoodSearchQuery } from "./search-query.ts";

// Completed variants carry nutrition/preparation meaning. They cannot become
// prefixes of a different word or participate in fuzzy matching.
const protectedTerms = new Set([
  "diet",
  "zero",
  "sugar",
  "free",
  "raw",
  "cooked",
  "grilled",
  "baked",
  "fried",
  "boiled",
  "steamed",
  "decaffeinated",
  "unsweetened",
  "sweetened",
  "low",
  "calorie",
  "fat",
  "nonfat",
  "skim",
  "regular",
  "cola",
  // Common source-catalog preparation, processing, and nutrition labels.
  "roasted",
  "toasted",
  "salted",
  "unsalted",
  "broiled",
  "smoked",
  "dried",
  "fresh",
  "frozen",
  "canned",
  "whole",
  "light",
  "reduced",
  "lean",
  "fortified",
  "prepared",
  "cured",
  "pickled",
  "mashed",
  "creamed",
  "breaded",
  "skinless",
  "boneless",
  "malted",
  "dry",
  "roast",
  "evaporated",
  "condensed",
  "instant",
  "sodium",
  "high",
  "full",
  "skin",
  "added",
  "no",
  "caffeine",
  ...["zero sugar", "sugar free", "low calorie", "low fat", "fat free"].map((text) =>
    searchWords(text).join(""),
  ),
]);
const maxSpanWords = 3;

function searchWords(text: string): string[] {
  return (
    canonicalFoodSearchQuery(text)
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/'/gu, "")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).map((word) => {
    if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
    if (word.length > 4 && /(oes|ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2);
    if (word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word))
      return word.slice(0, -1);
    return word;
  });
}

const numeric = (term: string) => /\p{N}/u.test(term);
const eligibleForFuzzy = (term: string) =>
  term.length >= 5 && !numeric(term) && !protectedTerms.has(term);

type SearchKey = { text: string; sourceSpans: string[][] };
function keysFor(segments: readonly string[][]): SearchKey[] {
  const keys = new Map<string, SearchKey>();
  for (const tokens of segments) {
    for (let start = 0; start < tokens.length; start++) {
      for (let length = 1; length <= maxSpanWords && start + length <= tokens.length; length++) {
        const span = tokens.slice(start, start + length);
        const text = span.join("");
        const existing = keys.get(text);
        keys.set(text, { text, sourceSpans: [...(existing?.sourceSpans ?? []), span] });
      }
    }
  }
  return [...keys.values()];
}

// A compact prefix may end inside a source word. Recognize a completed
// qualifier at that source boundary even when the query omitted its spaces.
function prefixMatches(term: string, key: SearchKey): boolean {
  if (!key.text.startsWith(term)) return false;
  return key.sourceSpans.every((span) => {
    let start = 0;
    for (const component of span) {
      const end = start + component.length;
      if (term.length > start && term.length < end)
        return !protectedTerms.has(term.slice(start)) && !numeric(term.slice(start));
      start = end;
    }
    return true;
  });
}

// Return the edited position in the query, so compacting words never turns
// a short/qualifier component into an eligible fuzzy term.
function oneEditPosition(left: string, right: string): number | null {
  if (Math.abs(left.length - right.length) > 1) return null;
  let a = 0;
  let b = 0;
  let editedAt: number | null = null;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) {
      a++;
      b++;
      continue;
    }
    if (editedAt !== null) return null;
    editedAt = a;
    if (left.length >= right.length) a++;
    if (right.length >= left.length) b++;
  }
  const remainder = left.length - a + (right.length - b);
  if (editedAt === null) return remainder === 1 ? a : null;
  return remainder === 0 ? editedAt : null;
}

function editedQueryComponentIsEligible(span: readonly string[], position: number): boolean {
  let start = 0;
  for (const [index, term] of span.entries()) {
    const end = start + term.length;
    if (position >= start && (position < end || (index === span.length - 1 && position === end)))
      return eligibleForFuzzy(term);
    start = end;
  }
  return false;
}

// Project the joined query onto each source-component segmentation. Exactly
// one component may change. At a word boundary, consider either adjacent
// component, so an insertion after an eligible brand still works.
function sourceComponentsAllowEdit(query: string, sourceSpan: readonly string[]): boolean {
  const delta = query.length - sourceSpan.join("").length;
  return sourceSpan.some((source, editedIndex) => {
    if (!eligibleForFuzzy(source)) return false;
    let offset = 0;
    for (const [index, component] of sourceSpan.entries()) {
      const length = component.length + (index === editedIndex ? delta : 0);
      const term = query.slice(offset, offset + length);
      if (index === editedIndex) {
        if (!eligibleForFuzzy(term) || oneEditPosition(term, component) === null) return false;
      } else if (term !== component) return false;
      offset += length;
    }
    return offset === query.length;
  });
}

function fuzzySpanMatches(span: readonly string[], key: SearchKey): boolean {
  const query = span.join("");
  const position = oneEditPosition(query, key.text);
  if (position === null || !editedQueryComponentIsEligible(span, position)) return false;
  return key.sourceSpans.every((sourceSpan) => sourceComponentsAllowEdit(query, sourceSpan));
}

// Compact source spans and compact query spans handle both joined and separated
// labels. Each query term must be consumed, in order, by a matching span. Source
// keys may occur in any order; there are no interior or sorted-name matches.
function matchCost(terms: readonly string[], keys: readonly SearchKey[]): number | null {
  const costs = Array.from({ length: terms.length + 1 }, () => Infinity);
  costs[0] = 0;
  for (let start = 0; start < terms.length; start++) {
    const previous = costs[start] ?? Infinity;
    if (!Number.isFinite(previous)) continue;
    for (let length = 1; length <= maxSpanWords && start + length <= terms.length; length++) {
      const span = terms.slice(start, start + length);
      const term = span.join("");
      const protectedQuery = span.some((token) => protectedTerms.has(token) || numeric(token));
      const prefix = !protectedQuery && (term.length >= 3 || start + length === terms.length);
      const fuzzy = !protectedQuery && span.some(eligibleForFuzzy);
      let best = Infinity;
      for (const key of keys) {
        if (key.text === term || (prefix && prefixMatches(term, key))) {
          best = 0;
          break;
        }
        if (fuzzy && fuzzySpanMatches(span, key)) best = 1;
      }
      const end = start + length;
      costs[end] = Math.min(costs[end] ?? Infinity, previous + best);
    }
  }
  const cost = costs[terms.length] ?? Infinity;
  return Number.isFinite(cost) ? cost : null;
}

type SearchEntry = {
  id: number;
  food: CatalogFood;
  keys: SearchKey[];
  nameTokens: string[];
  tokenCount: number;
  kind: "direct" | "qualifier" | "generic";
};
export type FoodSearchMatch = {
  food: CatalogFood;
  rank: number;
  genericDrink: boolean;
  tokenCount: number;
};

export function createFoodSearch(foods: readonly CatalogFood[]) {
  const entries = new Map<number, SearchEntry>();
  const documents: { id: number; text: string }[] = [];
  for (const food of foods) {
    const nameTokens = searchWords(food.name);
    const segments = [nameTokens, searchWords(food.brand ?? "")];
    const addEntry = (kind: SearchEntry["kind"], alias?: string) => {
      const keys = keysFor(alias === undefined ? segments : [...segments, searchWords(alias)]);
      const id = entries.size;
      entries.set(id, { id, food, keys, nameTokens, tokenCount: segments.flat().length, kind });
      documents.push({ id, text: keys.map((key) => key.text).join(" ") });
    };
    addEntry("direct");
    const aliases = drinkAliasesFor(food);
    for (const text of aliases?.texts ?? [])
      addEntry(aliases?.kind === "generic" ? "generic" : "qualifier", text);
  }
  const index = new MiniSearch<{ id: number; text: string }>({
    fields: ["text"],
    tokenize: (text) => text.split(" "),
    processTerm: (term) => term,
  });
  index.addAll(documents);

  return (query: string): FoodSearchMatch[] => {
    const terms = searchWords(query.slice(0, 100));
    if (!terms.some((term) => term.length >= 2)) return [];
    // The index supplies a broad union of candidates; matchCost enforces AND
    // semantics including alternative compact spans and qualifier protection.
    const queryKeys = keysFor([terms])
      .map((key) => key.text)
      .join(" ");
    const candidates = index.search(queryKeys, {
      combineWith: "OR",
      fuzzy: (term) => (eligibleForFuzzy(term) ? 1 : false),
      prefix: (term) => !numeric(term) && !protectedTerms.has(term),
    });
    const matches = new Map<string, FoodSearchMatch>();
    for (const candidate of candidates) {
      if (typeof candidate.id !== "number") continue;
      const entry = entries.get(candidate.id);
      if (!entry) continue;
      const cost = matchCost(terms, entry.keys);
      if (cost === null) continue;
      const name = entry.nameTokens.join(" ");
      const phrase = terms.join(" ");
      const exactName = name === phrase || entry.nameTokens.join("") === terms.join("");
      const genericDrink = entry.kind === "generic";
      const rank = genericDrink
        ? 4
        : cost > 0
          ? 3
          : exactName
            ? 0
            : name.startsWith(`${phrase} `)
              ? 1
              : 2;
      const key = foodKey(entry.food);
      const existing = matches.get(key);
      if (!existing || rank < existing.rank)
        matches.set(key, {
          food: entry.food,
          rank,
          genericDrink,
          tokenCount: entry.tokenCount,
        });
    }
    return [...matches.values()].sort(
      (a, b) =>
        a.rank - b.rank ||
        a.tokenCount - b.tokenCount ||
        a.food.name.length - b.food.name.length ||
        a.food.name.localeCompare(b.food.name) ||
        foodKey(a.food).localeCompare(foodKey(b.food)),
    );
  };
}

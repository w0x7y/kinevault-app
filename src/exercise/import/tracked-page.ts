import {
  oversizedPage,
  unavailableWorkout,
  unrecognizedPage,
  WorkoutImportError,
  type ImportedExercise,
  type ImportedWorkoutPlan,
} from "./plan.ts";

// Tracked share pages are Next.js server components. The flight payload has one row
// per line (`<hex id>:<json>`), React elements as ["$", tag, key, props], and lazy
// references ("$L<hex id>") to other rows. Parsing relies on page meaning (h1, position
// labels, prescription chips, element keys), never on styling class names.

const trackedPageCharacterLimit = 2_000_000;
const trackedExerciseLimit = 100;
const rowLimit = 20_000;
const nodeLimit = 300_000;
const depthLimit = 256;
const jsonNestingLimit = 512;
const nameLimit = 400;
const chipLimit = 20;
const chipTextLimit = 100;

type PageElement = {
  tag: string;
  key: string | null;
  parent: PageElement | null;
  children: (PageElement | string)[];
  meta: { property: string; content: string } | null;
  /** Links to an exercise page. Table pages show the exercise name this way. */
  exerciseLink: boolean;
  /** Children holding any characters, so text reads skip empty subtrees. */
  textChildren: (PageElement | string)[];
  /** Whether this subtree holds any non-whitespace text. */
  visible: boolean;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const labelPattern = /^(\d{1,3})([A-Z])$/;
const chipPattern = /^(sets|reps|rir|rest)\s+(.+)$/i;
const unavailablePattern = /\b(?:isn['’]t|is not|no longer) available\b|\bnot (?:be )?found\b/i;
const skippedTags = new Set(["script", "style", "svg", "noscript", "template", "title"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function own(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** JSON.parse nesting is bounded before parsing so hostile rows cannot exhaust the stack. */
function nestingWithin(body: string, limit: number): boolean {
  let depth = 0,
    inString = false;
  for (let index = 0; index < body.length; index++) {
    const code = body.charCodeAt(index);
    if (inString) {
      if (code === 92) index++;
      else if (code === 34) inString = false;
    } else if (code === 34) inString = true;
    else if (code === 91 || code === 123) {
      if (++depth > limit) return false;
    } else if (code === 93 || code === 125) depth--;
  }
  return true;
}
function utf8Length(codePoint: number): number {
  return codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
}
/** End of the hex digits from `start`, reading at most `limit + 1` characters. */
function hexEnd(text: string, start: number, limit: number): number {
  let end = start;
  while (end < text.length && end - start <= limit && /[0-9a-f]/i.test(text[end]!)) end++;
  return end;
}

/** Reads flight rows. Text rows (`<id>:T<hex byte length>,<text>`) have no line terminator. */
function readFlightRows(payload: string): Map<string, unknown> {
  if (typeof payload !== "string") throw unrecognizedPage();
  if (payload.length > trackedPageCharacterLimit) throw oversizedPage();
  const rows = new Map<string, unknown>();
  let index = 0,
    count = 0;
  // Every scan below moves forward past what it reads, so reading stays linear.
  while (index < payload.length) {
    if (++count > rowLimit) throw oversizedPage();
    const colon = hexEnd(payload, index, 8);
    if (colon - index > 8 || payload[colon] !== ":") {
      const newline = payload.indexOf("\n", index);
      if (newline < 0) break;
      index = newline + 1;
      continue;
    }
    const id = payload.slice(index, colon);
    if (payload[colon + 1] === "T") {
      const comma = hexEnd(payload, colon + 2, 8);
      if (comma === colon + 2 || comma - colon - 2 > 8 || payload[comma] !== ",")
        throw unrecognizedPage();
      const bytes = Number.parseInt(payload.slice(colon + 2, comma), 16);
      let end = comma + 1,
        consumed = 0;
      while (end < payload.length && consumed < bytes) {
        const codePoint = payload.codePointAt(end)!;
        consumed += utf8Length(codePoint);
        end += codePoint > 0xffff ? 2 : 1;
      }
      if (id && !rows.has(id)) rows.set(id, payload.slice(comma + 1, end));
      index = end;
      continue;
    }
    const newline = payload.indexOf("\n", colon + 1);
    const end = newline < 0 ? payload.length : newline;
    const body = payload.slice(colon + 1, end);
    index = end + 1;
    if (!id || rows.has(id) || !/^[[{"n0-9tf-]/.test(body)) continue;
    if (!nestingWithin(body, jsonNestingLimit)) throw unrecognizedPage();
    try {
      rows.set(id, JSON.parse(body));
    } catch {
      // Unknown row kinds are irrelevant to the workout content.
    }
  }
  return rows;
}

/** Recovers the flight payload that a normal HTML response embeds in `self.__next_f`. */
export function readFlightFromHtml(html: string): string {
  if (typeof html !== "string") throw unrecognizedPage();
  if (html.length > trackedPageCharacterLimit) throw oversizedPage();
  const chunks: string[] = [];
  const pattern = /self\.__next_f\.push\((\[1,"(?:[^"\\]|\\.)*"\])\)/g;
  for (const match of html.matchAll(pattern)) {
    try {
      const value: unknown = JSON.parse(match[1]!);
      if (Array.isArray(value) && typeof value[1] === "string") chunks.push(value[1]);
    } catch {
      throw unrecognizedPage();
    }
  }
  if (!chunks.length) throw unrecognizedPage();
  return chunks.join("");
}

function buildTree(rows: Map<string, unknown>): PageElement {
  const root: PageElement = {
    tag: "",
    key: null,
    parent: null,
    children: [],
    meta: null,
    exerciseLink: false,
    textChildren: [],
    visible: false,
  };
  const expanded = new Set<string>();
  let nodes = 0;
  function reference(value: string): unknown {
    const match = /^\$L?([0-9a-f]{1,8})$/i.exec(value);
    // Each row expands once, so repeated or cyclic references cannot multiply work.
    if (!match || !rows.has(match[1]!) || expanded.has(match[1]!)) return undefined;
    expanded.add(match[1]!);
    return rows.get(match[1]!);
  }
  function add(value: unknown, parent: PageElement, depth: number): void {
    if (++nodes > nodeLimit) throw oversizedPage();
    if (depth > depthLimit) throw unrecognizedPage();
    if (typeof value === "string") {
      if (value.startsWith("$$")) parent.children.push(value.slice(1));
      else if (value.startsWith("$")) {
        const row = reference(value);
        if (row !== undefined) add(row, parent, depth + 1);
      } else parent.children.push(value);
      return;
    }
    if (typeof value === "number") {
      parent.children.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      if (value[0] === "$" && typeof value[1] === "string" && isRecord(value[3])) {
        const props = value[3];
        const tag = value[1].startsWith("$") ? "" : value[1].toLowerCase();
        if (skippedTags.has(tag)) return;
        const property = own(props, "property"),
          content = own(props, "content"),
          href = own(props, "href");
        const element: PageElement = {
          tag,
          key: typeof value[2] === "string" ? value[2] : null,
          parent,
          children: [],
          meta:
            tag === "meta" && typeof property === "string" && typeof content === "string"
              ? { property, content }
              : null,
          exerciseLink:
            typeof href === "string" &&
            /^(?:https:\/\/app\.tracked\.gg)?\/v\/exercise\//.test(href),
          textChildren: [],
          visible: false,
        };
        parent.children.push(element);
        // Only rendered children count. Fallback, not-found and template props are other screens.
        add(own(props, "children"), element, depth + 1);
        // Text facts are settled once here; each string and child is examined a single time.
        for (const child of element.children) {
          if (typeof child === "string" ? !child : !child.textChildren.length) continue;
          element.textChildren.push(child);
          element.visible ||= typeof child === "string" ? /\S/.test(child) : child.visible;
        }
        return;
      }
      for (const item of value) add(item, parent, depth + 1);
      return;
    }
    if (isRecord(value)) for (const key of Object.keys(value)) add(value[key], parent, depth + 1);
  }
  if (rows.has("0")) add("$0", root, 0);
  else {
    const referenced = new Set<string>();
    const collect = (value: unknown, depth: number): void => {
      if (++nodes > nodeLimit) throw oversizedPage();
      if (depth > depthLimit) throw unrecognizedPage();
      if (typeof value === "string") {
        const match = /^\$L?([0-9a-f]{1,8})$/i.exec(value);
        if (match) referenced.add(match[1]!);
      } else if (Array.isArray(value)) for (const item of value) collect(item, depth + 1);
      else if (isRecord(value))
        for (const key of Object.keys(value)) collect(value[key], depth + 1);
    };
    for (const value of rows.values()) collect(value, 0);
    nodes = 0;
    for (const id of rows.keys()) if (!referenced.has(id)) add(`$${id}`, root, 0);
  }
  return root;
}

/**
 * Text in document order, stopping after `budget` characters. Every visited child
 * contributes text, so a read costs at most its budget plus the nesting depth.
 */
function textOf(element: PageElement, budget: number): string {
  const parts: string[] = [];
  let remaining = budget;
  const visit = (node: PageElement) => {
    for (const child of node.textChildren) {
      if (remaining <= 0) return;
      if (typeof child === "string") {
        const part = child.length > remaining ? child.slice(0, remaining) : child;
        parts.push(part);
        remaining -= part.length;
      } else visit(child);
    }
  };
  visit(element);
  return parts.join("");
}
/** Collapsed text up to `limit` characters, read with room for repeated whitespace. */
function cleanText(element: PageElement, limit: number): string {
  return clean(textOf(element, limit * 4 + 16), limit);
}
function clean(text: string, limit: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, limit).trim();
}
/** Matches the page's CSS `capitalize`: each word's first letter is uppercased, the rest kept. */
export function capitalizeWords(text: string): string {
  return text.replace(
    /(^|\s)([^\s\p{L}]*)(\p{L})/gu,
    (_match, space: string, prefix: string, letter: string) =>
      `${space}${prefix}${letter.toUpperCase()}`,
  );
}

type Indexed = {
  element: PageElement;
  /** Depth-first position; descendants occupy [index + 1, end). */
  index: number;
  end: number;
  parent: Indexed | null;
  label: string | null;
  labels: number;
  /** First nonblank exercise link, paragraph and heading in this subtree. */
  link: Indexed | null;
  paragraph: Indexed | null;
  heading: Indexed | null;
};

// One pass records subtree ranges and per-subtree facts, so every lookup is
// bounded by the page size instead of growing with labels times ancestors.
function index(root: PageElement): Indexed[] {
  const all: Indexed[] = [];
  const visit = (element: PageElement, parent: Indexed | null): Indexed => {
    const text = element.children.every((child) => typeof child === "string")
      ? textOf(element, 16).trim()
      : "";
    const entry: Indexed = {
      element,
      index: all.length,
      end: 0,
      parent,
      label: labelPattern.test(text) ? text : null,
      labels: 0,
      link: null,
      paragraph: null,
      heading: null,
    };
    all.push(entry);
    if (element.exerciseLink && element.visible) entry.link = entry;
    if (element.tag === "p" && element.visible) entry.paragraph = entry;
    if (element.tag === "h1" && element.visible) entry.heading = entry;
    entry.labels = entry.label ? 1 : 0;
    for (const child of element.children) {
      if (typeof child === "string") continue;
      const nested = visit(child, entry);
      entry.labels += nested.labels;
      entry.link ??= nested.link;
      entry.paragraph ??= nested.paragraph;
      entry.heading ??= nested.heading;
    }
    entry.end = all.length;
    return entry;
  };
  visit(root, null);
  return all;
}

type Chips = Omit<ImportedExercise, "sourceId" | "label" | "name">;
function readChips(texts: string[]): Chips {
  const result: Chips = { sets: null, reps: null, rir: null, rest: null, otherChips: [] };
  for (const text of texts.slice(0, chipLimit)) {
    const match = chipPattern.exec(text);
    const field = match ? (match[1]!.toLowerCase() as "sets" | "reps" | "rir" | "rest") : null;
    const value = match ? match[2]! : "";
    if (field === "sets" && result.sets === null && /^\d{1,3}$/.test(value) && Number(value) <= 100)
      result.sets = Number(value);
    else if (field !== null && field !== "sets" && result[field] === null) result[field] = value;
    else result.otherChips.push(text);
  }
  return result;
}

/** Parses a Tracked share page's flight payload into a workout plan. */
export function parseTrackedWorkoutPage(payload: string, workoutId: string): ImportedWorkoutPlan {
  if (typeof workoutId !== "string" || !uuidPattern.test(workoutId)) throw unrecognizedPage();
  const all = index(buildTree(readFlightRows(payload)));
  const labels = all.filter((entry) => entry.label !== null);
  if (labels.length > trackedExerciseLimit * 4) throw oversizedPage();
  const cellsOf = (row: PageElement) =>
    row.children.filter((child): child is PageElement => typeof child !== "string");
  const reads = (child: PageElement | string, text: RegExp) =>
    typeof child !== "string" &&
    child.children.length === 1 &&
    typeof child.children[0] === "string" &&
    text.test(child.children[0]);
  // Table pages give each exercise a row; the header row names the cells by position. It
  // holds Sets beside Exercise, so a workout or exercise named "Sets" isn't taken for it.
  const header = all.find(
    ({ element }) =>
      element.children.length <= chipLimit &&
      element.children.some((child) => reads(child, /^\s*sets\s*$/i)) &&
      element.children.some((child) => reads(child, /^\s*exercise\s*$/i)),
  );
  const columns = header
    ? cellsOf(header.element).map((cell) => cleanText(cell, chipTextLimit))
    : null;
  const exercises: (ImportedExercise & { position: number; entry: Indexed })[] = [];
  const seen = new Set<string>();
  for (const [position, entry] of labels.entries()) {
    const label = entry.label!;
    // The smallest ancestor holding an exercise link or a named paragraph is this exercise's
    // content. Table pages link the name and put muscle groups in the paragraph.
    let scope = entry.parent;
    for (let level = 0; scope && level < 8 && !(scope.link ?? scope.paragraph); level++)
      scope = scope.parent;
    const title = scope?.link ?? scope?.paragraph;
    if (!scope || !title || scope.labels !== 1) continue;
    const name = capitalizeWords(cleanText(title.element, nameLimit));
    // A name that reads blank within its budget can't be saved, so it counts as no name.
    if (!name) continue;
    let holder: Indexed | null = entry.parent;
    while (holder && !(holder.element.key && uuidPattern.test(holder.element.key)))
      holder = holder.parent;
    const sourceId = holder?.labels === 1 ? holder.element.key!.toLowerCase() : null;
    const identity = sourceId ?? label;
    if (seen.has(identity)) continue;
    seen.add(identity);
    // Scopes hold one label each, so they don't overlap and the scans stay linear overall.
    const chips: string[] = [];
    const cells = columns && entry.parent ? cellsOf(entry.parent.element) : [];
    if (columns && cells.length === columns.length) {
      // A table cell becomes a chip such as `Sets 4`. The # and Exercise columns hold the
      // label and name, and a dash marks an empty cell.
      for (const [at, cell] of cells.entries()) {
        const value = cleanText(cell, chipTextLimit);
        if (!/^(?:#|exercise)?$/i.test(columns[at]!) && !/^[—–-]?$/.test(value))
          chips.push(clean(`${columns[at]} ${value}`, chipTextLimit));
      }
    } else
      for (let at = scope.index + 1, read = 0; at < scope.end && read < chipLimit * 2; at++) {
        const element = all[at]!.element;
        if (element.tag !== "span" || !element.visible) continue;
        read++;
        const text = cleanText(element, chipTextLimit);
        if (text && text !== label && text !== name && chips.length < chipLimit) chips.push(text);
      }
    exercises.push({ sourceId, label, name, position, entry, ...readChips(chips) });
    if (exercises.length > trackedExerciseLimit)
      throw new WorkoutImportError(
        "too-large",
        `This workout has more than ${trackedExerciseLimit} exercises. Split it in Tracked and import each part.`,
      );
  }
  if (!exercises.length) {
    // Only each heading's or paragraph's own strings are read, so every string is read once.
    const unavailable = all.some(
      ({ element }) =>
        (element.tag === "h1" || element.tag === "h2" || element.tag === "p") &&
        unavailablePattern.test(
          clean(
            element.children
              .filter((child) => typeof child === "string")
              .join("")
              .slice(0, 2000),
            400,
          ),
        ),
    );
    throw unavailable ? unavailableWorkout() : unrecognizedPage();
  }

  // The nearest heading above the exercise list is the workout title.
  let heading: Indexed | null = null;
  for (let at = exercises[0]!.entry.parent; at && !heading; at = at.parent) heading = at.heading;
  const ogTitle = all.find(({ element }) => element.meta?.property === "og:title")?.element.meta
    ?.content;
  const name = capitalizeWords(
    heading
      ? cleanText(heading.element, nameLimit)
      : clean((ogTitle ?? "").slice(0, nameLimit * 4), nameLimit),
  );
  if (!name) throw unrecognizedPage();
  const siblings = heading?.element.parent?.children ?? [];
  const category = heading
    ? siblings
        .slice(siblings.indexOf(heading.element) + 1)
        .find((child): child is PageElement => typeof child !== "string" && child.tag === "span")
    : undefined;
  const categoryText = category ? cleanText(category, 100) : "";

  const order = (label: string) => {
    const [, group, letter] = labelPattern.exec(label)!;
    return Number(group) * 32 + letter!.charCodeAt(0) - 65;
  };
  return {
    source: "tracked",
    sourceId: workoutId.toLowerCase(),
    name,
    category: categoryText || null,
    exercises: exercises
      .sort((a, b) => order(a.label) - order(b.label) || a.position - b.position)
      .map(({ position: _position, entry: _entry, ...exercise }) => exercise),
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  exerciseListText,
  linkToNext,
  moveRow,
  supersetSpan,
  validGroups,
} from "../src/exercise/supersets.ts";

type Row = { id: string; superset?: string };
/** Rows from a pattern: "a1 b1 c d" is a and b in superset 1, then c and d in none. */
const rows = (pattern: string): Row[] =>
  pattern.split(" ").map((item) => ({
    id: item[0]!,
    ...(item.length > 1 ? { superset: item.slice(1) } : {}),
  }));
const pattern = (list: readonly Row[]) =>
  list.map((row) => `${row.id}${row.superset ?? ""}`).join(" ");

test("a superset is two or more adjacent rows with one key", () => {
  const list = rows("a1 b1 c1 d e2 f3");
  assert.deepEqual(supersetSpan(list, 0), [0, 2]);
  assert.deepEqual(supersetSpan(list, 2), [0, 2]);
  assert.equal(supersetSpan(list, 3), null);
  // A key no neighbor shares groups nothing.
  assert.equal(supersetSpan(list, 4), null);
  assert.equal(supersetSpan(list, 9), null);
  assert.equal(pattern(validGroups(list)), "a1 b1 c1 d e f");
});

test("joining links a row to the next, taking in either one's superset", () => {
  assert.equal(pattern(linkToNext(rows("a b c"), 0, true)), "a1 b1 c");
  assert.equal(pattern(linkToNext(rows("a1 b1 c"), 1, true)), "a1 b1 c1");
  assert.equal(pattern(linkToNext(rows("a b1 c1"), 0, true)), "a1 b1 c1");
  // Two supersets become one, and a new key never reuses one in use.
  assert.equal(pattern(linkToNext(rows("a1 b1 c2 d2 e f"), 1, true)), "a1 b1 c1 d1 e f");
  assert.equal(pattern(linkToNext(rows("a1 b1 c d"), 2, true)), "a1 b1 c2 d2");
  // Already linked, the last row or a missing one changes nothing.
  for (const [list, index] of [
    [rows("a1 b1"), 0],
    [rows("a b"), 1],
    [rows("a b"), -1],
  ] as const)
    assert.equal(linkToNext(list, index, true), list);
});

test("splitting cuts a superset after the row; a row left alone leaves it", () => {
  assert.equal(pattern(linkToNext(rows("a1 b1 c1 d1"), 1, false)), "a1 b1 c2 d2");
  assert.equal(pattern(linkToNext(rows("a1 b1 c1"), 0, false)), "a b2 c2");
  assert.equal(pattern(linkToNext(rows("a1 b1 c1"), 1, false)), "a1 b1 c");
  assert.equal(pattern(linkToNext(rows("a1 b1"), 0, false)), "a b");
  const unlinked = rows("a1 b1 c");
  assert.equal(linkToNext(unlinked, 1, false), unlinked);
});

test("a moved row keeps its superset while beside it and never lands inside another", () => {
  // Within its superset, or at its edge, it stays in.
  assert.equal(pattern(moveRow(rows("a1 b1 c"), 1, 0)), "b1 a1 c");
  // Moved away, it leaves, and a superset of one stops being one.
  assert.equal(pattern(moveRow(rows("a1 b1 c"), 1, 2)), "a c b");
  assert.equal(pattern(moveRow(rows("a1 b1 c1 d"), 0, 3)), "b1 c1 d a");
  // A row moving into a superset it isn't in lands past it, either way.
  assert.equal(pattern(moveRow(rows("a1 b1 c"), 2, 1)), "c a1 b1");
  assert.equal(pattern(moveRow(rows("c a1 b1 d"), 0, 1)), "a1 b1 c d");
  assert.equal(pattern(moveRow(rows("a b1 c1 d2 e2"), 0, 3)), "b1 c1 d2 e2 a");
  // A row from another superset jumps it too, and leaves its own.
  assert.equal(pattern(moveRow(rows("a1 b1 c2 d2"), 1, 2)), "a c2 d2 b");
  // Beside a superset it isn't in, it stays out.
  assert.equal(pattern(moveRow(rows("a1 b1 c d"), 3, 2)), "a1 b1 d c");
});

test("an exercise list joins each superset's names and says superset to screen readers", () => {
  const names = (list: Row[]) => list.map((row) => ({ ...row, name: row.id.toUpperCase() }));
  assert.deepEqual(exerciseListText(names(rows("a1 b1 c d2 e2 f2")), " · "), {
    text: "A + B · C · D + E + F",
    label: "superset of A and B, C, superset of D, E and F",
  });
  assert.deepEqual(exerciseListText(names(rows("a b3")), ", "), { text: "A, B", label: "A, B" });
  assert.deepEqual(exerciseListText([], ", "), { text: "", label: "" });
});

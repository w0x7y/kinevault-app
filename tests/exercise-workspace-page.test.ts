import assert from "node:assert/strict";
import test from "node:test";
import {
  keepShown,
  librarySearch,
  moreResults,
  resultPage,
  workspaceView,
} from "../src/exercise/workspace-page.ts";

const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("the row on screen is the selected one, or the first, between its Back and Next rows", () => {
  assert.deepEqual(workspaceView(rows, "b"), {
    selected: rows[1],
    previous: rows[0],
    next: rows[2],
  });
  assert.deepEqual(workspaceView(rows, "c"), {
    selected: rows[2],
    previous: rows[1],
    next: undefined,
  });
  // No selection, or a row that's gone, shows the first.
  for (const selectedId of [null, undefined, "gone"])
    assert.deepEqual(workspaceView(rows, selectedId), {
      selected: rows[0],
      previous: undefined,
      next: rows[1],
    });
  assert.deepEqual(workspaceView([], "a"), {
    selected: undefined,
    previous: undefined,
    next: undefined,
  });
});

test("a live superset goes in rounds until each of its exercises is done, then moves on", () => {
  const list = [
    { id: "warm" },
    { id: "a", superset: "1" },
    { id: "b", superset: "1" },
    { id: "c", superset: "1" },
    { id: "cool" },
  ];
  const steps = (selectedId: string, done: readonly string[]) => {
    const { previous, next } = workspaceView(list, selectedId, (row) => done.includes(row.id));
    return [previous?.id, next?.id];
  };
  // Next goes through the superset and returns to its first from its last; Back mirrors it.
  assert.deepEqual(steps("a", []), ["c", "b"]);
  assert.deepEqual(steps("b", []), ["a", "c"]);
  assert.deepEqual(steps("c", ["a", "b"]), ["b", "a"]);
  // Once every exercise in it is done, Next and Back leave it.
  assert.deepEqual(steps("c", ["a", "b", "c"]), ["b", "cool"]);
  assert.deepEqual(steps("a", ["a", "b", "c"]), ["warm", "b"]);
  // Outside a superset, and without rounds, Back and Next follow the order.
  assert.deepEqual(steps("warm", []), [undefined, "a"]);
  assert.deepEqual(steps("cool", []), ["c", undefined]);
  const { previous, next } = workspaceView(list, "c");
  assert.deepEqual([previous?.id, next?.id], ["b", "cool"]);
  // A key no neighbor shares is no superset, so it never loops to itself.
  const lone = workspaceView([{ id: "x", superset: "1" }, { id: "y" }], "x", () => false);
  assert.equal(lone.next?.id, "y");
});

test("rows about to move keep the row on screen, even one shown for being first", () => {
  assert.equal(keepShown(rows, "b"), "b");
  assert.equal(keepShown(rows, null), "a");
  assert.equal(keepShown(rows, "gone"), "a");
  assert.equal(keepShown([], null), undefined);
});

test("a new search starts on its first page, and Show more adds a page", () => {
  const first = librarySearch("squ");
  assert.deepEqual(first, { query: "squ", limit: 20 });
  assert.deepEqual(moreResults(moreResults(first)), { query: "squ", limit: 60 });
  assert.deepEqual(librarySearch("press"), { query: "press", limit: 20 });
});

test("a result page holds the matches within the limit and says whether more follow", () => {
  assert.deepEqual(resultPage([1, 2, 3], 2), { items: [1, 2], more: true });
  assert.deepEqual(resultPage([1, 2], 2), { items: [1, 2], more: false });
  assert.deepEqual(resultPage([], 2), { items: [], more: false });
});

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

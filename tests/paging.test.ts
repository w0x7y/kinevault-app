import assert from "node:assert/strict";
import test from "node:test";
import { pagedResults } from "../src/components/paging.ts";

const items = Array.from({ length: 41 }, (_, index) => index);

test("a page holds `size` items and counts the pages there are", () => {
  assert.deepEqual(pagedResults(items, 1, 20), {
    items: items.slice(20, 40),
    page: 1,
    pageCount: 3,
    total: 41,
  });
  assert.deepEqual(pagedResults(items, 2, 20).items, [40]);
});

test("a page past the end shows the last one, and bad pages the first", () => {
  assert.equal(pagedResults(items, 9, 20).page, 2, "a list that shrank keeps its last page");
  for (const page of [-1, Number.NaN, Number.POSITIVE_INFINITY])
    assert.equal(pagedResults(items, page, 20).page, 0, String(page));
  assert.equal(pagedResults(items, 1.7, 20).page, 1);
  assert.deepEqual(pagedResults([], 3, 20), { items: [], page: 0, pageCount: 0, total: 0 });
});

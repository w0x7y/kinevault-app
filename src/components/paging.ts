/**
 * One page of `items`, `size` at a time. `page` is clamped to the pages there are, so a list that
 * shrinks under its pager shows its last page, and an empty list its first.
 */
export function pagedResults<Item>(items: readonly Item[], page: number, size: number) {
  const pageCount = Math.ceil(items.length / size);
  const current = Math.min(
    Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0,
    Math.max(0, pageCount - 1),
  );
  return {
    items: items.slice(current * size, (current + 1) * size),
    page: current,
    pageCount,
    total: items.length,
  };
}
export type ResultPage = Pick<ReturnType<typeof pagedResults>, "page" | "pageCount" | "total">;

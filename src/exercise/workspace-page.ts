import { exerciseResultPage } from "./model.ts";

// The page rules Workout edits and Workout template drafts share for `WorkoutWorkspace`. Each owner
// keeps the state in its own entry, so a remounted page reopens where it was.

/** A library search: what's typed and how many of its results show. */
export type LibrarySearch = { query: string; limit: number };

/** A new search starts on its first page. */
export function librarySearch(query: string): LibrarySearch {
  return { query, limit: exerciseResultPage };
}

/** "Show more exercises": the next page joins the results. */
export function moreResults({ query, limit }: LibrarySearch): LibrarySearch {
  return { query, limit: limit + exerciseResultPage };
}

/** The results within a search's limit, and whether more follow. */
export function resultPage<Item>(matches: readonly Item[], limit: number) {
  return { items: matches.slice(0, limit), more: matches.length > limit };
}

/** The row on screen (the selected one, or the first) and the rows Back and Next go to. */
export function workspaceView<Row extends { id: string }>(
  rows: readonly Row[],
  selectedId: string | null | undefined,
): { selected: Row | undefined; previous: Row | undefined; next: Row | undefined } {
  const index = Math.max(
    0,
    rows.findIndex((row) => row.id === selectedId),
  );
  return { selected: rows[index], previous: rows[index - 1], next: rows[index + 1] };
}

/**
 * The selection for rows about to move: the row on screen, so it stays on screen even when it
 * showed only for being first.
 */
export function keepShown(rows: readonly { id: string }[], selectedId: string | null | undefined) {
  return workspaceView(rows, selectedId).selected?.id;
}

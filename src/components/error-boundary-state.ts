export type BoundaryState = {
  /** The subtree threw during render and the fallback is showing. */
  failed: boolean;
  /** Consecutive crashes since the child subtree last committed successfully. */
  crashes: number;
  /** Fixed, user-safe message chosen for the current failure. */
  message: string;
};

export type BoundaryEvent =
  { kind: "crash"; error: unknown } | { kind: "reload" } | { kind: "recovered" };

export type ReloadAction = "remount" | "full";

/** Remounts before Reload falls back to a full page reload on web. */
export const remountLimit = 2;

export const initialBoundaryState: BoundaryState = {
  failed: false,
  crashes: 0,
  message: "",
};

const messages = {
  generic: "Something went wrong on this screen. Your saved tracking is safe.",
  loading: "Part of the app didn't load. Your saved tracking is safe.",
};

/**
 * Picks a fixed message for the fallback. It never returns `error.message`
 * or a stack trace: those can embed user data such as names or food entries.
 * Only the error's `name` is inspected, against a closed set of known names.
 */
export function errorMessageFor(error: unknown): string {
  try {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ChunkLoadError"
    )
      return messages.loading;
  } catch {
    /* A thrown value can have hostile getters; recovery still works. */
  }
  return messages.generic;
}

export function nextBoundaryState(previous: BoundaryState, event: BoundaryEvent): BoundaryState {
  switch (event.kind) {
    case "crash":
      return {
        failed: true,
        crashes: previous.crashes + 1,
        message: errorMessageFor(event.error),
      };
    case "reload":
      // Remount the children; keep the crash count so a subtree that keeps
      // failing can escalate to a full reload instead of looping forever.
      return { ...previous, failed: false };
    case "recovered":
      return initialBoundaryState;
  }
}

/**
 * Reload always remounts first. On web, once remounting has failed
 * `remountLimit` times in a row, Reload becomes a full page reload, which
 * clears in-memory state only; persisted data is untouched.
 */
export function reloadActionFor(state: BoundaryState, platform: string): ReloadAction {
  if (platform === "web" && state.crashes > remountLimit) return "full";
  return "remount";
}

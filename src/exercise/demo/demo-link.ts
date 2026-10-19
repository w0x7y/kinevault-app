import type { CatalogLink, ExerciseDefinition } from "../model.ts";
import type { CatalogExercise } from "./catalog.ts";
import type { DemoCatalogState } from "./catalog-store.ts";

/**
 * The demo for a template or workout exercise. The library's current definition
 * decides, so linking or unlinking applies to existing workouts; a deleted
 * library exercise falls back to the copy saved in the workout.
 */
export function resolveDemoLink(
  library: readonly ExerciseDefinition[],
  exercise: ExerciseDefinition,
): CatalogLink | null {
  const current = library.find((item) => item.id === exercise.id);
  return (current ?? exercise).catalog ?? null;
}

export type DemoStatus =
  | { kind: "loading" }
  | { kind: "connect" }
  | { kind: "catalog-unavailable" }
  | { kind: "unavailable" }
  | { kind: "failed"; offline: boolean }
  | { kind: "ready"; entry: CatalogExercise; videoPath: string; posterPath: string };

export function demoStatus({
  state,
  link,
  mediaFailed,
  offline,
}: {
  state: DemoCatalogState;
  link: CatalogLink;
  mediaFailed: boolean;
  offline: boolean;
}): DemoStatus {
  if (state.kind === "loading") return { kind: "loading" };
  if (state.kind === "failed")
    return offline ? { kind: "connect" } : { kind: "catalog-unavailable" };
  const entry = state.byId.get(link.id);
  if (entry?.status !== "published") return { kind: "unavailable" };
  if (mediaFailed) return { kind: "failed", offline };
  return { kind: "ready", entry, videoPath: entry.videoPath, posterPath: entry.posterPath };
}

const connectText = "Connect to load this demonstration.";

/**
 * The player's status line and what its Retry button retries: the catalog download
 * or the clip. `null` status means demos aren't configured; a ready demo shows none.
 */
export function demoNotice(
  status: DemoStatus | null,
): { text: string; retry?: "catalog" | "media" } | null {
  if (!status || status.kind === "unavailable") return { text: "Demonstration unavailable." };
  if (status.kind === "loading") return { text: "Loading demonstration." };
  if (status.kind === "connect") return { text: connectText, retry: "catalog" };
  if (status.kind === "catalog-unavailable")
    return {
      text: "KineVault demos aren't available right now. Try again later.",
      retry: "catalog",
    };
  if (status.kind === "failed")
    return {
      text: status.offline
        ? connectText
        : "Couldn't load this demonstration. Check your connection and try again.",
      retry: "media",
    };
  return null;
}

/**
 * One try at showing a demo's media. `starting` is a tapped clip that hasn't reached
 * readyToPlay yet; only then can the start timeout fail it. `attempt` keys the poster
 * and video so a retry remounts them.
 */
export type DemoPlayback = {
  phase: "poster" | "starting" | "playing";
  failed: boolean;
  attempt: number;
};

export type DemoPlaybackEvent = "play" | "started" | "failed" | "timed-out" | "blurred" | "retry";

export const initialDemoPlayback: DemoPlayback = { phase: "poster", failed: false, attempt: 0 };

export function demoPlayback(state: DemoPlayback, event: DemoPlaybackEvent): DemoPlayback {
  switch (event) {
    case "play":
      return state.phase === "poster" ? { ...state, phase: "starting" } : state;
    case "started":
      return state.phase === "starting" ? { ...state, phase: "playing" } : state;
    case "failed":
      return state.failed ? state : { ...state, failed: true };
    // A request that never answers raises no error; buffering after the start doesn't count.
    case "timed-out":
      return state.phase === "starting" && !state.failed ? { ...state, failed: true } : state;
    // Tab screens stay mounted when blurred, so leaving the screen returns to the poster.
    case "blurred":
      return state.phase === "poster" ? state : { ...state, phase: "poster" };
    case "retry":
      return { phase: "poster", failed: false, attempt: state.attempt + 1 };
  }
}

/**
 * The exercise form's KineVault search: its query, whether a linked demo is being changed, and
 * the control that takes focus next, since each press replaces the control that was pressed.
 */
export type DemoPicker = { query: string; changing: boolean; focus: "search" | "change" | null };

export type DemoPickerEvent =
  "change" | "keep" | "unlink" | "linked" | "focused" | { query: string };

/** "Link demo" opens the form with its search focused. */
export function initialDemoPicker(focusSearch: boolean): DemoPicker {
  return { query: "", changing: false, focus: focusSearch ? "search" : null };
}

export function demoPicker(state: DemoPicker, event: DemoPickerEvent): DemoPicker {
  if (typeof event === "object") return { ...state, query: event.query };
  switch (event) {
    // Change and Unlink give way to the search.
    case "change":
      return { ...state, changing: true, focus: "search" };
    case "unlink":
      return { ...state, changing: false, focus: "search" };
    // Keeping the demo or choosing a result gives way to the linked demo and its Change button.
    case "keep":
      return { ...state, changing: false, focus: "change" };
    case "linked":
      return { query: "", changing: false, focus: "change" };
    case "focused":
      return state.focus === null ? state : { ...state, focus: null };
  }
}

/** The KineVault search's status line. */
export function demoSearchStatus({
  failed,
  offline,
  query,
  results,
}: {
  failed: boolean;
  offline: boolean;
  query: string;
  results: readonly CatalogExercise[];
}) {
  if (failed)
    return offline
      ? "Connect to search KineVault demos."
      : "KineVault demos aren't available right now. Try again later.";
  if (!query.trim()) return "";
  if (!results.length) return "No KineVault exercises found. Try another name.";
  return `${results.length} KineVault ${results.length === 1 ? "exercise" : "exercises"} found.`;
}

export type ExerciseFields = Omit<ExerciseDefinition, "id">;

/** Links a KineVault exercise and fills only the fields the user left blank. */
export function applyCatalogLink(fields: ExerciseFields, entry: CatalogExercise): ExerciseFields {
  return {
    ...fields,
    catalog: { id: entry.id, slug: entry.slug },
    name: fields.name.trim() ? fields.name : entry.name,
    muscleGroup: fields.muscleGroup.trim() ? fields.muscleGroup : entry.muscleGroup,
    equipment: fields.equipment.trim() ? fields.equipment : entry.equipment,
  };
}

export function withoutCatalogLink(fields: ExerciseFields): ExerciseFields {
  const { catalog: _catalog, ...rest } = fields;
  return rest;
}

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
  if (!entry || entry.status !== "published" || !entry.videoPath || !entry.posterPath)
    return { kind: "unavailable" };
  if (mediaFailed) return { kind: "failed", offline };
  return { kind: "ready", entry, videoPath: entry.videoPath, posterPath: entry.posterPath };
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

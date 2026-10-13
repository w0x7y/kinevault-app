// KineVault exercises mirrored into Track's `catalog_exercises` table by
// scripts/publish-catalog.mjs. Rows are untrusted network data.
export type CatalogExercise = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  muscleGroup: string;
  equipment: string;
  status: "published" | "withdrawn";
  videoPath: string | null;
  posterPath: string | null;
  credit: string;
};

/** Columns requested from `catalog_exercises`, in PostgREST `select` syntax. */
export const catalogColumns =
  "id,slug,name,aliases,muscle_group,equipment,status,video_path,poster_path,credit";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid catalog row");
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, required = false): string {
  if (typeof value !== "string" || value.length > limit || (required && !value.trim()))
    throw new Error("Invalid catalog text");
  return value;
}
function objectPath(value: unknown, id: string, extension: "mp4" | "webp"): string | null {
  if (value === null) return null;
  // `id` is a validated UUID, so it is safe inside the pattern.
  if (typeof value !== "string" || !new RegExp(`^${id}/[0-9a-f]{16}\\.${extension}$`).test(value))
    throw new Error("Invalid catalog media path");
  return value;
}

export function parseCatalogRow(value: unknown): CatalogExercise {
  const row = record(value);
  const id = text(row.id, 36);
  if (!idPattern.test(id)) throw new Error("Invalid catalog ID");
  const slug = text(row.slug, 200);
  if (!slugPattern.test(slug)) throw new Error("Invalid catalog slug");
  if (row.status !== "published" && row.status !== "withdrawn")
    throw new Error("Invalid catalog status");
  if (!Array.isArray(row.aliases)) throw new Error("Invalid catalog aliases");
  const aliases = row.aliases
    .filter((alias): alias is string => typeof alias === "string" && alias.trim() !== "")
    .filter((alias) => alias.length <= 400)
    .slice(0, 50);
  const videoPath = objectPath(row.video_path, id, "mp4");
  const posterPath = objectPath(row.poster_path, id, "webp");
  if (row.status === "published" && (!videoPath || !posterPath))
    throw new Error("Published catalog row without media");
  return {
    id,
    slug,
    name: text(row.name, 400, true),
    aliases,
    muscleGroup: text(row.muscle_group, 400),
    equipment: text(row.equipment, 400),
    status: row.status,
    videoPath,
    posterPath,
    credit: text(row.credit, 1000, true),
  };
}

/** Parses a response page. One invalid row hides only its own demo. */
export function parseCatalogRows(value: unknown): CatalogExercise[] {
  if (!Array.isArray(value)) throw new Error("Invalid catalog response");
  const entries: CatalogExercise[] = [];
  for (const row of value) {
    try {
      entries.push(parseCatalogRow(row));
    } catch {
      // Skip this row; the others still load.
    }
  }
  return entries;
}

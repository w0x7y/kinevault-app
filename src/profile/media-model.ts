export type PhotoSource = { uri: string; width: number; height: number; file?: Blob };
export type StoredPhoto = { id: string; width: number; height: number };
export type ProgressPhoto = { id: string; date: string; note: string; image: StoredPhoto };
export type ProfileMediaDocument = {
  version: 1;
  avatar: StoredPhoto | null;
  photos: ProgressPhoto[];
};
export class MediaIdentityCollisionError extends Error {
  constructor() {
    super("Photo identity already exists");
  }
}
export type MediaFiles = {
  assertAvailable?(id: string): Promise<void>;
  importPhoto(source: PhotoSource, id: string): Promise<StoredPhoto>;
  resolvePhoto(image: StoredPhoto, thumbnail?: boolean): Promise<string>;
  removePhoto(image: StoredPhoto): Promise<void>;
  releaseUri(uri: string): void;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSafeMediaId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}

export function isPhotoDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function fitPhotoDimensions(
  width: number,
  height: number,
  maximum: number,
): { width: number; height: number } {
  if (!isPhotoDimension(width) || !isPhotoDimension(height) || !isPhotoDimension(maximum)) {
    throw new Error("Invalid photo dimensions");
  }
  const scale = Math.min(1, maximum / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function validatePhotoSource(source: PhotoSource): void {
  if (
    !source ||
    typeof source.uri !== "string" ||
    !source.uri.trim() ||
    !isPhotoDimension(source.width) ||
    !isPhotoDimension(source.height)
  ) {
    throw new Error("Invalid photo source");
  }
}

export function validatePhotoDetails(date: unknown, note: unknown): void {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof note !== "string" ||
    note.length > 2000
  )
    throw new Error("Invalid photo details");
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  if (
    year < 1 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    throw new Error("Invalid photo date");
}

export function parseProfileMedia(raw: string | null): ProfileMediaDocument {
  if (raw === null) return { version: 1, avatar: null, photos: [] };
  const value: unknown = JSON.parse(raw);
  if (!record(value) || value.version !== 1 || !Array.isArray(value.photos)) {
    throw new Error("Invalid profile media document");
  }
  const identities = new Set<string>();
  function identity(value: unknown): string {
    if (!isSafeMediaId(value) || identities.has(value))
      throw new Error("Invalid or reused media identity");
    identities.add(value);
    return value;
  }
  function storedPhoto(value: unknown): StoredPhoto {
    if (
      !record(value) ||
      Object.keys(value).some((key) => !["id", "width", "height"].includes(key)) ||
      !isPhotoDimension(value.width) ||
      !isPhotoDimension(value.height)
    ) {
      throw new Error("Invalid stored photo");
    }
    return { id: identity(value.id), width: value.width, height: value.height };
  }
  const avatar = value.avatar === null ? null : storedPhoto(value.avatar);
  const photos = value.photos.map((entry: unknown): ProgressPhoto => {
    if (!record(entry)) throw new Error("Invalid progress photo");
    validatePhotoDetails(entry.date, entry.note);
    return {
      id: identity(entry.id),
      date: entry.date as string,
      note: entry.note as string,
      image: storedPhoto(entry.image),
    };
  });
  return { version: 1, avatar, photos };
}

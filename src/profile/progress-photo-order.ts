import type { ProgressPhoto } from "./media-model";

export function progressPhotoTimeline(saved: readonly ProgressPhoto[]): {
  photos: ProgressPhoto[];
  first: ProgressPhoto | undefined;
  latest: ProgressPhoto | undefined;
} {
  const photos = [...saved].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  return {
    photos,
    first: photos[0],
    latest: photos[photos.length - 1],
  };
}

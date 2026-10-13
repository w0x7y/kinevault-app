export const trackedOrigin = "https://app.tracked.gg";
export type TrackedLink = { url: string; workoutId: string };

const linkPattern =
  /\bhttps?:\/\/app\.tracked\.gg\/v\/workout\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=$|[\s?#/)\]>"'.,;:!])/i;
const pastedTextLimit = 2000;

/**
 * Finds a Tracked workout share link in pasted text, such as a share-sheet message.
 * The request URL is rebuilt from the validated ID, so only Tracked's own host is fetched.
 */
export function readTrackedLink(text: string): TrackedLink | null {
  if (typeof text !== "string" || text.length > pastedTextLimit) return null;
  const match = linkPattern.exec(text);
  if (!match) return null;
  const workoutId = match[1]!.toLowerCase();
  return { url: `${trackedOrigin}/v/workout/${workoutId}`, workoutId };
}

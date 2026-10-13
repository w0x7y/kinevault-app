import {
  oversizedPage,
  unavailableWorkout,
  unrecognizedPage,
  WorkoutImportError,
  type ImportedWorkoutPlan,
} from "./plan.ts";
import {
  downloadTrackedWorkout,
  trackedFailure,
  trackedResponseByteLimit,
  type TrackedDownloadOptions,
  type TrackedPageTransport,
} from "./tracked-download.ts";
import { trackedOrigin, type TrackedLink } from "./tracked-link.ts";

export const linkImportAvailable = true;
export type TrackedFetchOptions = TrackedDownloadOptions & {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
};

const unreachable = () =>
  new WorkoutImportError("network", "Couldn't reach Tracked. Check your connection and try again.");

function directTransport(
  fetch: NonNullable<TrackedFetchOptions["fetch"]> = (url, init) => globalThis.fetch(url, init),
): TrackedPageTransport {
  return async (link, format, signal) => {
    let response: Response;
    try {
      // The page ships its content as a server-component payload when asked with `RSC: 1`.
      response = await fetch(link.url, {
        method: "GET",
        credentials: "omit",
        headers:
          format === "flight"
            ? { RSC: "1", Accept: "text/x-component" }
            : { Accept: "text/html,application/xhtml+xml" },
        signal,
      });
    } catch {
      throw unreachable();
    }
    // Redirects are followed by the platform; content from another host is never parsed.
    if (response.url && !response.url.startsWith(`${trackedOrigin}/`)) throw unrecognizedPage();
    if (response.status === 404 || response.status === 410) throw unavailableWorkout();
    if (!response.ok) throw trackedFailure();
    if (Number(response.headers.get("content-length")) > trackedResponseByteLimit)
      throw oversizedPage();
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw unreachable();
    }
    return { text, html: (response.headers.get("content-type") ?? "").includes("text/html") };
  };
}

/** Downloads a shared Tracked workout straight from Tracked. Native only: Tracked sends no CORS headers. */
export function fetchTrackedWorkout(
  link: TrackedLink,
  options: TrackedFetchOptions = {},
): Promise<ImportedWorkoutPlan> {
  return downloadTrackedWorkout(link, directTransport(options.fetch), options);
}

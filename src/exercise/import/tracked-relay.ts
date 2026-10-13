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
  trackedTimeout,
  type TrackedDownloadOptions,
  type TrackedPageTransport,
} from "./tracked-download.ts";
import type { TrackedLink } from "./tracked-link.ts";

// Browsers can't read Tracked's pages, so the web build asks KineVault's
// `tracked-workout` Supabase Edge Function to download them.
export type TrackedRelay = {
  url: string;
  /** The project's publishable key, sent as `apikey`. */
  apiKey: string;
  /** The signed-in session's access token, or null when signed out. */
  accessToken(): Promise<string | null>;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
};

const service = "tracked-workout";
// The page text is JSON-escaped in the reply.
const replyByteLimit = 4 * trackedResponseByteLimit;
// Longer than the function's own 15-second limit on Tracked, so its answer arrives first.
const relayTimeoutMs = 20_000;

const notSetUp = () =>
  new WorkoutImportError(
    "unsupported",
    "Importing from a link isn't set up for the web yet. Use the KineVault iOS or Android app.",
  );
const unreachable = () =>
  new WorkoutImportError(
    "network",
    "Importing from a link isn't available on the web right now. Check your connection and try again, or use the KineVault iOS or Android app.",
  );
const relayFailure = () =>
  new WorkoutImportError(
    "network",
    "Couldn't get this workout right now. Try again later, or use the KineVault iOS or Android app.",
  );
const signedOut = () =>
  new WorkoutImportError("signed-out", "Sign in again to import a workout from a link.");

/** The function's address for a Supabase project URL, or null when it isn't usable. */
export function trackedRelayUrl(supabaseUrl: string | undefined): string | null {
  const base = supabaseUrl?.trim();
  if (!base) return null;
  try {
    const parsed = new URL(base);
    if (
      parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))
    )
      return null;
  } catch {
    return null;
  }
  return `${base.replace(/\/+$/, "")}/functions/v1/${service}`;
}

/** The function's JSON reply, or null for anything else, such as a platform error page. */
async function readReply(response: Response): Promise<Record<string, unknown> | null> {
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return null;
  if (Number(response.headers.get("content-length")) > replyByteLimit) throw oversizedPage();
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw unreachable();
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  // Every reply from the function names it. Supabase's own 404 for a function that
  // isn't deployed doesn't, so it can't be mistaken for a missing workout.
  return body && typeof body === "object" && (body as Record<string, unknown>).service === service
    ? (body as Record<string, unknown>)
    : null;
}

function relayTransport(relay: TrackedRelay): TrackedPageTransport {
  const fetch = relay.fetch ?? ((url, init) => globalThis.fetch(url, init));
  return async (link, format, signal) => {
    const token = await relay.accessToken();
    if (!token) throw signedOut();
    let response: Response;
    try {
      response = await fetch(relay.url, {
        method: "POST",
        credentials: "omit",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: relay.apiKey,
          "Content-Type": "application/json",
        },
        // Only the workout ID is sent. The function builds Tracked's URL itself.
        body: JSON.stringify({ workoutId: link.workoutId, format }),
        signal,
      });
    } catch {
      // Browsers report a function that isn't deployed as a CORS failure, which
      // looks the same as a lost connection.
      throw unreachable();
    }
    const reply = await readReply(response);
    if (!reply) {
      // The platform checks the session token before the function runs.
      if (response.status === 401) throw signedOut();
      if (response.status === 404) throw notSetUp();
      throw relayFailure();
    }
    const { format: replied, text } = reply;
    if (response.ok && typeof text === "string" && (replied === "flight" || replied === "html"))
      return { text, html: replied === "html" };
    switch (reply.error) {
      case "workout-unavailable":
        throw unavailableWorkout();
      case "too-large":
        throw oversizedPage();
      case "unrecognized":
        throw unrecognizedPage();
      case "timeout":
        throw trackedTimeout();
      case "tracked-error":
        throw trackedFailure();
      case "unauthenticated":
        throw signedOut();
      default:
        throw relayFailure();
    }
  };
}

/** Downloads a shared Tracked workout through KineVault's function and parses it. */
export function fetchTrackedWorkoutThroughRelay(
  link: TrackedLink,
  relay: TrackedRelay,
  { signal, timeoutMs = relayTimeoutMs }: TrackedDownloadOptions = {},
): Promise<ImportedWorkoutPlan> {
  return downloadTrackedWorkout(link, relayTransport(relay), { signal, timeoutMs });
}

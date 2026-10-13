import { oversizedPage, WorkoutImportError, type ImportedWorkoutPlan } from "./plan.ts";
import type { TrackedLink } from "./tracked-link.ts";
import { parseTrackedWorkoutPage, readFlightFromHtml } from "./tracked-page.ts";

export const trackedResponseByteLimit = 2 * 1024 * 1024;
export type TrackedPageFormat = "flight" | "html";
export type TrackedPage = { text: string; html: boolean };
/**
 * Gets one share page in the requested format, directly or through a relay. Throws a
 * WorkoutImportError for failures it can explain. `signal` aborts on cancel or timeout.
 */
export type TrackedPageTransport = (
  link: TrackedLink,
  format: TrackedPageFormat,
  signal: AbortSignal,
) => Promise<TrackedPage>;
export type TrackedDownloadOptions = { signal?: AbortSignal; timeoutMs?: number };

const cancelled = () => new WorkoutImportError("cancelled", "Import cancelled.");
export const trackedTimeout = () =>
  new WorkoutImportError("timeout", "Tracked took too long to respond. Try again.");
export const trackedFailure = () =>
  new WorkoutImportError(
    "network",
    "Tracked couldn't load this workout right now. Try again later.",
  );

function utf8Bytes(text: string): number {
  let size = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    size += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (size > trackedResponseByteLimit) break;
  }
  return size;
}

async function request(
  link: TrackedLink,
  format: TrackedPageFormat,
  transport: TrackedPageTransport,
  { signal, timeoutMs = 15_000 }: TrackedDownloadOptions,
): Promise<TrackedPage> {
  if (signal?.aborted) throw cancelled();
  const controller = new AbortController();
  let stop: (error: WorkoutImportError) => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => {
    stop = (error) => {
      controller.abort();
      reject(error);
    };
  });
  const cancel = () => stop(cancelled());
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => stop(trackedTimeout()), timeoutMs);
  const load = async () => {
    const page = await transport(link, format, controller.signal);
    if (utf8Bytes(page.text) > trackedResponseByteLimit) throw oversizedPage();
    return page;
  };
  try {
    return await Promise.race([load(), stopped]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    stopped.catch(() => {});
  }
}

/** Downloads a shared Tracked workout through `transport` and parses it. */
export async function downloadTrackedWorkout(
  link: TrackedLink,
  transport: TrackedPageTransport,
  options: TrackedDownloadOptions = {},
): Promise<ImportedWorkoutPlan> {
  const first = await request(link, "flight", transport, options);
  try {
    return parseTrackedWorkoutPage(
      first.html ? readFlightFromHtml(first.text) : first.text,
      link.workoutId,
    );
  } catch (error) {
    if (first.html || !(error instanceof WorkoutImportError) || error.kind !== "unrecognized")
      throw error;
  }
  // The normal HTML page embeds the same payload, if the server-component response changes.
  const page = await request(link, "html", transport, options);
  return parseTrackedWorkoutPage(readFlightFromHtml(page.text), link.workoutId);
}

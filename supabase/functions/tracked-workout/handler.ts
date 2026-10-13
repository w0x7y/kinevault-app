import {
  jsonReply,
  preflightReply,
  readJsonRequest,
  readLimited,
  type RejectedRequest,
} from "../_shared/request.ts";

type Identity = { id: string };
export type TrackedWorkoutPort = {
  authenticate(token: string): Promise<Identity | null>;
  fetch(url: string, init: RequestInit): Promise<Response>;
};
type PageFormat = "flight" | "html";

const trackedOrigin = "https://app.tracked.gg";
// The IDs the app reads from share links (src/exercise/import/tracked-link.ts).
const workoutIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requestByteLimit = 512;
const pageByteLimit = 2 * 1024 * 1024;
const redirectLimit = 3;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const pageFormats: Record<string, PageFormat> = {
  "text/x-component": "flight",
  "text/html": "html",
};

const rejections = {
  method: [405, "method-not-allowed"],
  unauthenticated: [401, "unauthenticated"],
  "too-large": [413, "request-too-large"],
  invalid: [400, "invalid-request"],
} as const satisfies Record<RejectedRequest, readonly [number, string]>;

// Every reply names the function, so clients can tell it apart from a platform
// error, such as Supabase's 404 for a function that isn't deployed.
function reply(status: number, body: Record<string, unknown>) {
  return jsonReply(status, { service: "tracked-workout", ...body });
}
function discard(response: Response) {
  void response.body?.cancel().catch(() => {});
}

/** A redirect is followed only within Tracked's app origin. */
function redirectTarget(from: string, location: string | null): string | null {
  if (!location) return null;
  try {
    const next = new URL(location, from);
    return next.origin === trackedOrigin && !next.username && !next.password ? next.href : null;
  } catch {
    return null;
  }
}

async function loadPage(
  port: TrackedWorkoutPort,
  workoutId: string,
  format: PageFormat,
  signal: AbortSignal,
): Promise<Response> {
  let url = `${trackedOrigin}/v/workout/${workoutId}`;
  for (let redirects = 0; ; redirects++) {
    let response: Response;
    try {
      response = await port.fetch(url, {
        method: "GET",
        credentials: "omit",
        redirect: "manual",
        headers:
          format === "flight"
            ? { RSC: "1", Accept: "text/x-component" }
            : { Accept: "text/html,application/xhtml+xml" },
        signal,
      });
    } catch {
      return reply(502, { error: "tracked-error" });
    }
    if (redirectStatuses.has(response.status)) {
      discard(response);
      const next = redirectTarget(url, response.headers.get("location"));
      if (!next || redirects === redirectLimit) return reply(502, { error: "unrecognized" });
      url = next;
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      discard(response);
      return reply(404, { error: "workout-unavailable" });
    }
    if (!response.ok) {
      discard(response);
      return reply(502, { error: "tracked-error" });
    }
    const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    const page = Object.hasOwn(pageFormats, type) ? pageFormats[type] : undefined;
    if (!page) {
      discard(response);
      return reply(502, { error: "unrecognized" });
    }
    if (Number(response.headers.get("content-length")) > pageByteLimit) {
      discard(response);
      return reply(502, { error: "too-large" });
    }
    let bytes: Uint8Array<ArrayBuffer> | null;
    try {
      bytes = await readLimited(response.body, pageByteLimit);
    } catch {
      return reply(502, { error: "tracked-error" });
    }
    if (!bytes) return reply(502, { error: "too-large" });
    return reply(200, { format: page, text: new TextDecoder().decode(bytes) });
  }
}

/**
 * Downloads a public Tracked share page for the web app, which can't read it
 * cross-origin. The caller sends only a workout ID; the URL is built here.
 */
export function createTrackedWorkoutHandler(port: TrackedWorkoutPort, { timeoutMs = 15_000 } = {}) {
  return async (request: Request): Promise<Response> => {
    // Never log request bodies, pages or credentials.
    const read = await readJsonRequest(request, { byteLimit: requestByteLimit });
    if (read.kind === "preflight") return preflightReply();
    if (read.kind === "rejected") {
      const [status, error] = rejections[read.reason];
      return reply(status, { error });
    }
    const { token } = read;
    const { workoutId, format, ...rest } = read.body;
    if (
      Object.keys(rest).length > 0 ||
      typeof workoutId !== "string" ||
      !workoutIdPattern.test(workoutId) ||
      (format !== "flight" && format !== "html")
    )
      return reply(400, { error: "invalid-request" });
    try {
      // The platform's JWT check also accepts the public key, so require a real user.
      if (!(await port.authenticate(token))) return reply(401, { error: "unauthenticated" });
    } catch {
      return reply(503, { error: "auth-unavailable" });
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<Response>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(reply(504, { error: "timeout" }));
      }, timeoutMs);
    });
    try {
      return await Promise.race([
        loadPage(port, workoutId.toLowerCase(), format, controller.signal),
        timedOut,
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}

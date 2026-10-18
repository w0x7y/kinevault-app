import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { unavailableWorkout, WorkoutImportError } from "../src/exercise/import/plan.ts";
import {
  fetchTrackedWorkoutThroughRelay,
  trackedRelayUrl,
  type TrackedRelay,
} from "../src/exercise/import/tracked-relay.ts";
import { createTrackedWorkoutHandler } from "../supabase/functions/tracked-workout/handler.ts";

const page = readFileSync(new URL("./fixtures/tracked-workout.rsc.txt", import.meta.url), "utf8");
const workoutId = "01a11c30-850b-765b-841b-cae702065684";
const link = { url: `https://app.tracked.gg/v/workout/${workoutId}`, workoutId };
const functionUrl = "https://project.supabase.test/functions/v1/tracked-workout";
const notSetUp =
  "Importing from a link isn't set up for the web yet. Use the KineVault iOS or Android app.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
const envelope = (body: Record<string, unknown>, status = 200) =>
  json({ service: "tracked-workout", ...body }, status);
function relay(
  reply: (body: { workoutId: string; format: string }) => Promise<Response> | Response,
  token: string | null = "access-token",
) {
  const requests: { url: string; init: RequestInit }[] = [];
  const config: TrackedRelay = {
    url: functionUrl,
    apiKey: "sb_publishable_fixture_only",
    accessToken: async () => token,
    async fetch(url, init) {
      requests.push({ url, init: init! });
      return reply(JSON.parse(String(init!.body)));
    },
  };
  return { config, requests };
}
function rejects(promise: Promise<unknown>, kind: WorkoutImportError["kind"], message?: string) {
  return assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof WorkoutImportError);
    assert.equal(error.kind, kind);
    if (message) assert.equal(error.message, message);
    return true;
  });
}

test("web import reads the function's envelope with the shared parser", async () => {
  const { config, requests } = relay(() => envelope({ format: "flight", text: page }));
  const plan = await fetchTrackedWorkoutThroughRelay(link, config);
  assert.equal(plan.name, "FB");
  assert.equal(plan.exercises.length, 20);
  assert.equal(requests.length, 1);
  const [{ url, init }] = requests as [{ url: string; init: RequestInit }];
  assert.equal(url, functionUrl);
  assert.equal(init.method, "POST");
  assert.equal(init.credentials, "omit");
  assert.deepEqual(init.headers, {
    Authorization: "Bearer access-token",
    apikey: "sb_publishable_fixture_only",
    "Content-Type": "application/json",
  });
  // Only the ID leaves the device; the function builds Tracked's URL.
  assert.deepEqual(JSON.parse(String(init.body)), { workoutId, format: "flight" });
});

test("web import falls back to the HTML page through the function", async () => {
  const html = `<html><script>self.__next_f.push(${JSON.stringify([1, page])})</script></html>`;
  const { config, requests } = relay(({ format }) =>
    format === "flight"
      ? envelope({ format: "flight", text: "1:null\n" })
      : envelope({ format: "html", text: html }),
  );
  const plan = await fetchTrackedWorkoutThroughRelay(link, config);
  assert.equal(plan.exercises.length, 20);
  assert.deepEqual(
    requests.map(({ init }) => JSON.parse(String(init.body)).format),
    ["flight", "html"],
  );
});

test("web import tells a function that isn't deployed apart from a missing workout", async () => {
  // Supabase's gateway answers an unknown function with its own 404.
  const gateway = relay(() =>
    json({ code: "NOT_FOUND", message: "Requested function was not found" }, 404),
  );
  await rejects(fetchTrackedWorkoutThroughRelay(link, gateway.config), "unsupported", notSetUp);
  const plain = relay(() => new Response("Not Found", { status: 404 }));
  await rejects(fetchTrackedWorkoutThroughRelay(link, plain.config), "unsupported", notSetUp);
  const missing = relay(() => envelope({ error: "workout-unavailable" }, 404));
  await rejects(
    fetchTrackedWorkoutThroughRelay(link, missing.config),
    "not-found",
    unavailableWorkout().message,
  );
  // In a browser the gateway's 404 has no CORS headers, so it surfaces as a failed fetch.
  const blocked = relay(() => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    fetchTrackedWorkoutThroughRelay(link, blocked.config),
    (error: unknown) =>
      error instanceof WorkoutImportError &&
      error.kind === "network" &&
      /isn't available on the web/.test(error.message) &&
      /iOS or Android app/.test(error.message),
  );
});

test("web import explains sign-in, Tracked and function failures", async () => {
  const signedOut = relay(() => envelope({ format: "flight", text: page }), null);
  await rejects(fetchTrackedWorkoutThroughRelay(link, signedOut.config), "signed-out");
  assert.equal(signedOut.requests.length, 0);
  const cases: [Response, WorkoutImportError["kind"]][] = [
    [json({ code: 401, message: "Invalid JWT" }, 401), "signed-out"],
    [envelope({ error: "unauthenticated" }, 401), "signed-out"],
    [envelope({ error: "too-large" }, 502), "too-large"],
    [envelope({ error: "unrecognized" }, 502), "unrecognized"],
    [envelope({ error: "tracked-error" }, 502), "network"],
    [envelope({ error: "timeout" }, 504), "timeout"],
    [envelope({ error: "auth-unavailable" }, 503), "network"],
    [envelope({ format: "flight" }), "network"],
    [envelope({ format: "json", text: page }), "network"],
    [json({ code: "BOOT_ERROR", message: "Function failed to start" }, 503), "network"],
    [new Response("not json", { headers: { "content-type": "application/json" } }), "network"],
    [envelope({ format: "flight", text: page + "é".repeat(1024 * 1024) }), "too-large"],
  ];
  for (const [response, kind] of cases) {
    const { config } = relay(() => response);
    await rejects(fetchTrackedWorkoutThroughRelay(link, config), kind);
  }
});

test("web import can be cancelled and stops waiting for the function", async () => {
  const hung = relay(() => new Promise<Response>(() => {}));
  await rejects(fetchTrackedWorkoutThroughRelay(link, hung.config, { timeoutMs: 20 }), "timeout");
  const controller = new AbortController();
  const pending = fetchTrackedWorkoutThroughRelay(link, hung.config, {
    signal: controller.signal,
  });
  controller.abort();
  await rejects(pending, "cancelled");
  const signal = hung.requests.at(-1)!.init.signal!;
  assert.equal(signal.aborted, true);
});

test("web import and the function agree on the envelope", async () => {
  const upstream: string[] = [];
  const handler = createTrackedWorkoutHandler({
    authenticate: async (token) =>
      token === "access-token" ? { id: "owner", anonymous: false } : null,
    async fetch(url) {
      upstream.push(url);
      return url.endsWith(workoutId)
        ? new Response(page, { headers: { "content-type": "text/x-component" } })
        : new Response("", { status: 404 });
    },
  });
  const through = (token: string | null): TrackedRelay => ({
    url: functionUrl,
    apiKey: "sb_publishable_fixture_only",
    accessToken: async () => token,
    fetch: (url, init) => handler(new Request(url, init)),
  });
  const plan = await fetchTrackedWorkoutThroughRelay(link, through("access-token"));
  assert.equal(plan.exercises.length, 20);
  assert.deepEqual(upstream, [link.url]);
  const otherId = "00000000-0000-4000-8000-000000000000";
  await rejects(
    fetchTrackedWorkoutThroughRelay(
      { url: `https://app.tracked.gg/v/workout/${otherId}`, workoutId: otherId },
      through("access-token"),
    ),
    "not-found",
  );
  await rejects(fetchTrackedWorkoutThroughRelay(link, through("expired")), "signed-out");
});

test("web import is configured only with a usable Supabase URL", () => {
  assert.equal(
    trackedRelayUrl("https://project.supabase.co"),
    `https://project.supabase.co/functions/v1/tracked-workout`,
  );
  assert.equal(
    trackedRelayUrl(" https://project.supabase.co/ "),
    `https://project.supabase.co/functions/v1/tracked-workout`,
  );
  assert.equal(
    trackedRelayUrl("http://localhost:54321"),
    "http://localhost:54321/functions/v1/tracked-workout",
  );
  for (const value of [
    undefined,
    "",
    "  ",
    "not a url",
    "http://project.supabase.co",
    "ftp://x.test",
  ])
    assert.equal(trackedRelayUrl(value), null, String(value));
});

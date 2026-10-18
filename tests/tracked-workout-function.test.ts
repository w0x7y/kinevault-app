import assert from "node:assert/strict";
import test from "node:test";
import { readTrackedLink } from "../src/exercise/import/tracked-link.ts";
import {
  createTrackedWorkoutHandler,
  type TrackedWorkoutPort,
} from "../supabase/functions/tracked-workout/handler.ts";

const workoutId = "01a11c30-850b-765b-841b-cae702065684";
const pageUrl = `https://app.tracked.gg/v/workout/${workoutId}`;

function page(
  body: BodyInit | null,
  { status = 200, type = "text/x-component", headers = {} } = {},
) {
  return new Response(body, { status, headers: { "content-type": type, ...headers } });
}
function redirect(location: string, status = 307) {
  return new Response(null, { status, headers: { location } });
}
function harness(
  upstream: (url: string, init: RequestInit) => Promise<Response> = async () => page("0:[]\n"),
  {
    user = true,
    timeoutMs = 1000,
  }: { user?: boolean | "anonymous" | "error"; timeoutMs?: number } = {},
) {
  const tokens: string[] = [];
  const requests: { url: string; init: RequestInit }[] = [];
  const port: TrackedWorkoutPort = {
    async authenticate(token) {
      tokens.push(token);
      if (user === "error") throw new Error("Auth down");
      return user ? { id: "owner", anonymous: user === "anonymous" } : null;
    },
    async fetch(url, init) {
      requests.push({ url, init });
      return upstream(url, init);
    },
  };
  const handle = createTrackedWorkoutHandler(port, { timeoutMs });
  const call = (
    body: unknown = { workoutId, format: "flight" },
    { authorization = "Bearer user-token", method = "POST" } = {},
  ) =>
    handle(
      new Request("https://local/tracked-workout", {
        method,
        headers: authorization ? { Authorization: authorization } : {},
        body:
          method === "GET" || method === "OPTIONS"
            ? null
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
      }),
    );
  return { handle, call, tokens, requests };
}
async function envelope(response: Response) {
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  const body = await response.json();
  assert.equal(body.service, "tracked-workout");
  return body as Record<string, unknown>;
}

test("relay answers CORS preflight and only accepts POST", async () => {
  const h = harness();
  const preflight = await h.call(undefined, { method: "OPTIONS", authorization: "" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
  assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /authorization/);
  assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /apikey/);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  const get = await h.call(undefined, { method: "GET" });
  assert.equal(get.status, 405);
  assert.equal((await envelope(get)).error, "method-not-allowed");
  assert.deepEqual([h.tokens, h.requests], [[], []]);
});

test("relay requires a signed-in user before contacting Tracked", async () => {
  const missing = harness();
  for (const authorization of ["", "Basic abc", "Bearer "]) {
    const response = await missing.call(undefined, { authorization });
    assert.equal(response.status, 401);
    assert.equal((await envelope(response)).error, "unauthenticated");
  }
  assert.deepEqual(missing.tokens, []);
  const rejected = harness(undefined, { user: false });
  const response = await rejected.call(undefined, { authorization: "Bearer public-anon-key" });
  assert.equal(response.status, 401);
  assert.deepEqual(rejected.tokens, ["public-anon-key"]);
  // An anonymous sign-in is a token anyone can mint, so it isn't a real user either.
  const anonymous = harness(undefined, { user: "anonymous" });
  const refused = await anonymous.call();
  assert.equal(refused.status, 401);
  assert.equal((await envelope(refused)).error, "unauthenticated");
  assert.deepEqual(anonymous.requests, []);
  const down = harness(undefined, { user: "error" });
  const failed = await down.call();
  assert.equal(failed.status, 503);
  assert.equal((await envelope(failed)).error, "auth-unavailable");
  assert.deepEqual([rejected.requests, down.requests], [[], []]);
});

test("relay accepts only a workout ID and a page format", async () => {
  const h = harness();
  const invalid: unknown[] = [
    "{",
    "",
    "[]",
    "null",
    { workoutId },
    { workoutId, format: "json" },
    { workoutId, format: "flight", url: "https://example.com/" },
    { workoutId, format: "flight", host: "example.com" },
    { workoutId: pageUrl, format: "flight" },
    { workoutId: `${workoutId}/../../admin`, format: "flight" },
    { workoutId: "01a11c30-850b-765b-841b-cae70206568", format: "flight" },
    { workoutId: 42, format: "flight" },
    `{"workoutId":"${workoutId}","format":"flight","__proto__":{}}`,
  ];
  for (const body of invalid) {
    const response = await h.call(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await envelope(response)).error, "invalid-request");
  }
  const oversized = await h.call({ workoutId, format: "flight", pad: "x".repeat(600) });
  assert.equal(oversized.status, 413);
  assert.equal((await envelope(oversized)).error, "request-too-large");
  assert.deepEqual([h.tokens, h.requests], [[], []]);
});

test("relay builds Tracked's URL itself and sends no credentials", async () => {
  const h = harness();
  // Uppercase IDs are accepted, as they are in pasted links.
  const upper = workoutId.toUpperCase();
  assert.equal(readTrackedLink(`https://app.tracked.gg/v/workout/${upper}`)?.workoutId, workoutId);
  const response = await h.call({ format: "flight", workoutId: upper });
  assert.equal(response.status, 200);
  assert.deepEqual(await envelope(response), {
    service: "tracked-workout",
    format: "flight",
    text: "0:[]\n",
  });
  assert.equal(h.requests.length, 1);
  const [{ url, init }] = h.requests as [{ url: string; init: RequestInit }];
  assert.equal(url, pageUrl);
  assert.equal(init.method, "GET");
  assert.equal(init.credentials, "omit");
  assert.equal(init.redirect, "manual");
  assert.deepEqual(init.headers, { RSC: "1", Accept: "text/x-component" });
  assert.ok(init.signal instanceof AbortSignal);
  await h.call({ workoutId, format: "html" });
  assert.deepEqual(h.requests[1]!.init.headers, { Accept: "text/html,application/xhtml+xml" });
  assert.deepEqual(h.tokens, ["user-token", "user-token"]);
});

test("relay follows up to three redirects on Tracked's own origin", async () => {
  const hops = [
    redirect("/v/workout/moved"),
    redirect("https://app.tracked.gg/v/workout/final", 301),
    page("<html></html>", { type: "text/html; charset=utf-8" }),
  ];
  const h = harness(async () => hops.shift()!);
  const response = await h.call();
  assert.equal(response.status, 200);
  assert.deepEqual(await envelope(response), {
    service: "tracked-workout",
    format: "html",
    text: "<html></html>",
  });
  assert.deepEqual(
    h.requests.map((request) => request.url),
    [pageUrl, "https://app.tracked.gg/v/workout/moved", "https://app.tracked.gg/v/workout/final"],
  );
  for (const request of h.requests) assert.equal(request.init.redirect, "manual");

  const loop = harness(async (url) => redirect(`${url}x`));
  const looped = await loop.call();
  assert.equal(looped.status, 502);
  assert.equal((await envelope(looped)).error, "unrecognized");
  assert.equal(loop.requests.length, 4);
});

test("relay refuses redirects that leave Tracked's app origin", async () => {
  for (const location of [
    "https://example.com/v/workout/x",
    "http://app.tracked.gg/v/workout/x",
    "https://app.tracked.gg.example.com/",
    "https://tracked.gg/",
    "//example.com/",
    "https://user:secret@app.tracked.gg/v/workout/x",
    "",
  ]) {
    const h = harness(async () =>
      location ? redirect(location, 302) : new Response(null, { status: 302 }),
    );
    const response = await h.call();
    assert.equal(response.status, 502, location);
    assert.equal((await envelope(response)).error, "unrecognized");
    assert.equal(h.requests.length, 1, location);
  }
});

test("relay reports missing workouts and Tracked failures in its own envelope", async () => {
  for (const status of [404, 410]) {
    const response = await harness(async () => page("gone", { status })).call();
    assert.equal(response.status, 404);
    assert.equal((await envelope(response)).error, "workout-unavailable");
  }
  for (const upstream of [
    async () => page("", { status: 503 }),
    async () => page("", { status: 403 }),
    async () => {
      throw new TypeError("fetch failed");
    },
    async () =>
      page(
        new ReadableStream({
          start(controller) {
            controller.error(new Error("reset"));
          },
        }),
      ),
  ]) {
    const response = await harness(upstream).call();
    assert.equal(response.status, 502);
    assert.equal((await envelope(response)).error, "tracked-error");
  }
});

test("relay passes through only server-component and HTML pages", async () => {
  for (const type of ["application/json", "text/plain", "image/svg+xml", "", "text/htmlx"]) {
    const response = await harness(async () => page("{}", { type })).call();
    assert.equal(response.status, 502, type);
    assert.equal((await envelope(response)).error, "unrecognized");
  }
  const flight = await harness(async () =>
    page("0:[]\n", { type: "Text/X-Component; charset=utf-8" }),
  ).call();
  assert.equal((await envelope(flight)).format, "flight");
});

test("relay bounds Tracked's page at 2 MiB while streaming", async () => {
  const declared = await harness(async () =>
    page("small", { headers: { "content-length": String(3 * 1024 * 1024) } }),
  ).call();
  assert.equal(declared.status, 502);
  assert.equal((await envelope(declared)).error, "too-large");

  let reads = 0,
    cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        reads++;
        controller.enqueue(new Uint8Array(512 * 1024));
        if (reads === 20) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const streamed = await harness(async () => page(stream)).call();
  assert.equal(streamed.status, 502);
  assert.equal((await envelope(streamed)).error, "too-large");
  assert.equal(reads, 5);
  assert.equal(cancelled, true);

  const exact = await harness(async () => page("a".repeat(2 * 1024 * 1024))).call();
  assert.equal(exact.status, 200);
});

test("relay stops waiting for Tracked after its time limit", async () => {
  let signal: AbortSignal | undefined;
  const h = harness(
    (_url, init) => {
      signal = init.signal ?? undefined;
      return new Promise<Response>(() => {});
    },
    { timeoutMs: 20 },
  );
  const response = await h.call();
  assert.equal(response.status, 504);
  assert.equal((await envelope(response)).error, "timeout");
  assert.equal(signal?.aborted, true);
});

test("relay never logs requests, tokens or pages", async () => {
  const logged: unknown[] = [];
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const original = methods.map((method) => console[method]);
  for (const method of methods) console[method] = (...values: unknown[]) => logged.push(values);
  try {
    await harness(async () => page("private page")).call();
    await harness(async () => page("", { status: 500 })).call();
    await harness(undefined, { user: "error" }).call();
    await harness().call("{");
  } finally {
    methods.forEach((method, index) => (console[method] = original[index]!));
  }
  assert.deepEqual(logged, []);
});

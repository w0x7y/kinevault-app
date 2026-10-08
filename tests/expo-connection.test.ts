import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { checkExpoConnection, waitForExpoConnection } from "../scripts/expo-connection.ts";

async function fixture(
  t: { after: (cleanup: () => Promise<void>) => void },
  respond: (response: ServerResponse, origin: string) => void,
) {
  let origin = "";
  const server = createServer((request, response) => {
    if (
      request.headers.accept !== "application/expo+json" ||
      request.headers["expo-platform"] !== "ios"
    ) {
      response.writeHead(400).end();
      return;
    }
    respond(response, origin);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  origin = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  return origin;
}
const manifest = (url: string) => ({
  runtimeVersion: "exposdk:57.0.0",
  launchAsset: { url },
});

test("the iOS manifest produces an HTTP Expo Go link and identifies localhost", async (t) => {
  const origin = await fixture(t, (response, origin) =>
    response.end(JSON.stringify(manifest(`${origin}/bundle?platform=ios`))),
  );
  const connection = await checkExpoConnection({ origin });
  assert.equal(connection.runtimeVersion, "exposdk:57.0.0");
  assert.equal(connection.expoGoUrl, origin.replace("http://", "exp://"));
  assert.equal(connection.deviceReachable, false);
});

test("HTTPS uses exps and preserves the bundle host and port", async (t) => {
  const origin = await fixture(t, (response) =>
    response.end(JSON.stringify(manifest("https://kine.trycloudflare.com:8443/bundle"))),
  );
  const connection = await checkExpoConnection({
    origin,
    expectedOrigin: "https://kine.trycloudflare.com:8443",
  });
  assert.equal(connection.expoGoUrl, "exps://kine.trycloudflare.com:8443");
  assert.equal(connection.deviceReachable, true);
});

test("IPv6 and other loopback addresses are never reported as phone reachable", async (t) => {
  for (const host of ["[::1]", "127.0.0.2", "localhost"]) {
    const origin = await fixture(t, (response) =>
      response.end(JSON.stringify(manifest(`http://${host}:8081/bundle`))),
    );
    assert.equal((await checkExpoConnection({ origin })).deviceReachable, false);
  }
});

test("malformed manifests, unsupported URLs, HTTP errors, and wrong origins fail", async (t) => {
  for (const [body, status, expectedOrigin] of [
    ["not json", 200, undefined],
    ["null", 200, undefined],
    ["{}", 200, undefined],
    [JSON.stringify(manifest("invalid")), 200, undefined],
    [JSON.stringify(manifest("file:///bundle")), 200, undefined],
    [
      JSON.stringify(manifest("http://localhost:8081/bundle")),
      200,
      "https://kine.trycloudflare.com",
    ],
    [JSON.stringify(manifest("http://localhost:8081/bundle")), 503, undefined],
  ] as const) {
    const origin = await fixture(t, (response) => response.writeHead(status).end(body));
    await assert.rejects(checkExpoConnection({ origin, expectedOrigin }));
  }
});

test("readiness retries startup errors until a matching public manifest arrives", async (t) => {
  let attempts = 0;
  const origin = await fixture(t, (response) => {
    attempts++;
    if (attempts < 3) response.writeHead(503).end("starting");
    else response.end(JSON.stringify(manifest("https://kine.trycloudflare.com/bundle")));
  });
  const ready = await waitForExpoConnection({
    origin,
    expectedOrigin: "https://kine.trycloudflare.com",
    timeoutMs: 1000,
    retryMs: 10,
  });
  assert.equal(ready.expoGoUrl, "exps://kine.trycloudflare.com");
  assert.equal(attempts, 3);
});

test("readiness timeout includes the last connection problem", async (t) => {
  const origin = await fixture(t, (response) => response.writeHead(503).end());
  await assert.rejects(
    waitForExpoConnection({ origin, timeoutMs: 120, retryMs: 10 }),
    /not ready.*503/,
  );
});

test("readiness timeout preserves the HTTP error when a later retry stalls", async (t) => {
  let attempts = 0;
  const origin = await fixture(t, (response) => {
    attempts++;
    if (attempts === 1) response.writeHead(503).end();
  });
  await assert.rejects(
    waitForExpoConnection({ origin, timeoutMs: 1000, retryMs: 10 }),
    /not ready.*503/,
  );
  assert.ok(attempts >= 2);
});

test("shutdown cancels an in-flight readiness request", async (t) => {
  const controller = new AbortController();
  const origin = await fixture(t, () => controller.abort(new Error("Tunnel stopped")));
  await assert.rejects(
    waitForExpoConnection({ origin, signal: controller.signal }),
    /Tunnel stopped/,
  );
});

test("a stalled manifest body cannot exceed the readiness deadline", async (t) => {
  const origin = await fixture(t, (response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write('{"launchAsset":');
  });
  await assert.rejects(waitForExpoConnection({ origin, timeoutMs: 120, retryMs: 10 }), /not ready/);
});

test("shutdown cancels the retry delay without another manifest request", async (t) => {
  const controller = new AbortController();
  let attempts = 0;
  const origin = await fixture(t, (response) => {
    attempts++;
    response.writeHead(503).end();
    setTimeout(() => controller.abort(), 20);
  });
  await assert.rejects(
    waitForExpoConnection({ origin, signal: controller.signal, retryMs: 1000 }),
    /aborted/i,
  );
  assert.equal(attempts, 1);
});

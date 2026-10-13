import assert from "node:assert/strict";
import test from "node:test";
import {
  cors,
  jsonReply,
  preflightReply,
  readJsonRequest,
  readLimited,
} from "../supabase/functions/_shared/request.ts";

function request(
  body: BodyInit | null,
  {
    method = "POST",
    authorization = "Bearer synthetic",
  }: { method?: string; authorization?: string } = {},
) {
  return new Request("https://fixture.invalid", {
    method,
    headers: authorization ? { Authorization: authorization } : {},
    body,
    duplex: "half",
  } as RequestInit);
}
function chunked(chunks: Uint8Array[]) {
  let reads = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks[reads++];
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, reads: () => reads, cancelled: () => cancelled };
}
const read = (body: BodyInit | null, byteLimit = 16, init?: Parameters<typeof request>[1]) =>
  readJsonRequest(request(body, init), { byteLimit });

test("preflight and other methods are answered before the token or body is read", async () => {
  const options = new Request("https://fixture.invalid", { method: "OPTIONS" });
  assert.deepEqual(await readJsonRequest(options, { byteLimit: 16 }), { kind: "preflight" });
  assert.deepEqual(await read(null, 16, { method: "GET", authorization: "" }), {
    kind: "rejected",
    reason: "method",
  });
  for (const method of ["PUT", "DELETE", "PATCH"]) {
    const body = chunked([new TextEncoder().encode("{}")]);
    assert.deepEqual(
      await read(body.stream, 16, { method }),
      { kind: "rejected", reason: "method" },
      method,
    );
    assert.equal(body.reads(), 0);
  }
  const preflight = preflightReply();
  assert.equal(preflight.status, 204);
  assert.equal(preflight.body, null);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
});

test("only a single Bearer token is accepted, case-insensitively", async () => {
  for (const authorization of ["", "Basic abc", "Bearer ", "Bearer a b", "Bearer  a", "Token a"]) {
    assert.deepEqual(
      await read("{}", 16, { authorization }),
      { kind: "rejected", reason: "unauthenticated" },
      authorization,
    );
  }
  assert.deepEqual(await read("{}", 16, { authorization: "bearer abc.def" }), {
    kind: "ok",
    token: "abc.def",
    body: {},
  });
});

test("the token is checked before the body is read", async () => {
  const body = chunked([new Uint8Array(64)]);
  const result = await read(body.stream, 16, { authorization: "" });
  assert.deepEqual(result, { kind: "rejected", reason: "unauthenticated" });
  assert.equal(body.reads(), 0);
});

test("the byte limit counts UTF-8 bytes and allows exactly the limit", async () => {
  const exact = JSON.stringify({ a: "é".repeat(4) }); // 16 bytes, 12 characters
  assert.equal(new TextEncoder().encode(exact).byteLength, 16);
  assert.deepEqual(await read(exact), { kind: "ok", token: "synthetic", body: { a: "éééé" } });
  const over = JSON.stringify({ a: "é".repeat(4) + "x" });
  assert.deepEqual(await read(over), { kind: "rejected", reason: "too-large" });
});

test("chunked bodies are joined and an oversized stream is cancelled early", async () => {
  const encoded = new TextEncoder().encode('{"a":"bc"}');
  const split = chunked([encoded.slice(0, 3), encoded.slice(3, 4), encoded.slice(4)]);
  assert.deepEqual(await read(split.stream), { kind: "ok", token: "synthetic", body: { a: "bc" } });
  const large = chunked([
    new Uint8Array(8),
    new Uint8Array(8),
    new Uint8Array(1),
    new Uint8Array(8),
  ]);
  assert.deepEqual(await read(large.stream), { kind: "rejected", reason: "too-large" });
  assert.equal(large.reads(), 3);
  assert.equal(large.cancelled(), true);
});

test("a multi-byte character split across chunks still decodes", async () => {
  const encoded = new TextEncoder().encode('{"a":"é"}');
  const at = encoded.indexOf(0xc3) + 1;
  const split = chunked([encoded.slice(0, at), encoded.slice(at)]);
  assert.deepEqual(await read(split.stream), { kind: "ok", token: "synthetic", body: { a: "é" } });
});

test("invalid UTF-8, malformed JSON and non-object JSON are invalid", async () => {
  const invalidUtf8 = new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]);
  const bodies: (BodyInit | null)[] = [
    invalidUtf8,
    null,
    "",
    "{",
    "[]",
    "[{}]",
    "null",
    "42",
    '"text"',
    "true",
  ];
  for (const body of bodies)
    assert.deepEqual(await read(body), { kind: "rejected", reason: "invalid" }, String(body));
});

test("a failing body stream is invalid and its error stays private", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.error(new Error("private credential"));
    },
  });
  assert.deepEqual(await read(stream), { kind: "rejected", reason: "invalid" });
});

test("a JSON object passes through with its own keys intact", async () => {
  const result = await read('{"__proto__":{"x":1}}', 64);
  assert.equal(result.kind, "ok");
  if (result.kind !== "ok") return;
  assert.deepEqual(Object.keys(result.body), ["__proto__"]);
  assert.equal(Object.getPrototypeOf(result.body), Object.prototype);
});

test("readLimited returns empty bytes for no stream and null past the limit", async () => {
  assert.deepEqual(await readLimited(null, 4), new Uint8Array(0));
  assert.deepEqual(
    await readLimited(new Response(new Uint8Array([1, 2, 3, 4])).body, 4),
    new Uint8Array([1, 2, 3, 4]),
  );
  assert.equal(await readLimited(new Response(new Uint8Array(5)).body, 4), null);
});

test("JSON replies carry CORS headers and are never cached", async () => {
  const response = jsonReply(418, { error: "teapot" });
  assert.equal(response.status, 418);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(response.headers.get("cache-control"), "no-store");
  for (const [name, value] of Object.entries(cors)) assert.equal(response.headers.get(name), value);
  assert.deepEqual(await response.json(), { error: "teapot" });
});

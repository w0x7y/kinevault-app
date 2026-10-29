import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const CachePolicy = createRequire(require.resolve("cacheable-request"))("http-cache-semantics");
const request = { url: "https://cache.example/account", method: "GET", headers: {} };
const staleRequest = { ...request, headers: { "cache-control": "max-stale=99999999" } };

for (const headers of [
  { "cache-control": "private, max-age=60" },
  { "cache-control": "no-store" },
  { "cache-control": "no-cache, max-age=60" },
  { "cache-control": "max-age=60", "set-cookie": "session=synthetic" },
]) {
  test(`max-stale cannot reuse a protected response: ${JSON.stringify(headers)}`, () => {
    const policy = new CachePolicy(request, { status: 200, headers });
    for (const candidate of [policy, CachePolicy.fromObject(policy.toObject())]) {
      assert.equal(candidate.satisfiesWithoutRevalidation(staleRequest), false);
      const result = candidate.evaluateRequest(staleRequest);
      assert.equal(result.response, undefined);
      assert.equal(result.revalidation.synchronous, true);
    }
  });
}

test("max-stale cannot reuse a shared authenticated response", () => {
  const authenticated = { ...request, headers: { authorization: "Bearer synthetic" } };
  const policy = new CachePolicy(authenticated, {
    status: 200,
    headers: { "cache-control": "max-age=60" },
  });
  assert.equal(policy.satisfiesWithoutRevalidation(staleRequest), false);
});

for (const directive of ["proxy-revalidate", "s-maxage=1"]) {
  test(`shared stale responses require validation with ${directive}`, () => {
    const policy = new CachePolicy(request, {
      status: 200,
      headers: { "cache-control": `public, max-age=1, ${directive}`, age: "120" },
    });
    assert.equal(policy.satisfiesWithoutRevalidation(staleRequest), false);
    assert.equal(policy.evaluateRequest(staleRequest).response, undefined);
  });
}

test("ordinary public and browser-private caches retain permitted reuse", () => {
  const fresh = new CachePolicy(request, {
    status: 200,
    headers: { "cache-control": "public, max-age=60" },
  });
  assert.equal(fresh.satisfiesWithoutRevalidation(request), true);
  const stale = new CachePolicy(request, {
    status: 200,
    headers: { "cache-control": "public, max-age=1", age: "120" },
  });
  assert.equal(stale.satisfiesWithoutRevalidation(staleRequest), true);
  const privateCache = new CachePolicy(
    request,
    { status: 200, headers: { "cache-control": "private, max-age=60", "set-cookie": "synthetic" } },
    { shared: false },
  );
  assert.equal(privateCache.satisfiesWithoutRevalidation(request), true);
});

// Expo Router 58 parses links with WHATWG URLSearchParams instead of query-string.
const routerQuery = "expo-router/build/fork/getStateFromPath-forks.js";
const route = { name: "auth/callback" };

test("Expo Router no longer resolves the patched query-string", () => {
  const routerRequire = createRequire(require.resolve("expo-router"));
  assert.throws(() => routerRequire("query-string"), { code: "MODULE_NOT_FOUND" });
});

test("Expo Router query parsing handles long malformed escapes without blocking", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { createRequire } from 'node:module';
    import assert from 'node:assert/strict';
    const require = createRequire(import.meta.url);
    const { parseQueryParams } = require(${JSON.stringify(routerQuery)});
    const params = parseQueryParams('/auth/callback?value=' + '%FF'.repeat(800), ${JSON.stringify(route)});
    assert.equal(params.value, '\\uFFFD'.repeat(800));
  `,
    ],
    { cwd: new URL("../", import.meta.url), timeout: 1500, encoding: "utf8" },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test("Expo Router keeps UTF-8, plus, array and URL handling in links", () => {
  const { parseQueryParams } = require(routerQuery);
  const { stringifySearchParams } = require("expo-router/build/utils/queryParams.js");
  assert.deepEqual(
    { ...parseQueryParams("/auth/callback?name=Kine+Vault&unicode=%E2%9C%93&tag=a&tag=b", route) },
    {
      name: "Kine Vault",
      unicode: "✓",
      tag: ["a", "b"],
    },
  );
  assert.equal(
    stringifySearchParams({ name: "Kine Vault", tag: ["a", "b"] }),
    "name=Kine+Vault&tag=a&tag=b",
  );
  assert.equal(parseQueryParams("/auth/callback?code=a%2Bb", route).code, "a+b");
  assert.equal(parseQueryParams("/auth/callback?value=%FF%41%E2%9C%93", route).value, "\uFFFDA✓");
});

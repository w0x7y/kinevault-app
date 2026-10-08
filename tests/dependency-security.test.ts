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
    const query = createRequire(require.resolve('expo-router'))('query-string');
    assert.equal(query.parse('value=' + '%FF'.repeat(800)).value, '%FF'.repeat(800));
  `,
    ],
    { cwd: new URL("../", import.meta.url), timeout: 1500, encoding: "utf8" },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test("Expo Router keeps its query-string API and UTF-8, plus, array and URL handling", () => {
  const query = createRequire(require.resolve("expo-router"))("query-string");
  assert.deepEqual(
    { ...query.parse("name=Kine+Vault&unicode=%E2%9C%93&tag=a&tag=b") },
    {
      name: "Kine Vault",
      unicode: "✓",
      tag: ["a", "b"],
    },
  );
  assert.equal(
    query.stringify({ name: "Kine Vault", tag: ["a", "b"] }),
    "name=Kine%20Vault&tag=a&tag=b",
  );
  assert.equal(query.parseUrl("https://track.example/auth/callback?code=a%2Bb").query.code, "a+b");
  assert.equal(query.parse("value=%FF%41%E2%9C%93").value, "%FFA✓");
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/account/client.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function runtime(platform, browser = false) {
  const calls = [];
  const required = [];
  const client = { auth: {} };
  const storage = {};
  const lock = () => {};
  const context = {
    exports: {},
    URL,
    ...(browser ? { window: {} } : {}),
    process: {
      env: {
        EXPO_PUBLIC_SUPABASE_URL: "https://account.test",
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only",
      },
    },
    require(specifier) {
      required.push(specifier);
      switch (specifier) {
        case "react-native-url-polyfill/auto":
        case "./crypto-polyfill":
          return {};
        case "react-native":
          return { Platform: { OS: platform } };
        case "@supabase/supabase-js":
          return {
            createClient(...args) {
              calls.push(args);
              return client;
            },
            processLock: lock,
          };
        case "./session-storage":
          return { sessionStorage: storage };
        case "./auth-adapter":
          return { createAccountAuthAdapter: (auth) => auth };
        default:
          throw new Error(`Unexpected dependency: ${specifier}`);
      }
    },
  };
  runInNewContext(compiled, context, { filename: "account-client.js" });
  return { api: context.exports, calls, client, storage, lock, required };
}

test("WebCrypto is installed before the Supabase SDK loads", () => {
  const { required } = runtime("ios");
  assert.ok(required.includes("./crypto-polyfill"));
  assert.ok(required.indexOf("./crypto-polyfill") < required.indexOf("@supabase/supabase-js"));
});

test("server-rendered web requests never construct an account client or start its refresh lifecycle", () => {
  const { api, calls } = runtime("web");
  assert.equal(api.getSupabaseClient(), null);
  assert.equal(api.getAccountAuthPort(), null);
  assert.equal(api.getSupabaseClient(), null);
  assert.equal(calls.length, 0);
});

for (const platform of ["web", "ios"]) {
  test(`${platform} app runtime retains one account client with session refresh and no legacy auth lock`, () => {
    const { api, calls, client, storage } = runtime(platform, platform === "web");
    assert.equal(api.getSupabaseClient(), client);
    assert.equal(api.getSupabaseClient(), client);
    assert.equal(api.getAccountAuthPort(), client.auth);
    assert.equal(calls.length, 1);
    const [url, key, { auth }] = calls[0];
    assert.equal(url, "https://account.test");
    assert.equal(key, "sb_publishable_fixture_only");
    assert.equal(auth.storage, storage);
    assert.equal(auth.storageKey, "kinevault-track.auth.v1");
    assert.equal(auth.persistSession, true);
    assert.equal(auth.autoRefreshToken, true);
    assert.equal(auth.detectSessionInUrl, false);
    assert.equal(auth.flowType, "pkce");
    // The SDK coordinates refreshes itself; its legacy `lock` option is deprecated.
    assert.equal("lock" in auth, false);
  });
}

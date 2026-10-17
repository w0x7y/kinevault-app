import assert from "node:assert/strict";
import { createHash, randomFillSync } from "node:crypto";
import test, { type TestContext } from "node:test";
import { getCodeChallengeAndMethod } from "@supabase/auth-js/dist/main/lib/helpers.js";
import { installWebCrypto, type CryptoSource } from "../src/account/web-crypto.ts";

type InstalledCrypto = {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  subtle: { digest(algorithm: unknown, data: unknown): Promise<ArrayBuffer> };
};

function fakeSource() {
  const random: ArrayBufferView[] = [];
  const digests: { algorithm: string; bytes: number[] }[] = [];
  const result = new Uint8Array([1, 2, 3]).buffer;
  const source: CryptoSource = {
    getRandomValues(array) {
      random.push(array);
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(7);
    },
    async digest(algorithm, data) {
      digests.push({ algorithm, bytes: [...data] });
      return result;
    },
  };
  return { source, random, digests, result };
}

// Node's own WebCrypto, used as a stand-in for expo-crypto's native calls.
const nodeSource: CryptoSource = {
  getRandomValues: (array) => randomFillSync(array),
  async digest(algorithm, data) {
    const hash = createHash(algorithm.replace("-", "").toLowerCase()).update(data).digest();
    return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength) as ArrayBuffer;
  },
};

/** Removes Node's WebCrypto for one test, like Hermes, which has no `crypto` global. */
function withoutGlobalCrypto(t: TestContext) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "crypto", original);
    else delete (globalThis as { crypto?: unknown }).crypto;
  });
}

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => void items.set(key, value),
    removeItem: async (key: string) => void items.delete(key),
  };
}

test("fills in random values and SHA digests from the native source", async () => {
  const { source, random, digests, result } = fakeSource();
  const scope: { crypto?: InstalledCrypto } = {};
  installWebCrypto(scope, source);
  const crypto = scope.crypto!;

  const array = new Uint32Array(4);
  assert.equal(crypto.getRandomValues(array), array);
  assert.deepEqual(random, [array]);
  assert.deepEqual([...array], Array(4).fill(0x07070707));

  assert.equal(await crypto.subtle.digest("SHA-256", new Uint8Array([1, 2])), result);
  assert.equal(await crypto.subtle.digest("sha-1", new Uint8Array([3]).buffer), result);
  assert.equal(await crypto.subtle.digest({ name: "Sha-512" }, new Uint8Array([4])), result);
  // A view hashes only its own bytes, and later writes to the caller's buffer don't leak in.
  const bytes = new Uint8Array([9, 8, 7, 6]);
  const pending = crypto.subtle.digest("SHA-384", new DataView(bytes.buffer, 1, 2));
  bytes.fill(0);
  await pending;
  assert.deepEqual(digests, [
    { algorithm: "SHA-256", bytes: [1, 2] },
    { algorithm: "SHA-1", bytes: [3] },
    { algorithm: "SHA-512", bytes: [4] },
    { algorithm: "SHA-384", bytes: [8, 7] },
  ]);
});

test("unsupported digests and data reject without reaching the native source", async () => {
  const { source, digests } = fakeSource();
  const scope: { crypto?: InstalledCrypto } = {};
  installWebCrypto(scope, source);
  const { subtle } = scope.crypto!;

  for (const algorithm of ["MD5", "SHA256", { name: 256 }, null, undefined])
    await assert.rejects(subtle.digest(algorithm, new Uint8Array(1)), {
      name: "NotSupportedError",
    });
  for (const data of ["text", [1, 2], null])
    await assert.rejects(subtle.digest("SHA-256", data), TypeError);
  assert.deepEqual(digests, []);
});

test("random values follow WebCrypto's integer-array and 65,536-byte limits", () => {
  const { source, random } = fakeSource();
  const scope: { crypto?: InstalledCrypto } = {};
  installWebCrypto(scope, source);
  const crypto = scope.crypto!;

  const largest = new Uint8Array(65536);
  assert.equal(crypto.getRandomValues(largest), largest);
  const wide = new BigUint64Array(2);
  assert.equal(crypto.getRandomValues(wide), wide);
  assert.deepEqual(random, [largest, wide]);

  assert.throws(() => crypto.getRandomValues(new Uint8Array(65537)), {
    name: "QuotaExceededError",
  });
  assert.throws(() => crypto.getRandomValues(new Uint32Array(16385)), {
    name: "QuotaExceededError",
  });
  for (const array of [new Float32Array(1), new Float64Array(1), new DataView(new ArrayBuffer(1))])
    assert.throws(() => crypto.getRandomValues(array), { name: "TypeMismatchError" });
  for (const array of [[1, 2], new ArrayBuffer(1), null])
    assert.throws(() => crypto.getRandomValues(array as unknown as Uint8Array), TypeError);
  assert.equal(random.length, 2);
});

test("existing WebCrypto calls are never replaced", () => {
  const { source } = fakeSource();
  const getRandomValues = () => {};
  const digest = async () => new ArrayBuffer(0);
  const complete = { crypto: { getRandomValues, subtle: { digest } } };
  installWebCrypto(complete, source);
  assert.equal(complete.crypto.getRandomValues, getRandomValues);
  assert.equal(complete.crypto.subtle.digest, digest);

  // Only the missing call is added, on the existing objects.
  const importKey = async () => ({});
  const partial: { crypto: { getRandomValues: unknown; subtle: Record<string, unknown> } } = {
    crypto: { getRandomValues, subtle: { importKey } },
  };
  const { crypto } = partial;
  const { subtle } = crypto;
  installWebCrypto(partial, source);
  assert.equal(partial.crypto, crypto);
  assert.equal(partial.crypto.subtle, subtle);
  assert.equal(subtle.importKey, importKey);
  assert.equal(typeof subtle.digest, "function");
  assert.equal(crypto.getRandomValues, getRandomValues);

  const randomOnly: { crypto: { getRandomValues?: unknown; subtle?: unknown } } = {
    crypto: { subtle: { digest } },
  };
  installWebCrypto(randomOnly, source);
  assert.equal(typeof randomOnly.crypto.getRandomValues, "function");
  assert.deepEqual(randomOnly.crypto.subtle, { digest });
});

test("Supabase Auth sends an S256 PKCE challenge once WebCrypto is installed", async (t) => {
  withoutGlobalCrypto(t);
  const warn = t.mock.method(console, "warn", () => {});
  let randomCalls = 0;
  installWebCrypto(globalThis, {
    ...nodeSource,
    getRandomValues(array) {
      randomCalls++;
      nodeSource.getRandomValues(array);
    },
  });
  const storage = memoryStorage();
  const [challenge, method] = await getCodeChallengeAndMethod(storage, "auth");
  const verifier: string = JSON.parse((await storage.getItem("auth-code-verifier"))!);
  assert.equal(method, "s256");
  assert.match(verifier, /^[0-9a-f]{112}$/);
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
  assert.ok(randomCalls > 0);
  assert.equal(warn.mock.callCount(), 0);
});

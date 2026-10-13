// Supabase Auth reads WebCrypto when it starts a PKCE flow, such as the email
// links for sign-up and password reset. Hermes has no `crypto` global, so Auth
// falls back to a Math.random verifier and sends it unhashed as a `plain`
// challenge. Hermes does provide the TextEncoder and btoa that Auth also needs.
//
// Only the two calls Auth uses are filled in. `crypto.subtle` then exists, so
// `auth.getClaims()` would try `subtle.importKey`; use getUser or getSession.

const digestAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
export type DigestAlgorithm = (typeof digestAlgorithms)[number];
type IntegerArray =
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | BigInt64Array
  | BigUint64Array;
const integerArrays = [
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint8ClampedArray,
  Uint16Array,
  Uint32Array,
  // Guarded for engines without 64-bit integer arrays.
  globalThis.BigInt64Array,
  globalThis.BigUint64Array,
].filter((type) => typeof type === "function");
const maxRandomBytes = 65536;

/** A native source of secure random bytes and digests, such as expo-crypto. */
export type CryptoSource = {
  getRandomValues(array: IntegerArray): unknown;
  digest(algorithm: DigestAlgorithm, data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer>;
};

type CryptoScope = {
  crypto?: { getRandomValues?: unknown; subtle?: { digest?: unknown } };
};

function digestAlgorithm(identifier: unknown): DigestAlgorithm | undefined {
  const name =
    typeof identifier === "object" && identifier !== null
      ? (identifier as { name?: unknown }).name
      : identifier;
  if (typeof name !== "string") return undefined;
  const normalized = name.toUpperCase();
  return digestAlgorithms.find((algorithm) => algorithm === normalized);
}

/** WebCrypto hashes a copy, so later changes to the caller's buffer can't leak in. */
function copyBytes(data: unknown): Uint8Array<ArrayBuffer> {
  if (ArrayBuffer.isView(data))
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  if (data instanceof ArrayBuffer) return new Uint8Array(data).slice();
  throw new TypeError("Data must be an ArrayBuffer or an ArrayBufferView.");
}

/**
 * Adds `crypto.getRandomValues` and `crypto.subtle.digest` to `scope` where
 * they're missing. Existing implementations are never replaced.
 */
export function installWebCrypto(scope: object, source: CryptoSource): void {
  const target = scope as CryptoScope;
  const crypto = (target.crypto ??= {});
  if (typeof crypto.getRandomValues !== "function")
    crypto.getRandomValues = <T extends IntegerArray>(array: T): T => {
      // The native source fills any buffer, so enforce WebCrypto's limits here.
      if (!ArrayBuffer.isView(array)) throw new TypeError("Expected an integer TypedArray.");
      if (!integerArrays.some((type) => array instanceof type))
        throw new DOMException("Expected an integer TypedArray.", "TypeMismatchError");
      if (array.byteLength > maxRandomBytes)
        throw new DOMException(
          `The array exceeds ${maxRandomBytes} bytes of entropy.`,
          "QuotaExceededError",
        );
      source.getRandomValues(array);
      return array;
    };
  const subtle = (crypto.subtle ??= {});
  if (typeof subtle.digest !== "function")
    subtle.digest = async (algorithm: unknown, data: unknown): Promise<ArrayBuffer> => {
      const name = digestAlgorithm(algorithm);
      if (!name) throw new DOMException("Unsupported digest algorithm.", "NotSupportedError");
      return source.digest(name, copyBytes(data));
    };
}

import { CryptoDigestAlgorithm, digest, getRandomValues } from "expo-crypto";
import { installWebCrypto, type DigestAlgorithm } from "./web-crypto";

// Native only: import before the Supabase client is created so sign-up and
// password-reset links use a secure verifier and an S256 challenge.
const algorithms: Record<DigestAlgorithm, CryptoDigestAlgorithm> = {
  "SHA-1": CryptoDigestAlgorithm.SHA1,
  "SHA-256": CryptoDigestAlgorithm.SHA256,
  "SHA-384": CryptoDigestAlgorithm.SHA384,
  "SHA-512": CryptoDigestAlgorithm.SHA512,
};

installWebCrypto(globalThis, {
  getRandomValues,
  digest: (algorithm, data) => digest(algorithms[algorithm], data),
});

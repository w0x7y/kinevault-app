import { setTimeout as delay } from "node:timers/promises";

type ConnectionOptions = {
  origin: string;
  expectedOrigin?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

// Both commands interpret the same Expo Go manifest; only their host rules differ.
export async function checkExpoConnection({
  origin,
  expectedOrigin,
  signal,
  timeoutMs = 10000,
}: ConnectionOptions) {
  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(new URL("/", origin), {
    headers: { Accept: "application/expo+json", "Expo-Platform": "ios" },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`);
  const manifest: unknown = await response.json();
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    !("launchAsset" in manifest)
  )
    throw new Error("Server did not return an Expo Go manifest.");
  const asset = manifest.launchAsset;
  if (
    typeof asset !== "object" ||
    asset === null ||
    !("url" in asset) ||
    typeof asset.url !== "string"
  )
    throw new Error("Server did not return an Expo Go bundle URL.");
  const bundle = new URL(asset.url);
  if (!["http:", "https:"].includes(bundle.protocol))
    throw new Error("Expo Go bundle URL must use HTTP or HTTPS.");
  if (expectedOrigin && bundle.origin !== new URL(expectedOrigin).origin)
    throw new Error(
      `Unexpected bundle host: ${bundle.origin}; expected ${new URL(expectedOrigin).origin}.`,
    );
  const hostname = bundle.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const loopback =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "::1" ||
    hostname.startsWith("127.");
  return {
    runtimeVersion:
      "runtimeVersion" in manifest &&
      typeof manifest.runtimeVersion === "string"
        ? manifest.runtimeVersion
        : "unknown",
    expoGoUrl: `${bundle.protocol === "https:" ? "exps" : "exp"}://${bundle.host}`,
    deviceReachable: !loopback,
  };
}

export async function waitForExpoConnection({
  origin,
  expectedOrigin = origin,
  signal,
  timeoutMs = 90000,
  retryMs = 1000,
}: ConnectionOptions & { retryMs?: number }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "Server is starting.";
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    try {
      return await checkExpoConnection({
        origin,
        expectedOrigin,
        signal,
        timeoutMs: Math.max(1, Math.min(10000, deadline - Date.now())),
      });
    } catch (error) {
      signal?.throwIfAborted();
      lastError = error instanceof Error ? error.message : String(error);
    }
    const remaining = deadline - Date.now();
    if (remaining > 0)
      await delay(Math.min(retryMs, remaining), undefined, { signal });
  }
  throw new Error(
    `The iOS manifest is not ready: ${lastError}. Check the Expo output above.`,
  );
}

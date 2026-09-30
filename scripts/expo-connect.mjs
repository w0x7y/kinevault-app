import { networkInterfaces } from "node:os";
import { spawnSync } from "node:child_process";

const port = process.argv[2] || "8081";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("Use a port between 1 and 65535.");

const deviceAddresses = [];
for (const [name, addresses] of Object.entries(networkInterfaces()))
  for (const address of addresses || [])
    if (address.family === "IPv4" && !address.internal) {
      deviceAddresses.push(address.address);
      console.log(`${name}: http://${address.address}:${port}/status`);
    }

try {
  // LAN manifests derive bundle URLs from the request host. Probe a device
  // address so a healthy LAN server is not mistaken for a localhost-only one.
  const serverHost = deviceAddresses[0] || "localhost";
  const response = await fetch(`http://${serverHost}:${port}/`, {
    headers: { Accept: "application/expo+json", "Expo-Platform": "ios" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`);
  const manifest = await response.json();
  const bundle = manifest.launchAsset?.url;
  if (typeof bundle !== "string")
    throw new Error("Server did not return an Expo Go manifest.");
  console.log(`iOS runtime: ${manifest.runtimeVersion}`);
  const scheme = new URL(bundle).protocol === "https:" ? "exps" : "exp";
  console.log(`Expo Go address: ${scheme}://${new URL(bundle).host}`);
  if (["localhost", "127.0.0.1", "::1"].includes(new URL(bundle).hostname)) {
    console.log(
      "Phone cannot use localhost. Restart with npm run start:lan or npm run start:tunnel.",
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    "Start Expo first. For another port: npm run doctor:connection -- 8082",
  );
  process.exitCode = 1;
}

const auth = spawnSync("npx", ["expo", "whoami"], {
  encoding: "utf8",
  timeout: 30000,
});
if (auth.status !== 0) {
  console.log(
    "Expo CLI is not signed in. Run npx expo login and use the same account in Expo Go on iPhone.",
  );
} else {
  console.log(
    "Expo CLI is signed in. Check that Expo Go on iPhone uses the same account.",
  );
}
console.log(
  "For a LAN timeout: allow Expo Go's Local Network permission in iOS Settings, or use npm run start:tunnel.",
);

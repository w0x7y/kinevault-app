import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const html = createRequire(require.resolve("expo-router"))("@expo/router-server/build/utils/html");

test("the web CSP allows Expo Router's inline hydration script by hash and nothing else inline", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const csp: string = config.headers[0].headers.find(
    (header: { key: string }) => header.key === "Content-Security-Policy",
  ).value;
  const hash = createHash("sha256").update(html.getHydrationFlagScriptContents()).digest("base64");
  const scripts = csp.split(";").find((directive) => directive.trim().startsWith("script-src"));
  // An Expo Router upgrade that changes this script must update vercel.json too.
  assert.equal(scripts?.trim(), `script-src 'self' 'sha256-${hash}'`);
});

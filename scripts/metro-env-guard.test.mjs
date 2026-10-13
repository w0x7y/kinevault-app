import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = require(path.join(projectRoot, "metro.config.cjs"));
const blocked = (file) =>
  config.resolver.blockList.some((pattern) => pattern.test(path.join(projectRoot, file)));

test("Metro never sees private env files in the project root", () => {
  for (const file of [".env.auth.local", ".env.secret", ".env.staging.local", ".env.local.bak"]) {
    assert.equal(blocked(file), true, file);
  }
});

test("Metro still loads Expo's standard env files and ordinary sources", () => {
  for (const file of [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.production",
    ".env.production.local",
    "src/app/_layout.tsx",
    "src/.env.auth.local.ts",
  ]) {
    assert.equal(blocked(file), false, file);
  }
});

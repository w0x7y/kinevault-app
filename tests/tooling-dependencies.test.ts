import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const dnsNamespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

test("build-tool UUID generation rejects undersized output buffers", () => {
  const uuid: unknown = createRequire(require.resolve("xcode"))("uuid");
  assert.ok(uuid && typeof uuid === "object" && "v3" in uuid && "v5" in uuid);
  assert.equal(typeof uuid.v3, "function");
  assert.equal(typeof uuid.v5, "function");
  for (const generate of [uuid.v3, uuid.v5]) {
    assert.ok(typeof generate === "function");
    assert.throws(() => generate("Kine", dnsNamespace, new Uint8Array(1)), RangeError);
    const output = new Uint8Array(16);
    assert.equal(generate("Kine", dnsNamespace, output), output);
    assert.ok(output.some((byte) => byte !== 0));
  }
});

test("Expo tunnel and build tools retain CommonJS UUID v4 generation", () => {
  for (const consumer of ["@expo/ngrok", "xcode"]) {
    const uuid: unknown = createRequire(require.resolve(consumer))("uuid");
    assert.ok(
      uuid &&
        (typeof uuid === "object" || typeof uuid === "function") &&
        "v4" in uuid &&
        typeof uuid.v4 === "function",
    );
    const value: unknown = uuid.v4();
    assert.ok(typeof value === "string");
    assert.match(value, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  }
});

test("Xcode still generates unique project identifiers", () => {
  const xcode: unknown = require("xcode");
  assert.ok(
    xcode && typeof xcode === "object" && "project" in xcode && typeof xcode.project === "function",
  );
  const project: unknown = xcode.project("synthetic.pbxproj");
  assert.ok(
    project &&
      typeof project === "object" &&
      "generateUuid" in project &&
      typeof project.generateUuid === "function",
  );
  Object.assign(project, { hash: { project: { objects: {} } } });
  const identifiers = new Set<string>();
  for (let index = 0; index < 100; index++) {
    const identifier: unknown = project.generateUuid();
    assert.ok(typeof identifier === "string");
    assert.match(identifier, /^[\dA-F]{24}$/);
    identifiers.add(identifier);
  }
  assert.equal(identifiers.size, 100);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAppearance,
  resolveAppearance,
} from "../src/theme/preferences.ts";

test("missing and unsupported stored preferences use system appearance", () => {
  for (const value of [null, "", "sepia", "{broken"]) {
    assert.equal(parseAppearance(value), "system");
  }
  for (const value of ["system", "light", "dark"]) {
    assert.equal(parseAppearance(value), value);
  }
});

test("explicit appearance overrides OS changes", () => {
  assert.equal(resolveAppearance("light", "dark"), "light");
  assert.equal(resolveAppearance("dark", "light"), "dark");
});

test("system appearance follows the OS and defaults to light if unavailable", () => {
  assert.equal(resolveAppearance("system", "dark"), "dark");
  assert.equal(resolveAppearance("system", "light"), "light");
  assert.equal(resolveAppearance("system", null), "light");
});

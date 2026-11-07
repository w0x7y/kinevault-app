import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
type Config = { name: string; android?: { package?: string; versionCode?: number } };
const withAndroidVersionCode: ((config: Config) => Config) & {
  versionCodeFrom: (value: string | undefined) => number | undefined;
} = require("../plugins/with-android-version-code.cjs");

test("ANDROID_VERSION_CODE sets the Android versionCode", () => {
  const config: Config = { name: "KineVault Track", android: { package: "com.kinevault.track" } };
  const saved = process.env.ANDROID_VERSION_CODE;
  try {
    process.env.ANDROID_VERSION_CODE = "1042";
    assert.deepEqual(withAndroidVersionCode(config), {
      name: "KineVault Track",
      android: { package: "com.kinevault.track", versionCode: 1042 },
    });
    delete process.env.ANDROID_VERSION_CODE;
    assert.equal(withAndroidVersionCode(config), config);
  } finally {
    if (saved === undefined) delete process.env.ANDROID_VERSION_CODE;
    else process.env.ANDROID_VERSION_CODE = saved;
  }
});

test("ANDROID_VERSION_CODE accepts only codes Google Play allows", () => {
  const { versionCodeFrom } = withAndroidVersionCode;
  assert.equal(versionCodeFrom(undefined), undefined);
  assert.equal(versionCodeFrom(""), undefined);
  assert.equal(versionCodeFrom("1"), 1);
  assert.equal(versionCodeFrom("2100000000"), 2100000000);
  for (const value of ["0", "-1", "1.5", "1e3", "01", " 7", "abc", "2100000001", "99999999999"]) {
    assert.throws(() => versionCodeFrom(value), /ANDROID_VERSION_CODE must be/, value);
  }
});

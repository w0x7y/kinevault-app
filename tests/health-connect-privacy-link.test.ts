import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  addPrivacyLinkRouting,
}: {
  addPrivacyLinkRouting: (contents: string, scheme: unknown) => string;
} = require("../plugins/with-health-connect-privacy-link.cjs");
const appJson: { expo: { scheme: string; plugins: unknown[] } } = JSON.parse(
  readFileSync(new URL("../app.json", import.meta.url), "utf8"),
);

// The Expo SDK 58 template's MainActivity after expo-splash-screen, trimmed.
const mainActivity = `package com.kinevault.track
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"

  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              super.invokeDefaultOnBackPressed()
          }
          return
      }
      super.invokeDefaultOnBackPressed()
  }
}
`;

const count = (text: string, part: string) => text.split(part).length - 1;

test("Health Connect's privacy link opens /privacy on a cold start and in a running app", () => {
  const routed = addPrivacyLinkRouting(mainActivity, "kinevaulttrack");

  assert.match(
    routed,
    /override fun onCreate\(savedInstanceState: Bundle\?\) \{[^}]*routeHealthConnectPrivacyLink\(intent\)\n[^}]*super\.onCreate\(null\)/,
  );
  assert.match(
    routed,
    /override fun onNewIntent\(intent: Intent\) \{\n {4}routeHealthConnectPrivacyLink\(intent\)\n {4}super\.onNewIntent\(intent\)\n/,
  );
  assert.match(
    routed,
    /"androidx\.health\.ACTION_SHOW_PERMISSIONS_RATIONALE",\n\s*"android\.intent\.action\.VIEW_PERMISSION_USAGE" -> \{\n\s*intent\.action = Intent\.ACTION_VIEW\n\s*intent\.data = Uri\.parse\("kinevaulttrack:\/\/privacy"\)/,
  );
  assert.match(
    routed,
    /^package com\.kinevault\.track\nimport android\.content\.Intent\nimport android\.net\.Uri\n/,
  );
  // The new methods sit inside the class, after the existing ones.
  assert.ok(routed.indexOf("fun onNewIntent") > routed.indexOf("fun invokeDefaultOnBackPressed"));
  assert.ok(routed.trimEnd().endsWith("  }\n}"));
});

test("app.json routes the link with its own scheme after Health Connect's plugin", () => {
  const plugins = appJson.expo.plugins;
  assert.equal(appJson.expo.scheme, "kinevaulttrack");
  assert.ok(
    plugins.indexOf("./plugins/with-health-connect-privacy-link.cjs") >
      plugins.indexOf("react-native-health-connect"),
  );
  assert.ok(plugins.includes("react-native-health-connect"));
});

test("a second prebuild without --clean leaves the routed MainActivity unchanged", () => {
  const routed = addPrivacyLinkRouting(mainActivity, "kinevaulttrack");
  assert.equal(addPrivacyLinkRouting(routed, "kinevaulttrack"), routed);
  assert.equal(count(routed, "routeHealthConnectPrivacyLink(intent)\n"), 2);
});

test("existing imports aren't added twice", () => {
  const withImport = mainActivity.replace(
    "import android.os.Build\n",
    "import android.content.Intent\nimport android.os.Build\n",
  );
  const routed = addPrivacyLinkRouting(withImport, "kinevaulttrack");
  assert.equal(count(routed, "import android.content.Intent\n"), 1);
  assert.equal(count(routed, "import android.net.Uri\n"), 1);
});

test("the privacy link fails prebuild instead of building a broken MainActivity", () => {
  assert.throws(() => addPrivacyLinkRouting(mainActivity, undefined), /valid "scheme"/);
  assert.throws(() => addPrivacyLinkRouting(mainActivity, 'bad"scheme'), /valid "scheme"/);
  assert.throws(
    () => addPrivacyLinkRouting(mainActivity.replace("super.onCreate(null)", ""), "kinevaulttrack"),
    /no super\.onCreate/,
  );
  const withNewIntent = mainActivity.replace(
    "  override fun getMainComponentName",
    "  override fun onNewIntent(intent: Intent) {\n    super.onNewIntent(intent)\n  }\n\n  override fun getMainComponentName",
  );
  assert.throws(
    () => addPrivacyLinkRouting(withNewIntent, "kinevaulttrack"),
    /already overrides onNewIntent/,
  );
});

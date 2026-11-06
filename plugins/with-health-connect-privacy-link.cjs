// Opens /privacy from Health Connect's privacy policy link.
//
// react-native-health-connect sends that link to MainActivity: the
// ACTION_SHOW_PERMISSIONS_RATIONALE intent through Android 13, and
// VIEW_PERMISSION_USAGE through an activity-alias from Android 14. Both arrive
// without a URL, so the app opened its start screen. React Native passes a URL
// to Expo Router only for an ACTION_VIEW intent, so this plugin turns those two
// intents into a view intent for <scheme>://privacy before React Native reads
// them: in onCreate for a cold start and in onNewIntent for a running app.
const { withMainActivity } = require("expo/config-plugins");

const marker = "routeHealthConnectPrivacyLink";

function addPrivacyLinkRouting(contents, scheme) {
  if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme ?? "")) {
    throw new Error(`Set a valid "scheme" in app.json for the Health Connect privacy link.`);
  }
  if (contents.includes(marker)) return contents;
  const onCreate = /^([ \t]*)super\.onCreate\(/m;
  if (!onCreate.test(contents)) {
    throw new Error("MainActivity has no super.onCreate call for the Health Connect privacy link.");
  }
  if (/\bfun onNewIntent\(/.test(contents)) {
    throw new Error(
      "MainActivity already overrides onNewIntent. Merge the Health Connect privacy link into it.",
    );
  }
  const classEnd = contents.lastIndexOf("}");
  const imports = ["android.content.Intent", "android.net.Uri"]
    .filter((name) => !contents.includes(`\nimport ${name}\n`))
    .map((name) => `import ${name}\n`)
    .join("");
  const methods = `
  override fun onNewIntent(intent: Intent) {
    ${marker}(intent)
    super.onNewIntent(intent)
  }

  // Health Connect's privacy policy link (see plugins/with-health-connect-privacy-link.cjs).
  private fun ${marker}(intent: Intent) {
    when (intent.action) {
      "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE",
      "android.intent.action.VIEW_PERMISSION_USAGE" -> {
        intent.action = Intent.ACTION_VIEW
        intent.data = Uri.parse("${scheme}://privacy")
      }
    }
  }
`;
  const body = contents.slice(0, classEnd).replace(onCreate, `$1${marker}(intent)\n$&`).trimEnd();
  return `${body}\n${methods}${contents.slice(classEnd)}`.replace(
    /^(package [^\n]*\n)/,
    `$1${imports}`,
  );
}

function withHealthConnectPrivacyLink(config) {
  return withMainActivity(config, (activityConfig) => {
    if (activityConfig.modResults.language !== "kt") {
      throw new Error("The Health Connect privacy link supports only a Kotlin MainActivity.");
    }
    const scheme = [].concat(config.scheme)[0];
    activityConfig.modResults.contents = addPrivacyLinkRouting(
      activityConfig.modResults.contents,
      scheme,
    );
    return activityConfig;
  });
}

module.exports = withHealthConnectPrivacyLink;
module.exports.addPrivacyLinkRouting = addPrivacyLinkRouting;

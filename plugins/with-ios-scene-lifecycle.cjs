// Moves the generated iOS app to the UIKit scene life cycle.
//
// Apps built with the iOS 27 SDK (Xcode 27) stop at launch on iOS 27 unless
// they use a scene delegate. Expo SDK 57 ships `ExpoAppSceneDelegate` for this,
// but its prebuild template still starts React Native from the app delegate.
// This plugin names Expo's scene delegate in Info.plist and lets it create the
// window and start React Native. The scene life cycle works on every iOS
// version the app supports, so Xcode 26 builds behave the same way.
//
// Remove this plugin once `expo prebuild` generates a scene-based AppDelegate.
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const sceneDelegateClassName = "EXExpoAppSceneDelegate";
const classDeclaration = "class AppDelegate: ExpoAppDelegate {";
const providerDeclaration = "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {";
// The template's app-delegate start-up. ExpoAppSceneDelegate does this instead.
const appDelegateStartup =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([^)]*\)\n#endif\n/;

function adoptSceneDelegate(contents) {
  if (contents.includes("ExpoReactNativeFactoryProvider")) return contents;
  if (!contents.includes(classDeclaration) || !appDelegateStartup.test(contents)) {
    throw new Error(
      "plugins/with-ios-scene-lifecycle.cjs: the generated AppDelegate.swift no longer matches " +
        "the Expo SDK 57 template. Check whether Expo now generates a scene-based AppDelegate; " +
        "if so, remove this plugin from app.json.",
    );
  }
  return contents
    .replace(classDeclaration, providerDeclaration)
    .replace(
      appDelegateStartup,
      "\n    // ExpoAppSceneDelegate creates the window and starts React Native.\n",
    );
}

module.exports = function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (plistConfig) => {
    plistConfig.modResults.UIApplicationSceneManifest ??= {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: sceneDelegateClassName,
          },
        ],
      },
    };
    return plistConfig;
  });
  return withAppDelegate(config, (delegateConfig) => {
    if (delegateConfig.modResults.language !== "swift") {
      throw new Error("plugins/with-ios-scene-lifecycle.cjs expects a Swift AppDelegate.");
    }
    delegateConfig.modResults.contents = adoptSceneDelegate(delegateConfig.modResults.contents);
    return delegateConfig;
  });
};

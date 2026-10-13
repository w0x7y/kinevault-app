# Build and run on an iPhone with Xcode

This runbook builds KineVault Track from source on a Mac and installs it on a
physical iPhone. It works with a free Apple ID (Personal Team) and with a paid
Apple Developer Program team.

The project uses Expo's Continuous Native Generation. The `ios/` folder is
generated from `app.json` and `plugins/`, ignored by Git, and rebuilt from
scratch by `npm run ios:prebuild`. Don't edit files in `ios/`: the next prebuild
deletes those changes. Put native configuration in `app.json` or a config plugin.

## What the generated project contains

| Item | Value |
| --- | --- |
| Workspace to open | `ios/KineVaultTrack.xcworkspace` (created by `pod install`) |
| Scheme and app target | `KineVaultTrack` |
| Bundle identifier | `com.kinevault.track` |
| Version and build | `1.0.0` (`expo.version`), build `1` (`expo.ios.buildNumber`) |
| Minimum iOS | 16.4 |
| JavaScript engine | Hermes, React Native New Architecture |
| URL schemes | `kinevaulttrack` and `com.kinevault.track` |
| Entitlements | None (`KineVaultTrack.entitlements` is an empty dictionary) |
| Export compliance | `ITSAppUsesNonExemptEncryption` is `false` |
| Orientation | iPhone portrait; iPad all four |

`"orientation": "portrait"` in `app.json` sets `UISupportedInterfaceOrientations`
to portrait and portrait upside down. iPhones still don't turn upside down:
`react-native-screens`, which hosts every screen, excludes upside down on iPhone
because no screen sets its own orientation. The iPad keeps all four
orientations in `UISupportedInterfaceOrientations~ipad`, and `UIRequiresFullScreen`
is `false`, so Split View and Slide Over stay available. App Store validation
rejects an iPad build that allows multitasking without all four orientations.
The scene life cycle plugin doesn't change either key.

Info.plist also has the camera and photo library usage strings from the
`expo-camera` and `expo-image-picker` entries in `app.json`. It has no Face ID
usage string. The app never asks for Face ID: sign-in tokens in SecureStore
don't require authentication to read. `"faceIDPermission": false` on the
`expo-secure-store` plugin keeps `NSFaceIDUsageDescription` out. App Transport
Security keeps its defaults: HTTPS only, plus local-network HTTP so a Debug build
can reach Metro. Plain HTTPS requests such as Open Food Facts lookups and Tracked
share links (`https://app.tracked.gg/v/workout/<uuid>`) need no exception.

## Prerequisites

- **Xcode 26 or newer.** React Native 0.86.3 stops `pod install` on anything
  older than Xcode 16.1. Expo SDK 57 modules (`expo-image`, `expo-router`) also
  call iOS 26 SDK APIs, so older Xcode versions fail to compile them. Xcode 27
  works too; see [Scene life cycle](#scene-life-cycle). After installing Xcode,
  open it once and install the iOS platform when prompted, then run:

  ```sh
  sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
  sudo xcodebuild -license accept
  ```

- **CocoaPods 1.16.2 or newer**: `brew install cocoapods`, then `pod --version`.
  The Homebrew build avoids most Ruby problems on Apple silicon.
- **Node.js 24**, as pinned in `.nvmrc`. React Native needs 24.3 or later in
  the 24 line. With nvm: `nvm install && nvm use` in `Application/`.
- **Git**, which comes with the Xcode command-line tools. `npm ci` uses it to
  apply the dependency security patches.
- **An iPhone running iOS 16.4 or later**, a USB cable for the first
  connection, and an Apple ID.

## 1. Install dependencies

```sh
cd Application
npm ci
```

npm may report that it skipped `@sentry/cli`'s install script. That's expected
and harmless here: nothing in the iOS build calls `sentry-cli` (see
[Sentry](#sentry)), and the macOS binary comes from the `@sentry/cli-darwin`
package anyway.

## 2. Configure the environment

```sh
cp .env.example .env.local
```

Fill in `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
optionally `EXPO_PUBLIC_SENTRY_DSN`. These are public client values. They're
compiled into the JavaScript bundle: a Debug build reads them when Metro starts,
and a Release build reads them during Xcode's "Bundle React Native code and
images" phase. Restart Metro or rebuild after changing them. Without the
Supabase values the app still runs, but account features stay off.

## 3. Generate the Xcode project

```sh
npm run ios:prebuild
```

This runs `expo prebuild --platform ios --clean`. It deletes `ios/`, generates it
again from `app.json` and `plugins/`, and runs `pod install`. The first
`pod install` downloads prebuilt React Native and Expo frameworks plus the
Sentry, SDWebImage and ZXing pods, so it needs internet access and takes a few
minutes.

- If the Git working tree has uncommitted changes, prebuild asks before it
  continues. Answering yes is safe: it only replaces the ignored `ios/` folder.
- Prebuild replaces the `ios` and `android` scripts in `package.json` with
  `expo run:ios` and `expo run:android` when they are exactly
  `expo start --ios` and `expo start --android`. They use the short flags
  `-i` and `-a` so prebuild leaves them alone; keep that spelling.
- Run it again after changing `app.json`, anything in `plugins/`, or a
  dependency with native code, and after pulling such changes.

## 4. Open the workspace

```sh
npm run ios:open
```

This runs `xed ios`, which opens `ios/KineVaultTrack.xcworkspace`. Always use the
workspace, not `KineVaultTrack.xcodeproj`. If Xcode offers "Update to recommended
settings", skip it: the project is regenerated anyway.

## 5. Signing

1. Xcode > Settings > Accounts: add your Apple ID.
2. In the project navigator, select **KineVaultTrack**, then the
   **KineVaultTrack** target, then **Signing & Capabilities**.
3. Turn on **Automatically manage signing** and pick your team. A free Apple ID
   shows up as "Your Name (Personal Team)".
4. Leave the bundle identifier as generated. The capability list stays empty: no
   Push Notifications, no iCloud. Don't add capabilities here, because a free
   team can't sign them and prebuild would remove them anyway.

If Xcode says the bundle identifier can't be registered or isn't available,
another team owns it. Follow [Change the bundle identifier](#change-the-bundle-identifier).

`npm run ios:prebuild` clears the team. To keep it across rebuilds, read your
team ID once with `grep DEVELOPMENT_TEAM ios/KineVaultTrack.xcodeproj/project.pbxproj`
and add it to `app.json` as `"ios": { "appleTeamId": "ABCDE12345" }`. Only commit
that for a shared team; for a personal team, keep it local or re-select the team.

Free Personal Team limits:

- The app's provisioning profile expires after 7 days. Build and run again to
  renew it. Data saved in the app survives reinstalling over it.
- A device can run at most 3 apps signed by free teams at a time.
- A free team can register at most 10 new App IDs per 7 days.

## 6. Prepare the iPhone

1. Connect the iPhone by USB, unlock it, and tap **Trust** for this computer.
2. Turn on Developer Mode: Settings > Privacy & Security > Developer Mode. The
   switch appears after the phone has been connected to Xcode once. The phone
   restarts; confirm **Turn On** after the restart.
3. In Xcode, open Window > Devices and Simulators and wait until the phone
   finishes preparing for development.
4. Optional: in the same window, enable **Connect via network** to run builds
   over Wi-Fi later.

## 7. Debug build (JavaScript from Metro)

Use Debug for day-to-day work. The app loads JavaScript from Metro on the Mac,
so edits reload without rebuilding.

1. Put the Mac and the iPhone on the same Wi-Fi network.
2. In `Application/`, start Metro and leave it running:

   ```sh
   npm start
   ```

3. In Xcode, choose the iPhone as the run destination, keep the
   **KineVaultTrack** scheme, and press Run (⌘R).
4. With a free team, the first launch fails with "Untrusted Developer". On the
   iPhone, open Settings > General > VPN & Device Management, select your Apple
   ID under Developer App, and tap **Trust**. Press Run again.
5. Allow the **Local Network** prompt. The app needs it to reach Metro.

A Debug build saves the Mac's Wi-Fi address when it's built. If that address
changes, rebuild, or shake the phone and use **Configure Bundler** in the
developer menu.

`npm run ios:device` (`expo run:ios --device`) does steps 2 and 3 in one command:
it lists connected devices, builds Debug, installs, and starts Metro. It uses the
signing team from step 5, so set that up in Xcode first.

## 8. Release build (standalone)

A Release build embeds the JavaScript as Hermes bytecode with all assets, so it
runs without Metro. Use it to check performance, the native splash screen, and
offline behavior.

- In Xcode: Product > Scheme > Edit Scheme > Run > Build Configuration >
  **Release**, then Run. Set it back to Debug afterwards.
- Or from the terminal: `npx expo run:ios --device --configuration Release`.

`.env.local` must exist when you build. The 7-day limit for free teams still
applies.

## Supabase redirect URLs

Native builds, Debug and Release alike, build their email redirects from the
app scheme. `Linking.createURL("auth/callback")` returns
`kinevaulttrack://auth/callback`, and password reset adds `?flow=recovery`. Both
must be in the Supabase project's redirect allow list (Authentication > URL
Configuration > Redirect URLs):

```text
kinevaulttrack://auth/callback
kinevaulttrack://auth/callback?flow=recovery
```

`scripts/configure-auth.mjs` adds both; see [Supabase setup](supabase-setup.md).
The `exp://` URLs described there are only for Expo Go and don't apply to Xcode
builds. Changing the bundle identifier doesn't affect these URLs. To test, open a
confirmation or reset email in Mail on the iPhone and tap the link: it should
open the app on the callback screen.

These links carry a PKCE code. Hermes has no WebCrypto, so
`src/account/crypto-polyfill.ts` adds `crypto.getRandomValues` and
`crypto.subtle.digest` from `expo-crypto` before the Supabase client is created.
That gives a secure verifier and an S256 challenge instead of a `Math.random`
verifier sent as a `plain` challenge. `expo-crypto` adds the `ExpoCrypto` pod.
An app built before it was added stops at launch with "Cannot find native module
'ExpoCrypto'"; run `npm run ios:prebuild` and build again.

## Notifications

Reminders use local notifications from `expo-notifications`. They're scheduled
on the phone. There's no push server, no APNs and no Push Notifications
capability, so a free team can sign the app.

- iOS asks for notification permission the first time you turn on a reminder.
  If permission was denied, turn it back on in Settings > Notifications >
  KineVault Track.
- `expo-notifications` always adds the `aps-environment` entitlement, which
  requires the Push Notifications capability.
  `plugins/with-local-notifications-only.cjs` removes it again. It must stay
  listed before `expo-notifications` in `app.json`; prebuild stops with an error
  otherwise. CI generates the project and fails if `aps-environment` comes back.
- Remote push would need a paid team: remove that plugin, enable the capability,
  and add push-token registration.
- On Android, notifications use `assets/branding/notification-icon.png` as the
  small icon, tinted `#314e65`.

## Sentry

`@sentry/react-native` is linked natively (the `RNSentry` and Sentry Cocoa pods
compile into the app), but its Expo config plugin, `@sentry/react-native/expo`,
is not in `app.json`. As a result the Xcode project has no "Upload Debug Symbols
to Sentry" phase, the bundle phase doesn't run `sentry-cli`, and no
`sentry.properties` file exists. Builds don't need `SENTRY_AUTH_TOKEN` and don't
depend on `@sentry/cli`'s install script.

Crash reporting itself is set at runtime in
`src/components/crash-reporting-policy.ts`. It sends sanitized JavaScript errors
when `EXPO_PUBLIC_SENTRY_DSN` is set and keeps native crash handling off
(`enableNative: false`). Adding the plugin would not change that.

The trade-off: Release stack traces arrive without source maps, and Swift or
Objective-C crashes are not reported. That matches the deferred symbolication
decision in [Sentry verification](sentry-verification.md). Enabling uploads later
means:

1. Adding `["@sentry/react-native/expo", { "organization": "idan-gilboa", "project": "kinevault-track" }]`
   to the `app.json` plugins (plus the region `url` option Sentry documents for
   EU organizations) and running `npm run ios:prebuild`.
2. Making `SENTRY_AUTH_TOKEN` available to the Xcode build for builds that
   should upload.
3. For other local builds, adding `export SENTRY_DISABLE_AUTO_UPLOAD=true` to
   `ios/.xcode.env.local`. Without a token or that variable, Release builds fail
   with "error: sentry-cli - To disable source maps auto upload, set
   SENTRY_DISABLE_AUTO_UPLOAD=true".

## Change the bundle identifier

1. Edit `expo.ios.bundleIdentifier` in `app.json`, for example to
   `com.yourname.kinevaulttrack`. Use reverse-DNS form with letters, digits,
   hyphens and periods.
2. Run `npm run ios:prebuild`. Changing it only in Xcode doesn't last; the next
   prebuild resets it.
3. Select your team again in Signing & Capabilities.
4. The phone treats this as a new app. Delete the old copy; its local data
   doesn't move to the new one.

The URL scheme stays `kinevaulttrack`, so the Supabase redirect URLs don't
change. Changing `expo.scheme` is a different matter: that also requires
updating `src/account/auth-links.ts`, `scripts/configure-auth.mjs` and the
Supabase allow list.

## Scene life cycle

Apps built with the iOS 27 SDK (Xcode 27) stop at launch on iOS 27 unless they
use the UIKit scene life cycle. Expo SDK 57 includes a scene delegate,
`ExpoAppSceneDelegate`, but its prebuild template still starts React Native from
the app delegate. `plugins/with-ios-scene-lifecycle.cjs` adds a
`UIApplicationSceneManifest` to Info.plist that names `EXExpoAppSceneDelegate`. It
also changes `AppDelegate.swift` so the scene delegate creates the window and
starts React Native. Builds from Xcode 26 behave the same way.

If a future Expo template already uses scenes or no longer matches, the plugin
stops prebuild with an error. Remove it from `app.json` at that point.

## Privacy manifest

`pod install` creates `ios/KineVaultTrack/PrivacyInfo.xcprivacy` by merging
React Native's required-reason entries (file timestamps `C617.1`, user defaults
`CA92.1`, system boot time `35F9.1`) with the manifests that pods ship, such as
`expo-file-system`'s disk-space reasons. `@react-native-async-storage/async-storage`
2.2.0 ships its own manifest and doesn't use `UserDefaults`. `expo-crypto` ships
none; it calls `SecRandomCopyBytes`, CommonCrypto digests and CryptoKit, which
aren't required-reason APIs. The other linked pods without manifests don't call
required-reason APIs that aren't already declared, so `app.json` has no
`ios.privacyManifests` entry. Repeat that check when adding a native dependency.
The collected-data section stays empty and must be filled in before an App Store
submission.

## Troubleshooting

**`pod install` fails**

- "React Native requires XCode >= 16.1": update Xcode (Xcode 26 or newer is
  needed anyway).
- Download or CDN errors for prebuilt frameworks: retry, then try
  `cd ios && pod install --repo-update`. To build everything from source
  instead (slower), run
  `cd ios && RCT_USE_PREBUILT_RNCORE=0 RCT_USE_RN_DEP=0 EXPO_USE_PRECOMPILED_MODULES=0 pod install`.
- Ruby, `ffi` or gem errors: use the Homebrew CocoaPods instead of the system
  Ruby gem.
- Build stops with "The sandbox is not in sync with the Podfile.lock": run
  `cd ios && pod install`, or `npm run ios:prebuild`.

**Compile errors**

- Errors about iOS 26 symbols such as `drawOn` or `prominent` mean Xcode is
  older than 26.
- "Command PhaseScriptExecution failed" in "Bundle React Native code and images"
  with `node: command not found`: Xcode can't find Node. From a shell where Node
  24 is active, run `echo "export NODE_BINARY=$(command -v node)" > ios/.xcode.env.local`.

**Signing errors**

- "Signing for KineVaultTrack requires a development team": choose a team in
  Signing & Capabilities.
- "Failed to register bundle identifier" or "is not available": change the
  bundle identifier.
- "Personal development teams ... do not support the Push Notifications
  capability" (or iCloud): `ios/KineVaultTrack/KineVaultTrack.entitlements` is
  not empty. Check that `./plugins/with-local-notifications-only.cjs` is still in
  `app.json` before `expo-notifications`, run `npm run ios:prebuild`, and don't
  add capabilities in Xcode.
- "Maximum App ID limit reached": a free team has used 10 App IDs this week.
  Wait, or reuse a bundle identifier you registered before.
- "The maximum number of apps for free development profiles has been reached":
  delete another app that was installed with a free team.

**Launch problems**

- "Untrusted Developer" or "the profile has not been explicitly trusted": trust
  your Apple ID in Settings > General > VPN & Device Management.
- "Developer Mode disabled": see step 6.
- The app closes immediately on iOS 27 after building with Xcode 27: check that
  `ios/KineVaultTrack/Info.plist` contains `UIApplicationSceneManifest`. If it
  doesn't, the scene plugin is missing from `app.json`.
- Release build stuck on the splash screen or blank: read the Xcode console
  (View > Debug Area) for the JavaScript error, and check that `.env.local`
  existed when you built.

**Metro not reachable** ("No script URL provided", "Could not connect to
development server")

- Make sure `npm start` is running. On the iPhone, open
  `http://<mac-ip>:8081/status` in Safari; it should show
  `packager-status:running`.
- Use the same Wi-Fi on both devices. Guest and office networks often block
  device-to-device traffic; try a personal hotspot, or use a Release build.
- Turn on Settings > Privacy & Security > Local Network > KineVault Track.
- Allow incoming connections for `node` if the macOS firewall asks, and turn off
  VPNs on both devices.
- If the Mac's address changed, rebuild or use **Configure Bundler**.

**`sentry-cli` errors**

The current configuration never runs `sentry-cli`. Seeing it in build logs means
the Sentry config plugin was added; follow the steps in [Sentry](#sentry).

## Checks that need a Mac

These steps were checked on Linux: prebuild output, entitlements, Info.plist,
build phases, `expo-doctor`, `expo install --check` and an iOS Hermes bundle via
`expo export`. The following still need a Mac and an iPhone:

- `pod install` succeeds and creates `ios/KineVaultTrack.xcworkspace` and
  `ios/KineVaultTrack/PrivacyInfo.xcprivacy`.
- Debug and Release builds compile and sign with a Personal Team.
- The app launches with the scene delegate. Check iOS 27 with Xcode 27
  specifically.
- A `kinevaulttrack://auth/callback` email link opens the app, both cold and
  while it's running.
- The camera, photo picker and notification permission prompts appear with the
  expected text, and a scheduled local reminder fires.
- An iPhone stays in portrait when rotated. An iPad rotates to all four
  orientations and opens in Split View.
- A sign-up confirmation or password reset email link finishes signing in. The
  code exchange depends on the WebCrypto polyfill described in
  [Supabase redirect URLs](#supabase-redirect-urls).

# iPhone with Xcode

Build KineVault Track on a Mac and install it on an iPhone. A free Apple ID (Personal Team) works.

Git ignores `ios/`. `npm run ios:prebuild` deletes it and generates it again from `app.json` and `plugins/`, so put native changes there, never in `ios/`.

| Item              | Value                                                               |
| ----------------- | ------------------------------------------------------------------- |
| Workspace         | `ios/KineVaultTrack.xcworkspace`                                    |
| Scheme and target | `KineVaultTrack`                                                    |
| Bundle identifier | `com.kinevault.track`                                               |
| Version           | `1.0.0` (`expo.version`), build `1` (`expo.ios.buildNumber`)        |
| Minimum iOS       | 16.4                                                                |
| Engine            | Hermes, New Architecture                                            |
| URL schemes       | `kinevaulttrack`, `com.kinevault.track`                             |
| Entitlements      | None (`KineVaultTrack.entitlements` is empty)                       |
| Export compliance | `ITSAppUsesNonExemptEncryption` is `false`                          |
| Orientation       | iPhone portrait; iPad all four, with `UIRequiresFullScreen` `false` |

App Store validation rejects an iPad build that allows multitasking without all four orientations. Info.plist has camera and photo library usage strings, and `NSMotionUsageDescription` for Home's Steps. Steps use Core Motion, not HealthKit, so no entitlement is needed. There's no Face ID string, because `"faceIDPermission": false` on `expo-secure-store` keeps it out. App Transport Security keeps its defaults: HTTPS only, plus local-network HTTP for Metro.

## Requirements

| Tool      | Version                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| Xcode     | 26 or newer. Older versions can't compile Expo SDK 58. Xcode 27 works, see [Scene life cycle](#scene-life-cycle). |
| CocoaPods | 1.16.2 or newer: `brew install cocoapods`                                                                         |
| Node.js   | 24.3 or newer in the 24 line (`.nvmrc`): `nvm install && nvm use`                                                 |
| Git       | Comes with the Xcode command-line tools. `npm ci` uses it to apply the security patches.                          |
| iPhone    | iOS 16.4 or later, a USB cable and an Apple ID                                                                    |

After installing Xcode, open it once, install the iOS platform, then run:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

## Build and run

1. Install and configure:

   ```sh
   cd Application
   npm ci
   cp .env.example .env.local
   ```

   Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Debug builds read them when Metro starts, Release builds when Xcode builds, so restart Metro or rebuild after a change. Without the Supabase values, account features stay off.

2. Generate and open the project:

   ```sh
   npm run ios:prebuild
   npm run ios:open
   ```

   The first `pod install` downloads prebuilt frameworks and takes a few minutes. If prebuild asks about uncommitted changes, answering yes is safe. Rerun it after changing `app.json`, `plugins/` or a native dependency. Always open the `.xcworkspace`, not the `.xcodeproj`, and skip "Update to recommended settings".

3. Sign. In Xcode > Settings > Accounts, add your Apple ID. Select the **KineVaultTrack** target > **Signing & Capabilities**, turn on **Automatically manage signing** and pick your team. Leave the bundle identifier as it is and don't add capabilities. A free team can't sign them, and prebuild removes them.

4. Prepare the iPhone. Connect it by USB, unlock it and tap **Trust**. Turn on Settings > Privacy & Security > Developer Mode (it appears after the first connection to Xcode), and confirm **Turn On** after the restart. Wait until Window > Devices and Simulators shows it ready. **Connect via network** there allows Wi-Fi builds later.

5. Run a Debug build. It loads JavaScript from Metro, so edits reload without rebuilding. Put the Mac and iPhone on the same Wi-Fi, run `npm start` and leave it running. In Xcode, pick the iPhone and press Run (⌘R).

6. On the first launch with a free team, iOS says "Untrusted Developer". Open Settings > General > VPN & Device Management, select your Apple ID and tap **Trust**. Run again and allow the **Local Network** prompt so the app can reach Metro.

`npm run ios:device` lists connected devices, builds Debug, installs it and starts Metro in one command. It uses the team from step 3.

A Debug build saves the Mac's Wi-Fi address. If that changes, rebuild, or shake the phone and use **Configure Bundler**.

Prebuild clears the team. To keep it, find your team ID with `grep DEVELOPMENT_TEAM ios/KineVaultTrack.xcodeproj/project.pbxproj` and add `"ios": { "appleTeamId": "ABCDE12345" }` to `app.json`. Commit that only for a shared team.

Keep the `ios` and `android` scripts in `package.json` as `expo start -i` and `expo start -a`. Prebuild rewrites the long `--ios` and `--android` forms to `expo run:*`.

## Release build

A Release build embeds the JavaScript and runs without Metro. `.env.local` must exist when you build.

- In Xcode: Product > Scheme > Edit Scheme > Run > Build Configuration > **Release**, then Run. Set it back to Debug afterward.
- Or: `npx expo run:ios --device --configuration Release`

## Free team limits

- The provisioning profile expires after 7 days. Build and run again; the app's data stays.
- A device can run at most 3 apps from free teams.
- A free team can register at most 10 new App IDs per 7 days.

## Supabase redirect URLs

Native builds send these redirects. Both must be in Supabase's Authentication > URL Configuration > Redirect URLs:

```text
kinevaulttrack://auth/callback
kinevaulttrack://auth/callback?flow=recovery
```

`scripts/configure-auth.mjs` adds both; see [Supabase setup](supabase-setup.md). The `exp://` URLs there are for Expo Go only. To test, tap a confirmation or reset link in Mail on the iPhone. It should open the app's callback screen.

The links carry a PKCE code. Hermes has no WebCrypto, so `src/account/crypto-polyfill.ts` adds `crypto.getRandomValues` and `crypto.subtle.digest` from `expo-crypto` before the Supabase client starts. If the app stops at launch with "Cannot find native module 'ExpoCrypto'", run `npm run ios:prebuild` and build again.

## Notifications

Reminders are local notifications from `expo-notifications`. There's no push server, APNs or Push Notifications capability, so a free team can sign the app.

- If permission was denied, turn it on in Settings > Notifications > KineVault Track.
- `plugins/with-local-notifications-only.cjs` removes the `aps-environment` entitlement that `expo-notifications` adds. Keep it before `expo-notifications` in `app.json`, or prebuild stops with an error. CI fails if `aps-environment` comes back.
- Remote push needs a paid team. Remove that plugin, enable the capability and add push-token registration.
- On Android, the small icon is `assets/branding/notification-icon.png`, tinted `#3a6a96`.

## Change the bundle identifier

1. Set `expo.ios.bundleIdentifier` in `app.json`, such as `com.yourname.kinevaulttrack`. Use reverse-DNS form with letters, digits, hyphens and periods.
2. Run `npm run ios:prebuild`. A change made only in Xcode is lost on the next prebuild.
3. Pick your team again in Signing & Capabilities.
4. Delete the old copy from the phone. The new identifier is a new app, and local data doesn't carry over.

The Supabase redirect URLs don't change. Changing `expo.scheme` does change them, and also needs `src/account/auth-links.ts`, `scripts/configure-auth.mjs` and the Supabase allow list updated.

## Scene life cycle

Apps built with the iOS 27 SDK (Xcode 27) stop at launch on iOS 27 without the UIKit scene life cycle. `expo prebuild` generates `SceneDelegate.swift` and adds `UIApplicationSceneManifest` to Info.plist. Xcode 26 builds use it too.

## Privacy manifest

`pod install` creates `ios/KineVaultTrack/PrivacyInfo.xcprivacy`. It merges React Native's required-reason entries (file timestamps `C617.1`, user defaults `CA92.1`, system boot time `35F9.1`) with the manifests pods ship. Pods without one, such as `expo-crypto` and `expo-video`, call no undeclared required-reason APIs, so `app.json` has no `ios.privacyManifests`. Check again when adding a native dependency. Fill in the collected-data section before an App Store submission.

## Troubleshooting

| Symptom                                                                                       | Fix                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "React Native requires XCode >= 16.1"                                                         | Update to Xcode 26 or newer.                                                                                                                                                                                             |
| `pod install` download or CDN errors                                                          | Retry, then `cd ios && pod install --repo-update`. To build from source (slower): `cd ios && RCT_USE_PREBUILT_RNCORE=0 RCT_USE_RN_DEP=0 EXPO_USE_PRECOMPILED_MODULES=0 pod install`                                      |
| Ruby, `ffi` or gem errors                                                                     | Use Homebrew CocoaPods, not the system Ruby gem.                                                                                                                                                                         |
| "The sandbox is not in sync with the Podfile.lock"                                            | `cd ios && pod install`, or `npm run ios:prebuild`.                                                                                                                                                                      |
| Errors about iOS 26 symbols such as `drawOn` or `prominent`                                   | Xcode is older than 26.                                                                                                                                                                                                  |
| "Command PhaseScriptExecution failed" with `node: command not found`                          | From a shell with Node 24: `echo "export NODE_BINARY=$(command -v node)" > ios/.xcode.env.local`                                                                                                                         |
| "Signing for KineVaultTrack requires a development team"                                      | Pick a team in Signing & Capabilities.                                                                                                                                                                                   |
| "Failed to register bundle identifier" or "is not available"                                  | Another team owns it. [Change the bundle identifier](#change-the-bundle-identifier).                                                                                                                                     |
| "Personal development teams ... do not support the Push Notifications capability" (or iCloud) | `KineVaultTrack.entitlements` isn't empty. Check that `./plugins/with-local-notifications-only.cjs` is still before `expo-notifications` in `app.json`, run `npm run ios:prebuild`, and don't add capabilities in Xcode. |
| "Maximum App ID limit reached"                                                                | The free team used 10 App IDs this week. Wait, or reuse an identifier you registered before.                                                                                                                             |
| "The maximum number of apps for free development profiles has been reached"                   | Delete another app installed with a free team.                                                                                                                                                                           |
| "Untrusted Developer" or "the profile has not been explicitly trusted"                        | Settings > General > VPN & Device Management > Trust.                                                                                                                                                                    |
| "Developer Mode disabled"                                                                     | See step 4.                                                                                                                                                                                                              |
| App closes at once on iOS 27 after an Xcode 27 build                                          | Check `ios/KineVaultTrack/Info.plist` has `UIApplicationSceneManifest`. If not, run `npx expo prebuild --platform ios --clean`.                                                                                          |
| Release build blank or stuck on the splash screen                                             | Read the JavaScript error in the Xcode console (View > Debug Area). Check `.env.local` existed at build time.                                                                                                            |
| "No script URL provided" or "Could not connect to development server"                         | See below.                                                                                                                                                                                                               |

If the app can't reach Metro:

- Check `npm start` is running. Open `http://<mac-ip>:8081/status` in Safari on the iPhone; it should show `packager-status:running`.
- Use the same Wi-Fi on both. Guest and office networks often block device-to-device traffic. Try a personal hotspot or a Release build.
- Turn on Settings > Privacy & Security > Local Network > KineVault Track.
- Allow incoming connections for `node` in the macOS firewall, and turn off VPNs.
- If the Mac's address changed, rebuild or use **Configure Bundler**.

## Checks that need a Mac

Prebuild output, entitlements, Info.plist, build phases, `expo-doctor`, `expo install --check` and an iOS Hermes bundle were checked on Linux. These still need a Mac and an iPhone:

- `pod install` creates `ios/KineVaultTrack.xcworkspace` and `ios/KineVaultTrack/PrivacyInfo.xcprivacy`.
- Debug and Release builds compile and sign with a Personal Team.
- The app launches with the scene delegate, including iOS 27 with Xcode 27.
- A `kinevaulttrack://auth/callback` link opens the app, both cold and while running, and a confirmation or reset link finishes signing in (it needs the [WebCrypto polyfill](#supabase-redirect-urls)).
- Camera, photo picker, motion and notification prompts show the expected text, and a local reminder fires.
- After motion access, Home's Steps shows today's count.
- An exercise demo video plays (`expo-video`).
- An iPhone stays portrait when rotated. An iPad rotates to all four orientations and opens in Split View.

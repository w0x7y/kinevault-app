# Android APK

The `Android release build` workflow builds a signed release `.apk` and a signed `.aab` (Android App Bundle) from the same build. The `.apk` installs on Android 8.0 or newer without Expo Go or the Play Store. The `.aab` is for Google Play uploads. For iPhones, see [iPhone installs from Linux with xtool](ios-linux-xtool.md).

## Release key

| Item                | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Keystore            | `~/.config/kinevault-track/android-release.jks` on the maintainer's machine (PKCS12, created 2026-10-17) |
| Password            | `ANDROID_KEYSTORE_PASSWORD` in `android-release.env`, next to the keystore                               |
| Key alias           | `kinevault-track`                                                                                        |
| Certificate SHA-256 | `0A:08:B8:5D:2A:B1:A6:B4:92:10:36:B7:D9:67:A7:98:E2:AE:6A:FC:7E:83:AE:5E:AA:38:00:A3:32:00:10:4D`        |

Back up both files off this machine, for example in a password manager. GitHub never shows a secret again, so its copy isn't a backup. Android only installs an update signed with the same key. If the key is lost, every phone must uninstall the app first, and that deletes progress photos (they're local only) and unsynced changes.

The workflow runs in the `android-release` GitHub Environment. Only that environment holds the key secrets. It runs only from `main`, and a reviewer must approve each run under **Review deployments**. To set the secrets, from `Application/`:

```sh
base64 -w0 ~/.config/kinevault-track/android-release.jks | gh secret set ANDROID_KEYSTORE_BASE64 --env android-release
gh secret set ANDROID_KEYSTORE_PASSWORD --env android-release   # paste the password at the prompt
```

It also needs the Supabase variable and secret from [step 5 of the xtool runbook](ios-linux-xtool.md#5-configure-the-github-repository).

## Build

```sh
gh workflow run android-release-build.yml   # approve under Review deployments if asked
gh run watch
gh run download --name KineVaultTrack-apk --dir ~/Downloads
gh run download --name KineVaultTrack-aab --dir ~/Downloads   # for Google Play
```

In the browser, use Actions > Android release build > Run workflow, then download the `KineVaultTrack-apk` or `KineVaultTrack-aab` artifact. Each is a zip with the file inside.

To name a build, run `gh workflow run android-release-build.yml -f name=2026-10-19`. The artifacts are then `KineVaultTrack-2026-10-19` and `KineVaultTrack-2026-10-19-aab`, and the files `KineVaultTrack-2026-10-19.apk` and `KineVaultTrack-2026-10-19.aab`. Names allow letters, digits, dot, dash and underscore, up to 40 characters.

The workflow fails if the `.apk` or `.aab` isn't signed with the release key, if either lacks the Supabase URL in its bundle, or if the `.apk`'s versionCode isn't the run's. The run summary shows the versionCode and versionName. It builds for `armeabi-v7a` and `arm64-v8a` only. Artifacts expire after 7 days.

## Version codes

Google Play accepts an upload only if its `versionCode` is higher than every earlier one. The workflow sets `ANDROID_VERSION_CODE` to 1000 plus the run number before prebuild, and `plugins/with-android-version-code.cjs` writes it into the build, so `app.json` doesn't change per build. The versionName is `expo.version` in `app.json`; raise it by hand for each Play release.

- Re-running a run keeps its run number and versionCode, and Play refuses the same code twice. Start a new run for each upload.
- Renaming or recreating the workflow file restarts run numbers at 1. Raise the 1000 in the "Set the version code" step past the last uploaded code first.
- Older builds are all versionCode 1, so the first numbered build installs over them.
- Local builds are versionCode 1 unless prebuild runs with `ANDROID_VERSION_CODE` set. A phone with a workflow build refuses a lower code (`INSTALL_FAILED_VERSION_DOWNGRADE`).

When Play Console sets up Play App Signing for the first upload, upload the release key above as the app signing key instead of letting Google create one. With a Google-created key, Play installs are signed with a different key than the workflow `.apk`, so a phone can't switch between the two without uninstalling.

## Install

Over USB, with USB debugging on:

```sh
adb install -r ~/Downloads/KineVaultTrack.apk   # -r keeps the app's data
```

Without a computer, send the `.apk` to the phone and open it. Allow the app you opened it from to install unknown apps. If Play Protect warns about an unknown developer, install anyway.

Update every phone on the same account, iPhones included, before using a new workout feature. Builds from before 2026-10-19 can't load an exercise document with Alternating or Timed exercises, and builds without RIR drop RIR values when they save. Builds without Cardio can't load one with Cardio exercises and drop warm-up flags when they save.

Home's Steps reads Health Connect. Android 14 and newer have it built in. On Android 8 to 13, install it from Google Play; the app offers the install. If step access is refused, Steps shows **Open settings**. Android stops showing the permission dialog after repeated refusals.

## Build locally

It needs JDK 17 and the Android SDK (`ANDROID_HOME`). Run from `Application/`; the Supabase values come from `.env.local`.

```sh
npx expo prebuild --platform android --clean --no-install
cd android
./gradlew assembleRelease bundleRelease \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a \
  -Pandroid.injected.signing.store.file="$HOME/.config/kinevault-track/android-release.jks" \
  -Pandroid.injected.signing.store.password="<password>" \
  -Pandroid.injected.signing.key.alias=kinevault-track \
  -Pandroid.injected.signing.key.password="<password>"
```

The outputs are `android/app/build/outputs/apk/release/app-release.apk` and `android/app/build/outputs/bundle/release/app-release.aab`, versionCode 1. For another code, run prebuild as `ANDROID_VERSION_CODE=1042 npx expo prebuild ...`. Add `x86_64` to the architectures for an emulator. Without the signing flags, Gradle signs with the template's public debug key, and phones with the release build refuse it as an update.

## Troubleshooting

| Symptom                                                                                                    | Fix                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, or "App not installed as package conflicts with an existing package" | The phone has `com.kinevault.track` signed with another key, such as a debug build from `npx expo run:android`. Use Export account data in Settings, then uninstall and install again.          |
| Workflow fails at "Check required configuration"                                                           | Set the missing secret or variable above.                                                                                                                                                       |
| "The .apk isn't signed with the release keystore." or "The .aab isn't signed with the release keystore."   | The two key secrets don't match. Set both again from the files.                                                                                                                                 |
| `:app:packageRelease` fails with `OutOfMemoryError: Metaspace`                                             | `android/` was generated without `plugins/with-gradle-memory.cjs`, which raises Gradle's heap and metaspace. Run the prebuild command again, then build.                                        |
| "EXPO_PUBLIC_SUPABASE_URL is not in index.android.bundle."                                                 | The bundle task didn't see the environment. Check the variable's value, then rerun.                                                                                                             |
| "The .apk has versionCode '1', not 1042."                                                                  | `android/` was generated without `plugins/with-android-version-code.cjs` in `app.json`, or `ANDROID_VERSION_CODE` didn't reach prebuild.                                                        |
| `INSTALL_FAILED_VERSION_DOWNGRADE`                                                                         | The phone has a build with a higher versionCode, such as a workflow build under a local one. Rebuild with a higher `ANDROID_VERSION_CODE`, or export account data, uninstall and install again. |
| Run workflow button missing, or `gh workflow run` says not found                                           | The workflow file isn't on `main` yet.                                                                                                                                                          |

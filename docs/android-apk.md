# Install on Android phones

The manual `Android release build` workflow builds a release `.apk` signed with
the project's release key. It installs on any Android phone without Expo Go or
the Play Store. For iPhones, see
[iPhone installs from Linux with xtool](ios-linux-xtool.md).

## The release key

| Item | Value |
| --- | --- |
| Keystore | `~/.config/kinevault-track/android-release.jks` on the maintainer's machine (PKCS12, created 2026-10-17) |
| Password | `ANDROID_KEYSTORE_PASSWORD` in `android-release.env`, next to the keystore |
| Key alias | `kinevault-track` |
| Certificate SHA-256 | `0A:08:B8:5D:2A:B1:A6:B4:92:10:36:B7:D9:67:A7:98:E2:AE:6A:FC:7E:83:AE:5E:AA:38:00:A3:32:00:10:4D` |

Android only accepts an update signed with the same key as the installed app.
If the key is lost, every phone has to uninstall the app before it can install
a build signed with a new key, and uninstalling deletes progress photos (they
are local only) and any changes that haven't synced. Keep a copy of both files
off this machine, for example in a password manager.

The workflow reads the key from two repository secrets. GitHub never shows a
secret again, so they don't count as a backup. To set them again, from
`Application/`:

```sh
base64 -w0 ~/.config/kinevault-track/android-release.jks | gh secret set ANDROID_KEYSTORE_BASE64
gh secret set ANDROID_KEYSTORE_PASSWORD   # paste the password at the prompt
```

It also needs the Supabase variable and secret that the iOS workflow uses; see
[step 5 of the xtool runbook](ios-linux-xtool.md#5-configure-the-github-repository).

## Build

```sh
gh workflow run android-release-build.yml
gh run watch   # pick the run
gh run download --name KineVaultTrack-apk --dir ~/Downloads
```

In the browser, the same steps are Actions > Android release build > Run
workflow, then the `KineVaultTrack-apk` artifact on the finished run. The
browser download is a zip with the `.apk` inside.

The workflow fails if the `.apk` isn't signed with the release key or if the
Supabase URL is missing from the JavaScript bundle. It builds for phone CPUs
only (`armeabi-v7a`, `arm64-v8a`). Artifacts expire after 7 days.

## Install

Over USB, with USB debugging turned on in the phone's developer options:

```sh
adb install -r ~/Downloads/KineVaultTrack.apk
```

`-r` replaces an installed copy and keeps its data.

Without a computer, send the `.apk` to the phone, open it, and allow the app
you opened it from to install unknown apps when Android asks. Play Protect may
warn about an unknown developer; choose to install anyway.

Every build is version code 1 for now. Android accepts an update with the same
or a higher version code, so updates install over each other. A Play Store
release would need an increasing `expo.android.versionCode` and an app bundle
(`bundleRelease`) instead of an `.apk`.

## Build locally

With JDK 17 and the Android SDK (`ANDROID_HOME`), from `Application/`. The
Supabase values come from `.env.local`.

```sh
npx expo prebuild --platform android --clean --no-install
cd android
./gradlew assembleRelease \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a \
  -Pandroid.injected.signing.store.file="$HOME/.config/kinevault-track/android-release.jks" \
  -Pandroid.injected.signing.store.password="<password>" \
  -Pandroid.injected.signing.key.alias=kinevault-track \
  -Pandroid.injected.signing.key.password="<password>"
```

The `.apk` is `android/app/build/outputs/apk/release/app-release.apk`. Add
`x86_64` to the architectures to run it in an emulator. Without the signing
flags, Gradle signs with the template's public debug key, and phones with the
release build refuse it as an update.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, or "App not installed as package conflicts with an existing package" | The phone has `com.kinevault.track` signed with another key, such as a debug build from `npx expo run:android`. Use Export account data in Settings first, then uninstall and install again. |
| Workflow fails at "Check required configuration" | Set the missing secret or variable above. |
| "The .apk isn't signed with the release keystore." | The two key secrets don't match. Set both again from the files. |
| "EXPO_PUBLIC_SUPABASE_URL is not in index.android.bundle." | The bundle task didn't see the environment. Check the variable's value, then rerun. |
| Run workflow button missing, or `gh workflow run` says not found | The workflow file isn't on `main` yet. |

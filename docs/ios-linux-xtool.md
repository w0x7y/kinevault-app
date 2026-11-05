# iPhone from Linux with xtool

Install a Release build on an iPhone without a Mac. A GitHub-hosted macOS runner (Xcode 26.6) builds an unsigned `.ipa`. This Linux machine signs it with a free Apple ID and installs it over USB with [xtool](https://github.com/xtool-org/xtool). To build on a Mac instead, see [iOS builds with Xcode](ios-xcode.md).

xtool can't build this app. `xtool dev` only builds SwiftPM packages, not an Expo CocoaPods workspace ([#28](https://github.com/xtool-org/xtool/issues/28), [#144](https://github.com/xtool-org/xtool/issues/144)). It only signs and installs here, so it needs no Swift toolchain, `Xcode.xip` or xtool SDK.

Commands work in bash and fish unless a block says bash.

## Installed xtool

| Item         | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| Version      | xtool 1.21.0, x86_64 AppImage                                      |
| File         | `~/.local/opt/xtool/1.21.0/xtool-x86_64.AppImage`                  |
| Command      | `~/.local/bin/xtool`, a symlink to the file                        |
| SHA-256      | `e2277e59bb2fda9b487cbc77ad080ea2b0370bb740ac0f02cc42fa28a272d3a5` |
| Runs through | FUSE 2 (`fuse2` 2.9.9)                                             |
| Also needs   | libimobiledevice 1.4.0 (installed) and `usbmuxd` (step 1)          |

The checksum matches GitHub's digest for the release asset. That's the only integrity check, because the release has no signature file or build provenance.

```sh
xtool --version     # xtool 1.21.0
xtool auth status   # Logged out until step 4
```

**Update.** In bash, download the new release and compare both hashes:

```bash
v=1.22.0   # the new release tag
d=~/.local/opt/xtool/$v
mkdir -p "$d"
curl -fL -o "$d/xtool-x86_64.AppImage" \
  "https://github.com/xtool-org/xtool/releases/download/$v/xtool-x86_64.AppImage"
gh release view "$v" -R xtool-org/xtool --json assets \
  --jq '.assets[] | select(.name == "xtool-x86_64.AppImage") | .digest'
sha256sum "$d/xtool-x86_64.AppImage"
```

Only if they match, switch over in the same shell:

```bash
chmod +x "$d/xtool-x86_64.AppImage"
ln -sfn "$d/xtool-x86_64.AppImage" ~/.local/bin/xtool
xtool --version
```

**Remove.** Run `rm ~/.local/bin/xtool`, then delete `~/.local/opt/xtool` and `~/.config/xtool`.

## One-time setup

### 1. Install usbmuxd

```sh
sudo pacman -S --needed usbmuxd
```

Its udev rule starts `usbmuxd.service` when an Apple device is plugged in. If the phone was already connected, replug it or run `sudo systemctl start usbmuxd`.

### 2. Pair the iPhone

Connect the iPhone by USB, unlock it, tap **Trust** and enter the passcode. Then check:

```sh
idevice_id -l                    # the phone's UDID
idevicepair validate             # SUCCESS: Validated pairing with device ...
ideviceinfo -k ProductVersion    # needs 16.4 or later
xtool devices --no-wait          # <name> [usb]: <udid>
```

If `idevicepair validate` fails, run `idevicepair pair`, accept on the phone and validate again.

### 3. Turn on Developer Mode

```sh
idevicedevmodectl list      # shows whether it's on
idevicedevmodectl reveal    # shows the switch in Settings
```

On the iPhone, turn on Settings > Privacy & Security > Developer Mode. Confirm **Turn On** after the restart.

### 4. Sign in to Apple

```sh
xtool auth login --mode password
chmod -R go-rwx ~/.config/xtool
```

xtool asks for the Apple ID, password, two-factor code and team. A free Apple ID has one team, its Personal Team. Log in again when the token expires; `xtool auth status` shows the date.

- Never pass `--password` on the command line. It ends up in shell history and the process list.
- Don't use `xtool setup`. It asks for `Xcode.xip` after logging in. If you started it, press Ctrl+C at `Path to Xcode.xip:`; the login is already saved.
- Password mode uses Apple's private endpoints. The xtool docs suggest a separate Apple ID to be cautious. The iPhone can use a different Apple ID.
- The first login downloads Apple Music for Android from `apps.mzstatic.com` and keeps two of its libraries in `~/.config/xtool/Anisette`.
- The session token and the development certificate's private key sit unencrypted in `~/.config/xtool/data`. The `chmod` above hides them from other users. Keep the folder out of shared backups and synced folders. `xtool auth logout` deletes the token.

### 5. Configure the GitHub repository

The workflow compiles these into the JavaScript bundle. Set them under Settings > Secrets and variables > Actions, or with `gh` from `Application/`:

| Name                                   | Kind     | Required | Value                                        |
| -------------------------------------- | -------- | -------- | -------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | Variable | Yes      | Supabase project URL, as in `.env.local`     |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Secret   | Yes      | Supabase publishable key                     |
| `EXPO_PUBLIC_SENTRY_DSN`               | Variable | No       | Public Sentry DSN; unset turns reporting off |
| `EXPO_PUBLIC_TRACK_PARTITIONS`         | Variable | No       | Defaults to `false`; see `.env.example`      |

```sh
gh variable set EXPO_PUBLIC_SUPABASE_URL --body "https://<project-ref>.supabase.co"
gh secret set EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY    # paste the key at the prompt
gh variable set EXPO_PUBLIC_SENTRY_DSN --body "<dsn>"  # optional
```

The runner builds what's pushed to `main`, not your working tree. Push `.github/workflows/ios-unsigned-build.yml`, `plugins/` and the app changes you want first.

## Build, sign and install

1. Start the build, from Actions > iOS unsigned build > Run workflow or with:

   ```sh
   gh workflow run ios-unsigned-build.yml --ref main
   gh run watch
   ```

   The job has a 60-minute limit. If it fails, the `xcodebuild-log` artifact has the full log.

2. Download the `.ipa`. GitHub deletes it after 7 days, so keep your copy for [renewals](#renew-every-7-days).

   ```sh
   gh run list --workflow ios-unsigned-build.yml --limit 3
   gh run download <run-id> -n KineVaultTrack-unsigned-ipa -D ~/Downloads/kinevault-ios
   ```

3. Connect and unlock the iPhone, then sign and install:

   ```sh
   xtool install ~/Downloads/kinevault-ios/KineVaultTrack-unsigned.ipa
   ```

   It ends with "Successfully installed!". With several devices connected, pass `--udid <udid>`.

4. On first launch iOS says "Untrusted Developer". Open Settings > General > VPN & Device Management, select your Apple ID and tap **Trust**.

5. Open the app from its icon. `xtool launch` doesn't work on Linux.

The installed bundle identifier is `XTL-<id>.com.kinevault.track`; `xtool ds identifiers list` shows it. To remove the app, delete it on the phone or run `xtool uninstall XTL-<id>.com.kinevault.track`.

### Renew every 7 days

The free provisioning profile expires after 7 days and the app stops opening. Run the same `xtool install` with the same `.ipa`. The app keeps its data.

### New app versions

Push, run the workflow, download the new `.ipa` and install it the same way. It keeps the app's data. Update every device on the account before using a new workout feature, because older builds can drop or fail to load the new data (see [Install on Android phones](android-apk.md#install)).

For quick JavaScript edits, use Expo Go with `npm start` or `npm run start:lan` (see [iPhone connection](troubleshooting.md#iphone-connection)). Use the xtool build to check the native app, splash screen, notification permissions, `kinevaulttrack://` links and Release performance.

## Limits

- A device can have 3 apps from free teams at a time, counting ones from Xcode, AltStore, SideStore or Sideloadly.
- A free team can register 10 App IDs per 7 days. Renewals reuse this app's App ID.
- If xtool needs a new development certificate, it lists the ones it would revoke and asks first. Apps signed with a revoked certificate, such as a Mac's Xcode install with the same Apple ID, stop opening until re-signed. Answer no if that matters and use a separate Apple ID for xtool.
- The app is signed with the App ID, team, `get-task-allow` and HealthKit. xtool takes entitlements from the app's existing signature, so the workflow ad-hoc signs the app with its entitlements file first. A free team can have HealthKit ([Apple's capability list](https://developer.apple.com/help/account/reference/supported-capabilities-ios)), and xtool adds it to the App ID and profile. It has no push, iCloud or App Groups.
- The URL schemes stay `kinevaulttrack` and `com.kinevault.track`, so the [Supabase redirect URLs](ios-xcode.md#supabase-redirect-urls) still work. A copy installed from Xcode is a separate app with separate data.
- Installs work over USB only. Linux `usbmuxd` 1.1.1 can't find Wi-Fi devices, and xtool doesn't see `netmuxd` devices ([#134](https://github.com/xtool-org/xtool/issues/134)).
- The workflow builds Release only.
- There's no iOS Simulator, Xcode debugger or local native build on Linux. Every change to `app.json`, `plugins/` or a native dependency needs a workflow run.
- The repository is public, so anyone signed in to GitHub can download the artifacts while they exist. The `.ipa` holds only the public values from step 5, and it can't be installed unsigned.

Logs and crash reports:

```sh
idevicesyslog -p KineVaultTrack
mkdir -p ~/kinevault-crashes
idevicecrashreport -e -k -f KineVaultTrack ~/kinevault-crashes
```

JavaScript errors go to Sentry when `EXPO_PUBLIC_SENTRY_DSN` is set; see [iOS builds with Xcode](ios-xcode.md#sentry).

## When things change

- Apple can change the private login endpoints. When login breaks, update xtool first.
- If xtool's signing stops working, [Sideloader](https://github.com/Dadoum/Sideloader) also signs and installs an `.ipa` with a free Apple ID on Linux.
- When `/Applications/Xcode_26.6.app` leaves the `macos-26` runner image, update `DEVELOPER_DIR` in the workflow ([runner image readme](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md)). Xcode 27 (`xcode-27` label, in preview) relies on the [scene life cycle](ios-xcode.md#scene-life-cycle).

## Troubleshooting

| Symptom                                                          | Fix                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xtool devices` waits forever, or `--no-wait` prints nothing     | `usbmuxd` isn't running. Do step 1, replug the phone, and check `idevice_id -l` and `systemctl status usbmuxd`.                                                   |
| "Please log in with \`xtool auth\` before running this command." | Run `xtool auth login --mode password`.                                                                                                                           |
| "Please unlock your device..." or a pairing prompt               | Unlock the phone, tap **Trust**, and rerun if it stopped.                                                                                                         |
| Error about Developer Mode                                       | Do step 3, then rerun `xtool install`.                                                                                                                            |
| "Untrusted Developer" when opening the app                       | Trust your Apple ID in Settings > General > VPN & Device Management.                                                                                              |
| Maximum number of apps or App IDs reached                        | Delete another free-signed app, or wait for the 7-day App ID window.                                                                                              |
| xtool lists certificates to revoke                               | Say no if another Mac or tool depends on them (see [Limits](#limits)).                                                                                            |
| The app stopped opening after a week                             | Run `xtool install` with the same `.ipa`.                                                                                                                         |
| Two-factor or login errors                                       | Run `xtool auth logout --reset-2fa`, then log in again. Update xtool if it keeps failing.                                                                         |
| `fuse: memory allocation failed` or `squashfuse` usage text      | AppImageLauncher interferes ([#39](https://github.com/xtool-org/xtool/issues/39)) or FUSE 2 is missing. Remove AppImageLauncher, or extract the AppImage (below). |
| Workflow fails at "Check required configuration"                 | Set the variable and secret from step 5.                                                                                                                          |
| Workflow fails in `pod install` or `xcodebuild`                  | Read the `xcodebuild-log` artifact and the [Xcode troubleshooting](ios-xcode.md#troubleshooting). Rerun once for download errors.                                 |
| "EXPO_PUBLIC_SUPABASE_URL is not in main.jsbundle"               | The bundle phase didn't see the variable. Check its value, then rerun.                                                                                            |
| Run workflow button missing, or `gh workflow run` says not found | The workflow file isn't on `main` yet.                                                                                                                            |

To run xtool without FUSE, extract the AppImage:

```sh
mkdir -p ~/.local/opt/xtool/1.21.0-extracted
cd ~/.local/opt/xtool/1.21.0-extracted
~/.local/opt/xtool/1.21.0/xtool-x86_64.AppImage --appimage-extract
printf '#!/bin/sh\nexec "$HOME/.local/opt/xtool/1.21.0-extracted/squashfs-root/AppRun" "$@"\n' > ~/.local/bin/xtool.new
chmod +x ~/.local/bin/xtool.new
mv ~/.local/bin/xtool.new ~/.local/bin/xtool
xtool --version
```

## Sources

- [xtool 1.21.0 release](https://github.com/xtool-org/xtool/releases/tag/1.21.0)
- [Linux installation guide](https://xtool.sh/documentation/xtooldocs/installation-linux)
- [First app tutorial](https://xtool.sh/tutorials/xtooldocs/first-app), for pairing, Developer Mode and trust
- [GitHub macOS runner images](https://github.com/actions/runner-images)

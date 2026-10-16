# Install on an iPhone from Linux with xtool

This runbook puts a standalone Release build of KineVault Track on an iPhone
without a Mac. A GitHub-hosted macOS runner compiles an unsigned `.ipa`, and
this Linux machine signs it with a free Apple ID and installs it over USB with
[xtool](https://github.com/xtool-org/xtool). To build on a Mac with Xcode
instead, see [iOS builds with Xcode](ios-xcode.md).

```text
GitHub Actions (macOS 26, Xcode 26.6)       Linux
"iOS unsigned build" workflow       ──▶  gh run download
KineVaultTrack-unsigned.ipa              xtool install  ──USB──▶  iPhone
```

Commands below work in bash and fish unless a block says otherwise.

## What xtool is

xtool is an MIT-licensed command-line replacement for parts of Xcode, written
by Kabir Oberai. It runs on Linux, WSL and macOS and does three things:

- builds a SwiftPM package into an iOS app (`xtool dev`);
- signs and installs an existing `.ipa` or `.app` on a device (`xtool install`);
- talks to Apple Developer Services: teams, certificates, App IDs, devices and
  profiles (`xtool auth`, `xtool ds`).

What it needs on Linux depends on which of those you use:

| Requirement | `xtool install` (this runbook) | `xtool dev` (SwiftPM builds) |
| --- | --- | --- |
| `usbmuxd` to reach the phone | Yes | Yes |
| Apple ID login | Yes; a free Apple ID works | Yes |
| Swift 6.4 toolchain | No | Yes |
| `Xcode.xip`, unpacked into an iOS SDK by `xtool sdk` | No | Yes (Xcode 27) |
| FUSE 2, to run the AppImage | Yes, or extract it | Yes |

Login has two modes: **password**, which works with any Apple ID through the
same private Apple endpoints Xcode uses, and **API key**, which needs a paid
Apple Developer Program team.

### It can't build this app

`xtool dev` only builds SwiftPM packages. It stops with "Could not find
Package.swift in this directory" anywhere else, and it has no support for
`.xcodeproj`, `.xcworkspace` or CocoaPods. Its `generate-xcode-project`
command does the reverse and writes an Xcode project for a SwiftPM package.
This app's `ios/` folder is an Expo-generated CocoaPods workspace whose build
also runs Node for Metro bundling and compiles Hermes bytecode. The xtool
author has said it can sign React Native, Flutter and Kotlin Multiplatform apps
but not build them ([#28](https://github.com/xtool-org/xtool/issues/28)). He
plans Xcode project support
([#144](https://github.com/xtool-org/xtool/issues/144)), but 1.21.0 doesn't
have it. So a Mac in GitHub Actions compiles the app, and xtool only signs and
installs it.

## What's installed on this machine

| Item | Value |
| --- | --- |
| Version | xtool 1.21.0 (released 2026-10-05), x86_64 AppImage |
| File | `~/.local/opt/xtool/1.21.0/xtool-x86_64.AppImage` |
| Command | `~/.local/bin/xtool`, a symlink to the file above (already on `PATH`) |
| SHA-256 | `e2277e59bb2fda9b487cbc77ad080ea2b0370bb740ac0f02cc42fa28a272d3a5` |
| Runs through | FUSE 2 (`fuse2` 2.9.9 is installed, `/dev/fuse` is usable) |
| Already present | libimobiledevice 1.4.0: `idevice_id`, `ideviceinfo`, `idevicepair`, `idevicesyslog`, `idevicecrashreport`, `idevicedevmodectl` |
| Missing | `usbmuxd`, which needs `sudo` (step 1 below) |
| Not installed on purpose | Swift toolchain, `Xcode.xip`, the xtool Darwin SDK |

The checksum matches the digest GitHub lists for the release asset. That's the
only integrity check available. The release has no signature file, the AppImage
has no embedded signature (`xtool --appimage-signature` prints nothing), and
`gh attestation verify` finds no build provenance.

Check the install:

```sh
xtool --version     # xtool 1.21.0
xtool auth status   # Logged out (until step 4)
xtool sdk status    # Not installed (not needed for this runbook)
```

The commands xtool 1.21.0 offers are `setup`, `auth` (`login`, `logout`,
`status`), `sdk`, `new`, `dev` (`build`, `run`, `generate-xcode-project`,
`build-server`), `ds` (`teams`, `certificates`, `identifiers`, `devices`,
`profiles`, `anisette`), `devices`, `install`, `uninstall` and `launch`.
`install`, `uninstall`, `launch` and `devices` accept `--udid <udid>` and
`--usb`, `--network` or `--all`.

**Update xtool.** Each version gets its own directory. In bash, download the
new release and print both hashes:

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

Only if the two hashes match, switch the command over in the same shell:

```bash
chmod +x "$d/xtool-x86_64.AppImage"
ln -sfn "$d/xtool-x86_64.AppImage" ~/.local/bin/xtool
xtool --version
```

**Remove xtool.** Run `rm ~/.local/bin/xtool`, then delete `~/.local/opt/xtool`
and `~/.config/xtool`.

## One-time setup

### 1. Install usbmuxd

```sh
sudo pacman -S --needed usbmuxd
```

xtool and the `idevice*` tools reach the phone through the `usbmuxd` daemon. The
package installs a udev rule (`/usr/lib/udev/rules.d/39-usbmuxd.rules`) that
starts `usbmuxd.service` whenever an Apple device is plugged in. The unit is
static, so there's nothing to enable. If the phone was already connected
during the install, unplug it and plug it back in, or run
`sudo systemctl start usbmuxd`. libimobiledevice itself is already installed.

### 2. Pair the iPhone

1. Connect the iPhone by USB and unlock it.
2. Tap **Trust** on the "Trust This Computer?" prompt and enter the passcode.
3. Check the connection:

   ```sh
   idevice_id -l                    # prints the phone's UDID
   idevicepair validate             # SUCCESS: Validated pairing with device ...
   ideviceinfo -k ProductVersion    # iOS version, 16.4 or later is required
   xtool devices --no-wait          # <name> [usb]: <udid>
   ```

If `idevicepair validate` fails, run `idevicepair pair`, accept the prompt on
the phone, and validate again. usbmuxd keeps the pairing record in
`/var/lib/lockdown/<UDID>.plist`.

### 3. Turn on Developer Mode

iOS 16 and later only run development-signed apps with Developer Mode on.

```sh
idevicedevmodectl list      # shows whether it's enabled
idevicedevmodectl reveal    # makes the switch appear in Settings
```

On the iPhone, open Settings > Privacy & Security > Developer Mode and turn it
on. The phone restarts; confirm **Turn On** afterwards.

### 4. Sign in to Apple

```sh
xtool auth login --mode password
```

xtool asks for the Apple ID, the password (hidden), the two-factor code, and
then the team. A free Apple ID has one team, its Personal Team. Check the
result with `xtool auth status`. Run the login again when the token
expires; `xtool auth status` shows its expiry date.

- Don't pass `--password` on the command line, or the password ends up in
  shell history and the process list.
- Don't use `xtool setup` for this runbook. It does the same login and then
  asks for `Xcode.xip`, which `xtool install` doesn't need. If you started it,
  press Ctrl+C at the `Path to Xcode.xip:` prompt; the login is already saved.
- Password mode uses private Apple endpoints. The xtool docs suggest a separate
  Apple ID if you want to be cautious. The iPhone doesn't have to be signed in
  to the same Apple ID.
- The first password login downloads Apple Music for Android from Apple's CDN
  (`apps.mzstatic.com`) and extracts two libraries from it to generate the
  device data Apple's login expects. They're kept in `~/.config/xtool/Anisette`.
- The session token and the private key of the development certificate are
  saved unencrypted under `~/.config/xtool/data`, readable by other local users
  with the default umask. After the first login, run
  `chmod -R go-rwx ~/.config/xtool`. Keep the folder out of shared backups and
  synced folders. `xtool auth logout` deletes the token.

### 5. Configure the GitHub repository

The workflow compiles these public client values into the JavaScript bundle.
Set them once under Settings > Secrets and variables > Actions, or with `gh`
from `Application/`:

| Name | Kind | Required | Value |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Variable | Yes | Supabase project URL, as in `.env.local` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Secret | Yes | Supabase publishable key |
| `EXPO_PUBLIC_SENTRY_DSN` | Variable | No | Public Sentry DSN; unset disables reporting |
| `EXPO_PUBLIC_TRACK_PARTITIONS` | Variable | No | Defaults to `false`; see `.env.example` |

```sh
gh variable set EXPO_PUBLIC_SUPABASE_URL --body "https://<project-ref>.supabase.co"
gh secret set EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY    # paste the key at the prompt
gh variable set EXPO_PUBLIC_SENTRY_DSN --body "<dsn>"  # optional
```

The workflow stops before building if either Supabase value is missing. After
the build it also checks that the URL ended up in `main.jsbundle`.

GitHub only offers **Run workflow** for workflows on the default branch, and the
runner builds what's pushed, not your working tree. Commit and push
`.github/workflows/ios-unsigned-build.yml` to `main` along with the app changes
you want in the build. Prebuild fails if a plugin listed in `app.json` isn't in
the repository, so `plugins/` has to be pushed too.

## Build, sign and install

1. **Start the build** from the Actions tab (iOS unsigned build > Run workflow)
   or with:

   ```sh
   gh workflow run ios-unsigned-build.yml --ref main
   gh run watch
   ```

   The job runs `npm ci`, `npx expo prebuild --platform ios --clean` (which runs
   `pod install`), and a Release `xcodebuild` for `generic/platform=iOS` with
   `CODE_SIGNING_ALLOWED=NO`. It then zips `Payload/KineVaultTrack.app` into
   `KineVaultTrack-unsigned.ipa`. The job has a 60-minute limit. If it fails, an
   `xcodebuild-log` artifact holds the full build log.

2. **Download the `.ipa`:**

   ```sh
   gh run list --workflow ios-unsigned-build.yml --limit 3
   gh run download <run-id> -n KineVaultTrack-unsigned-ipa -D ~/Downloads/kinevault-ios
   ```

   GitHub deletes the artifact after 7 days. Keep the downloaded file, because
   [renewing the install](#renew-every-7-days) needs it.

3. **Connect the iPhone** by USB and unlock it.

4. **Sign and install:**

   ```sh
   xtool install ~/Downloads/kinevault-ios/KineVaultTrack-unsigned.ipa
   ```

   xtool adds the phone to your team, creates or reuses a development
   certificate, and registers the App ID `XTL-<id>.com.kinevault.track`. It
   then fetches a 7-day provisioning profile, writes the new bundle identifier
   into `Info.plist`, signs the app and its frameworks, and installs it. It
   ends with "Successfully installed!". With more than one device connected,
   it asks which one; `--udid <udid>` picks one directly.

5. **Trust the developer** on the first launch. iOS shows "Untrusted
   Developer". Open Settings > General > VPN & Device Management, select your
   Apple ID under Developer App, and tap **Trust**.

6. **Open the app** by tapping its icon. Don't rely on `xtool launch`, because
   it needs a mounted Developer Disk Image and xtool can't mount one on Linux.

To see the exact bundle identifier, run `xtool ds identifiers list`. To remove
the app, delete it on the phone or run
`xtool uninstall XTL-<id>.com.kinevault.track`.

### Renew every 7 days

A free team's provisioning profile expires after 7 days, and the app then
stops opening. Run the same `xtool install` command with the same `.ipa`.
You don't need a new build. The bundle identifier doesn't change, so the app's
local data stays.

### New app versions

Push the changes, run the workflow again, download the new `.ipa`, and install
it the same way. It replaces the installed copy and keeps its data.

### Day-to-day JavaScript work

This build embeds the JavaScript and never talks to Metro. For quick edits,
keep using Expo Go with `npm start` or `npm run start:lan` on this machine (see
the README's [iPhone connection](../README.md#iphone-connection) section). Use the xtool build to check what Expo
Go can't show: the real native app, the splash screen, notification
permissions, `kinevaulttrack://` links, and Release performance.

## Limits

- Free provisioning profiles expire after 7 days. Reinstall with
  `xtool install` before then.
- A device can have at most 3 apps from free teams installed at a time. Apps
  installed by Xcode, AltStore, SideStore or Sideloadly with a free Apple ID
  count too.
- A free team can register 10 App IDs per 7 days. xtool reuses the same App ID
  on every install of this app, so renewals don't use new ones.
- When xtool needs a new development certificate, it lists the ones it would
  revoke and asks first. Apps signed with a revoked certificate, such as a copy
  Xcode installed from a Mac with the same Apple ID, can stop opening until
  they're signed again. Answer no if that matters, and use a separate Apple ID
  for xtool.
- The unsigned build carries no entitlements, so xtool signs with only the App
  ID, the team, and `get-task-allow`. That's enough for this app.
  `KineVaultTrack.entitlements` is empty, with no push, iCloud or App Groups,
  and reminders are local notifications. Free teams can't use push or iCloud
  anyway.
- The installed app's bundle identifier is `XTL-<id>.com.kinevault.track`,
  not `com.kinevault.track`. The URL schemes `kinevaulttrack` and
  `com.kinevault.track` stay the same, so the Supabase redirect URLs in
  [iOS builds with Xcode](ios-xcode.md#supabase-redirect-urls) still work. A
  copy installed from Xcode is a separate app with separate data.
- Installs go over USB only. Linux `usbmuxd` 1.1.1 doesn't find devices over
  Wi-Fi, and xtool doesn't see devices from the `netmuxd` workaround
  ([#134](https://github.com/xtool-org/xtool/issues/134)).
- The workflow builds Release only. A Debug build would need a reachable Metro
  server, and this runbook doesn't cover it.

## What Linux can't do

- **No iOS Simulator.** It only runs on macOS. Test on the phone, in Expo Go,
  or in the web preview.
- **No Xcode debugging.** No breakpoints, LLDB, view debugger or Instruments.
  For logs and crashes, use:

  ```sh
  idevicesyslog -p KineVaultTrack    # live device log for the app
  mkdir -p ~/kinevault-crashes
  idevicecrashreport -e -k -f KineVaultTrack ~/kinevault-crashes   # copy crash reports
  ```

  JavaScript errors reach Sentry when `EXPO_PUBLIC_SENTRY_DSN` is set; see
  [iOS builds with Xcode](ios-xcode.md#sentry).
- **No local native builds.** Every native change, such as `app.json`,
  `plugins/` or a dependency with native code, needs a workflow run.

Fragile parts:

- Password login uses private Apple endpoints, and Apple can change them. When
  login breaks, update xtool first.
- xtool is mostly maintained by one person. If its signing stops working,
  [Sideloader](https://github.com/Dadoum/Sideloader) is another Linux tool that
  signs and installs an `.ipa` with a free Apple ID.
- GitHub retires Xcode versions from its runner images. When
  `/Applications/Xcode_26.6.app` disappears from `macos-26`, update
  `DEVELOPER_DIR` in the workflow. The installed list is in the
  [runner image readme](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md).
  Building with Xcode 27 (`xcode-27` label, currently a preview) depends on
  the scene life cycle plugin described in
  [iOS builds with Xcode](ios-xcode.md#scene-life-cycle).
- The repository is public. Anyone signed in to GitHub can download the
  workflow's artifacts while they exist. The only configuration in the `.ipa`
  is the public client values from step 5, and nobody can install it without
  signing it first.

## Other options considered

- **EAS Build.** Standard EAS iOS device builds need signing credentials. Its
  build code stops with "credentials must exist for non-simulator builds", and
  EAS internal distribution uses ad hoc or enterprise provisioning, which free
  Apple IDs can't create. Simulator builds (`"ios": { "simulator": true }`)
  need no Apple account, but the result only runs in the iOS Simulator. A
  custom build with `withoutCredentials` could reproduce the unsigned build,
  but the free plan has 15 iOS builds, a low-priority queue and a 45-minute
  timeout. GitHub-hosted runners cost nothing for this public repository.
- **xcross** builds Flutter and Compose Multiplatform apps on Linux. React
  Native support is only a feature request.
- **AltServer-Linux** hasn't had a release since 2022.
- **pymobiledevice3 with zsign** can install and sign, but zsign needs a
  certificate and provisioning profile that a free Apple ID only gets through a
  tool such as xtool, Xcode or Sideloader.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `xtool devices` waits forever, or `--no-wait` prints nothing | `usbmuxd` isn't installed or running. Do step 1, replug the phone, and check `idevice_id -l` and `systemctl status usbmuxd`. |
| "Please log in with \`xtool auth\` before running this command." | Run `xtool auth login --mode password`. |
| "Please unlock your device..." or a pairing prompt | Unlock the phone, tap **Trust**, and run the command again if it stops. |
| Error about Developer Mode | Do step 3, then run `xtool install` again. |
| "Untrusted Developer" when opening the app | Trust your Apple ID in Settings > General > VPN & Device Management. |
| Maximum number of apps or App IDs reached | Delete another free-signed app from the phone, or wait for the 7-day App ID window. |
| xtool lists certificates to revoke | Read the list. Say no if another Mac or tool depends on them (see [Limits](#limits)). |
| The app stopped opening after a week | The profile expired. Run `xtool install` with the same `.ipa`. |
| Two-factor or login errors | Run `xtool auth logout --reset-2fa`, then log in again. Update xtool if it keeps failing. |
| `fuse: memory allocation failed` or `squashfuse` usage text | An AppImage launcher integration is interfering ([#39](https://github.com/xtool-org/xtool/issues/39)), or FUSE 2 is missing. Remove AppImageLauncher, or extract the AppImage as shown below. |
| Workflow fails at "Check required configuration" | Set the variable and secret from step 5. |
| Workflow fails in `pod install` or `xcodebuild` | Download the `xcodebuild-log` artifact. See the troubleshooting section in [iOS builds with Xcode](ios-xcode.md#troubleshooting); most causes are the same. Rerun once for download errors. |
| "EXPO_PUBLIC_SUPABASE_URL is not in main.jsbundle" | The bundle phase didn't see the environment. Check the variable's value, then rerun. |
| Run workflow button missing, or `gh workflow run` says not found | The workflow file isn't on `main` yet. |

Extracting the AppImage removes the FUSE requirement:

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

- xtool repository and README: <https://github.com/xtool-org/xtool>
- xtool 1.21.0 release: <https://github.com/xtool-org/xtool/releases/tag/1.21.0>
- Linux installation guide: <https://xtool.sh/documentation/xtooldocs/installation-linux>
  (source: `Documentation/xtool.docc/Installation-Linux.md` in the repository)
- First app tutorial, including pairing, Developer Mode and trusting the
  developer: <https://xtool.sh/tutorials/xtooldocs/first-app>
- Source checked for this runbook (1.21.0, `main`):
  `Sources/XToolSupport/InstallCommand.swift`, `DevCommand.swift`,
  `AuthCommand.swift`, `SetupCommand.swift`,
  `Sources/XKit/Integration/IntegratedInstaller.swift`,
  `Sources/XKit/DeveloperServices/App IDs/DeveloperServicesAddAppOperation.swift`,
  `Sources/XKit/Utilities/ProvisioningIdentifiers.swift`,
  `Sources/XKit/Utilities/DirectoryProvider.swift`,
  `Sources/XKit/Installation/DDIMounter.swift`
- Author's announcement: <https://forums.swift.org/t/xtool-cross-platform-xcode-replacement-build-ios-apps-on-linux-and-more/79803>
- Building React Native and Flutter apps: <https://github.com/xtool-org/xtool/issues/28>
- Building Xcode projects: <https://github.com/xtool-org/xtool/issues/144>
- Network devices on Linux: <https://github.com/xtool-org/xtool/issues/134>
- AppImage FUSE errors on Arch: <https://github.com/xtool-org/xtool/issues/39>
- Arch `usbmuxd` package files: <https://archlinux.org/packages/extra/x86_64/usbmuxd/files/>
- GitHub macOS runner images: <https://github.com/actions/runner-images>
- EAS Build: <https://docs.expo.dev/eas/json/>, <https://docs.expo.dev/build/internal-distribution/>,
  <https://expo.dev/pricing>, and `packages/build-tools/src/ios/fastlane.ts` in
  <https://github.com/expo/eas-cli>

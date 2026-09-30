# KineVault Track

The React Native and Expo companion to KineVault, for iOS and Android with a web
preview. This repository lives inside `Application/`; the sibling `KineVault/`
studio is maintained separately.

## Current foundation

- Today, Food, Exercise, and Settings tabs through Expo Router.
- Geist typography, Lucide icons, and shared themed components from DESIGN.md.
- System, Light, and Dark appearance, saved locally on the device.
- English copy, metric units, safe-area layout, and scalable text.
- Empty states and a missing-route recovery screen.
- First-run onboarding with Kine, resumable local answers, and profile editing.
- Editable calorie estimates for losing, maintaining, or gaining weight.
  Users can skip estimation or set a target manually.
- Ages 16+. Automatic calorie estimates are for adults; ages 16–17 use a
  custom target agreed with a health professional, or leave it unset.
- Eleven distinct flat 2D Kine poses, quick page transitions, and an animated setup
  progress bar. System reduced-motion preferences are respected.
- Small transparent WebP mascot assets, native memory/disk caching, and
  background prefetching of upcoming poses.

Food and exercise logging, accounts, macro targets, database search, video playback,
and KineVault integration are not implemented in this phase.

## Run locally

Use Node.js 24 LTS and npm. Install the locked dependencies with `npm ci`.

```sh
npm start
```

Scan the QR code with the iPhone Camera or Expo Go on Android, using an SDK
57-compatible client. For LAN mode, phone and computer must share a network.
If the installed
Expo Go version does not support SDK 57, use a compatible client or development
build. No backend credentials are needed for this foundation.

```sh
npm run web       # Browser preview
npm run android   # Connected Android device or emulator
npm run ios       # iOS simulator, requires macOS and Xcode
```

The web preview uses the same screens and components; it does not replace testing
on native devices. No app-store build, application identifier, or EAS project is
configured yet.

### iPhone connection

For a timeout such as “This is taking much longer than it should”:

```sh
npx expo login
npm run start:tunnel
```

Sign into the same Expo account in Expo Go on the iPhone. Physical iOS devices
check the developer account ([Expo CLI authentication](https://docs.expo.dev/more/expo-cli/#authentication)).
Update Expo Go from the App Store if necessary; this app uses SDK 57.
Scan the new terminal QR with the Camera; pasting `exp://` into a browser search
does not open the app. The tunnel bypasses local Wi-Fi routing and firewall
restrictions. The tunnel address changes between sessions.

For local Wi-Fi, use `npm run start:lan` and allow Expo Go's Local Network access
in iOS Settings. Check whether the server is reachable by opening its printed
`http://<computer-IP>:8081/status` address in Safari. A response of
`packager-status:running` confirms connectivity from the phone.

Run `npm run doctor:connection` to inspect the advertised iOS bundle address,
runtime, available network addresses, and Expo sign-in status. Pass a different
port if necessary: `npm run doctor:connection -- 8082`.

The checked-in tunnel dependency makes the command usable after `npm ci`.
Internet access is needed for tunnel mode; app profile data still stays local.

If ngrok fails with `remote gone away` or `session closed`, use the Cloudflare
fallback. Install [cloudflared](https://developers.cloudflare.com/tunnel/downloads/),
then run `npm run start:cloudflare`. The launcher starts both servers, verifies the
public iOS manifest, and prints a secure `exps://` QR code. Keep the terminal open;
Ctrl+C stops both processes. The address is temporary and changes on each launch.
The QR is also saved at `.expo/connection-qr.svg`. You can pass another port with
`npm run start:cloudflare -- 8083` or set `CLOUDFLARED_BIN` to a custom binary path.

### Android emulator keyboard

If tapping a field shows no keyboard, boot the emulator and run:

```sh
npm run android:keyboard
```

This enables the on-screen keyboard alongside computer keyboard input and turns
off stylus handwriting on Android 14+ emulators. A virtual stylus can put Gboard
in handwriting mode and hide the keypad. Tap the field again after running the
command. These settings persist on the emulator; physical phones are untouched.
The command uses `adb` from your Android SDK or PATH.

Age and calorie fields accept whole numbers. Height and weight allow a decimal
point or comma. Invalid typed or pasted edits are rejected, and you can still
clear a field or leave a decimal separator while typing.

## Verify

```sh
npm run check
npx expo-doctor
npm run export:web
npx expo export --platform ios --platform android --output-dir dist-native
```

Tests cover appearance, profile record validation, draft resume, metric input,
mascot transparency/resolution/size budgets,
and calorie calculations. Formula assumptions and supported ranges are recorded
in [the onboarding design](docs/superpowers/specs/2026-09-30-kine-onboarding-design.md). The web export produces static routes in `dist/`.
GitHub Actions runs these checks and the browser regressions on pushes and pull requests.

For browser checks, install Chromium once with `npx playwright install chromium`.
Start the preview with `npm run web -- --port 8081`, then run `npm run test:browser`
in another terminal. Set `KINE_PREVIEW_URL` if the preview uses a different address.
These tests cover draft resume, calorie overrides, canceled edits, switching to
manual targets, age gating, teen setup, all eleven poses, responsive widths,
reduced motion, mascot prefetching, and retrying a failed save while editing the
review screen.

The dependency audit reports 15 moderate advisories in the Expo and tunnel
dependency tree, including URI decoding and Xcode build-tool dependencies.
There are no high or critical advisories in that audit. The proposed automatic
fixes downgrade Expo or Router to incompatible versions, so these require
upstream updates rather than `npm audit fix --force`.

## Structure

The standalone [mascot comparison](design/mascots.html) shows eight illustrated
directions for both products. Open it directly in a browser to compare and
shortlist concepts. It runs independently of the Expo app.

- `src/app/`: routes and navigation layouts.
- `src/components/ui.tsx`: shared text, panel, screen, destination, and empty state.
- `src/theme/`: palette, geometry, typography, and appearance persistence.
- `src/profile/`: validated answers, calorie estimation, storage, and recovery.
- `src/onboarding/`: Kine artwork, form controls, and question content.
- `assets/mascot/2d/`: optimized page poses, source artwork, and exact generation prompts.
- `scripts/optimize-mascot.mjs`: reproducible mascot compression; see the [artwork notes](assets/mascot/README.md).
- `src/components/motion.tsx`: reduced-motion preferences and setup transitions.
- `scripts/expo-connect.mjs`: Expo Go connection diagnostics.
- `DESIGN.md`: supplied KineVault design reference, preserved as shared authority.
- `PRODUCT.md`: confirmed product scope.

Future tracking features should use the existing theme and components and keep
their domain logic outside route files. Changes to shared design rules should be
coordinated with the KineVault studio.

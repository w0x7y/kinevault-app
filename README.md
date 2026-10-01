# KineVault Track

The React Native and Expo companion to KineVault, for iOS and Android with a web
preview. This repository lives inside `Application/`; the sibling `KineVault/`
studio is maintained separately.

## Current foundation

- Home, Food, Exercise, and Settings tabs through Expo Router.
- Compact header with profile placeholder and shared five-week day picker.
  The current week stays centered; Settings has no calendar.
  Dates use the device's local time zone. Selecting Today follows local day
  changes; a deliberately chosen other date stays selected until changed again.
- Daily layouts for nutrition, workouts, steps, water, and four meal sections.
  Kine uses the same even split and size beside Home macros, Food/Exercise
  action buttons, and the Settings title. Macro counts sit beside their labels.
  A full-width calorie count and progress bar sit above Home’s macro row.
  Workout details list completed exercises with sets, reps, and actual weight ranges.
  Records remain empty until logging is implemented; create/view buttons are
  disabled placeholders.
- Shared 12px screen margins, panel padding, and gaps across tabs and onboarding.
- Comfortaa typography, Font Awesome 6 icons, and shared themed components.
- System, Light, and Dark appearance, saved locally on the device.
- English copy, metric units, safe-area layout, and scalable text.
- Empty states and a missing-route recovery screen.
- First-run onboarding with Kine, resumable local answers, and profile editing.
  Welcome and goals precede the age confirmation.
- Editable calorie estimates for losing, maintaining, or gaining weight.
  Users can skip estimation or set a target manually.
- Editable carb, protein, and fat targets in grams. Automatic targets use
  50%/25%/25% of calories with 4/4/9 kcal per gram. Clear an override to follow
  the calorie target again; zero is an explicit override. Custom grams do not
  change the calorie target.
- Ages 16+. Automatic calorie estimates are for adults; ages 16–17 use a
  custom target agreed with a health professional, or leave it unset.
- Eleven distinct flat 2D Kine poses, quick page transitions, and an animated setup
  progress bar. System reduced-motion preferences are respected.
- Small transparent WebP mascot assets, native memory/disk caching, and
  background prefetching of upcoming poses.

Food and exercise logging, accounts, database search, video playback,
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

Age, calorie, and macro fields accept whole numbers. Height and weight allow a decimal
point or comma. Invalid typed or pasted edits are rejected, and you can still
clear a field or leave a decimal separator while typing.

## Verify

```sh
npm run check
npx expo-doctor
npm run export:web
npx expo export --platform ios --platform android --output-dir dist-native
```

Tests cover appearance, profile record validation, draft resume, staged profile
edits, save/retry ordering, metric input, mascot transparency/resolution/size
budgets, calorie-mode changes, and build-tool UUID buffer bounds and compatibility.
Controlled clock and wake fixtures verify Selected day rollover, deliberate date
selection, and lifecycle cancellation. Controlled storage verifies Profile recovery,
failed writes, reset ordering, and stale reads across restarts. Completed workout
tests keep totals, exercise rows, and load ranges consistent.
Connection checks use local HTTP fixtures for
manifest errors, bundle host rules, HTTPS links, startup retries, and shutdown. Formula assumptions and supported ranges are recorded
in [the onboarding design](docs/superpowers/specs/2026-09-30-kine-onboarding-design.md). The web export produces static routes in `dist/`.
GitHub Actions runs these checks and the browser regressions on pushes and pull requests.

For browser checks, install Chromium once with `npx playwright install chromium`.
Start the preview with `npm run web -- --port 8081`, then run `npm run test:browser`
in another terminal. Set `KINE_PREVIEW_URL` if the preview uses a different address.
These tests cover draft resume, calorie and macro overrides, canceled edits, switching to
manual targets, age gating, teen setup, onboarding poses, daily tab layouts,
shared calendar selection, responsive widths, Profile recovery and failed resets,
nonempty workout rendering and exercise filtering,
reduced motion, mascot prefetching, and retrying a failed save while editing the
review screen.

The October 1, 2026 final check passed TypeScript, including unused-code checks,
84 unit tests, 15 browser tests, Expo Doctor's 21 checks, the 11-route static web
export, and iOS/Android bundle exports. Browser checks cover 320, 390, and 1280px
widths in both themes. Native keyboard, gestures, safe areas, text scaling, and
screen-reader behavior still need testing on a native device or simulator.
See [the architecture contract](docs/superpowers/specs/2026-10-01-architecture-refactor-design.md)
for module ownership and lifecycle rules.

The dependency audit reports three moderate package entries for one advisory
in the Router chain:
`expo-router` → `query-string` → `decode-uri-component`. The decoder has a
[malformed-input denial-of-service advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
Its fixed version, 0.5.0, is ESM; the installed `query-string` 7 calls it through
CommonJS as a function. A decoder-only override would break URL parsing, and
newer `query-string` versions also change the export interface used by Router.
The current Expo linking parser uses `URL.searchParams`; no reachable use of the
vulnerable decoder was confirmed in this app. The dependency advisory remains
open. An isolated compatibility check of the fixed decoder under query-string 7
failed with `decodeComponent is not a function`.
This needs a compatible Router update or a separately validated dependency patch. Do not use
`npm audit fix --force`, which proposes an incompatible Router downgrade.
There are no high or critical findings in this audit.

Scoped overrides give the Xcode and Expo tunnel tools `uuid` 11.1.1, fixing
[UUID output-buffer validation](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
while retaining their CommonJS `v4()` calls. Tests check both consumers and Xcode
project identifier generation. Keep the overrides until upstream dependencies
include the fix.

## Structure

The standalone [mascot comparison](design/mascots.html) shows eight illustrated
directions for both products. Open it directly in a browser to compare and
shortlist concepts. It runs independently of the Expo app.

- `src/app/`: routes and navigation layouts.
- `src/components/ui.tsx`: shared text, panel, screen, and destination link.
- `src/theme/`: palette, geometry, typography, and appearance persistence.
- `src/profile/answers.ts`: profile vocabulary and editable numeric strings.
- `src/profile/calories.ts`: estimate/manual/teen policy, answer changes, and target source.
- `src/profile/macros.ts`: calculated gram targets and custom overrides.
- `src/calendar/selection.ts`: shared Selected day lifecycle with clock and wake adapters.
- `src/calendar/`: local date arithmetic, centered week grid, and React/platform wiring.
- `src/daily/workout.ts`: one interpretation of completed sets for totals and exercise rows.
- `src/daily/`: daily record types, nutrition summaries, and dashboard widgets.
- `src/profile/model.ts`: stored document parsing and legacy age recovery.
- `src/profile/persistence.ts`: storage lifecycle, durable saves, reset, and recovery.
- `src/profile/provider.tsx`: React subscription and AsyncStorage adapter.
- `src/onboarding/flow.ts`: setup transitions, validation, staged edits, and save ordering.
- `src/onboarding/`: Kine artwork, form controls, and question content.
- `assets/mascot/2d/`: optimized page poses, source artwork, and exact generation prompts.
- `scripts/optimize-mascot.mjs`: reproducible mascot compression; see the [artwork notes](assets/mascot/README.md).
- `src/components/motion.tsx`: reduced-motion preferences and setup transitions.
- `scripts/expo-connection.ts`: shared manifest checks and cancelable readiness; Node 24+ runs it directly.
- `scripts/expo-connect.mjs`: Expo Go connection diagnostics.
- `CONTEXT.md`: profile and onboarding domain vocabulary.
- `DESIGN.md`: supplied KineVault design reference, preserved as shared authority.
- `PRODUCT.md`: confirmed product scope.

Future tracking features should use the existing theme and components and keep
their domain logic outside route files. Changes to shared design rules should be
coordinated with the KineVault studio.

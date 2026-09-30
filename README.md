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

Food and exercise logging, accounts, macro targets, database search, video playback,
and KineVault integration are not implemented in this phase.

## Run locally

Use Node.js 24 LTS and npm. Install the locked dependencies with `npm ci`.

```sh
npm start
```

Open the QR code with an SDK 57-compatible Expo Go client on your phone.
The phone and development machine must be on the same network. If the installed
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

## Verify

```sh
npm run check
npx expo-doctor
npm run export:web
npx expo export --platform ios --platform android --output-dir dist-native
```

Tests cover appearance, profile record validation, draft resume, metric input,
and calorie calculations. Formula assumptions and supported ranges are recorded
in [the onboarding design](docs/superpowers/specs/2026-09-30-kine-onboarding-design.md). The web export produces static routes in `dist/`.
GitHub Actions runs these checks and the browser regressions on pushes and pull requests.

For browser checks, install Chromium once with `npx playwright install chromium`.
Start the preview with `npm run web -- --port 8081`, then run `npm run test:browser`
in another terminal. Set `KINE_PREVIEW_URL` if the preview uses a different address.
These tests cover draft resume, calorie overrides, canceled edits, switching to
manual targets, and retrying a failed save while editing the review screen.

The initial dependency audit reports 14 moderate advisories in the Expo
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
- `assets/mascot/`: the selected Kine illustration and its provenance.
- `DESIGN.md`: supplied KineVault design reference, preserved as shared authority.
- `PRODUCT.md`: confirmed product scope.

Future tracking features should use the existing theme and components and keep
their domain logic outside route files. Changes to shared design rules should be
coordinated with the KineVault studio.

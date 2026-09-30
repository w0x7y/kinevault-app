# KineVault Track foundation implementation plan

**Goal:** Deliver the approved foundation and navigation for iOS, Android, and web.

**Architecture:** Expo Router owns four tab routes. A theme provider loads the
appearance preference before revealing the app and follows OS appearance in System
mode. Shared text, panel, screen, and action components consume semantic tokens.

**Tech stack:** Expo SDK 57, React Native, TypeScript, Expo Router, Geist,
Lucide, and AsyncStorage.

**Spec:** PRODUCT.md and the supplied DESIGN.md.

## Constraints

- App name: KineVault Track. Language: English. Units: metric.
- Only Application/ belongs to this repository.
- Do not implement logging, accounts, or sync in this phase.
- Use supplied light/dark colors, 14px controls, and 18px panels.
- Support safe areas, scalable text, and labeled targets at least 48 units tall.

## Tasks

- [x] Configure the stable Expo template with Router and strict TypeScript.
      Remove sample screens and unused dependencies. Add typecheck and web export commands.
- [x] Write preference tests before implementation: missing or invalid stored
      values fall back to System; explicit choices override OS appearance; System
      follows OS changes. Run with `npm test`, observe failure, then implement.
- [x] Build semantic theme objects and a provider. Load bundled Geist and saved
      appearance before dismissing the splash screen. Show retryable storage errors
      and preserve the current preference if saving fails.
- [x] Build shared screen, text, panel, and navigation actions. Add Today, Food,
      Exercise, and Settings routes. Empty destinations explain that tracking is not
      available yet. Today links to the two tracker destinations.
- [x] Build Settings appearance controls and show English and metric preferences.
- [x] Run `npm run check`, `npx expo-doctor`, and `npm run export:web`.
      Export iOS and Android bundles, inspect web at desktop and phone widths, test
      navigation and persistent appearance, and document native-device test limits.
- [x] Commit and push the verified foundation. Verify the public repository,
      upstream branch, and collaborator invitation.

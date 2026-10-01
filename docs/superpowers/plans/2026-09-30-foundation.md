# KineVault Track foundation implementation plan

**Goal:** Deliver the approved foundation and navigation for iOS, Android, and web.

**Status:** Original foundation delivered September 30. October 1 dashboard,
calendar, typography, onboarding, and spacing refinements are implemented and
verified. The completed checklist below includes those refinements; current
product scope is recorded in [PRODUCT.md](../../../PRODUCT.md).

**Architecture:** Expo Router owns four tab routes. A theme provider loads the
appearance preference before revealing the app and follows OS appearance in System
mode. Shared text, panel, screen, and action components consume semantic tokens.
Profile parsing and target policy are pure modules; `src/profile/persistence.ts`
owns durable local storage and failure/lifecycle state, while `provider.tsx`
adapts it to React and AsyncStorage. `src/calendar/selection.ts` owns shared day
selection with injected clock and wake events; its provider owns platform wiring.

**Tech stack:** Expo SDK 57, React Native, TypeScript, Expo Router, Comfortaa,
Font Awesome 6, and AsyncStorage.

**Spec:** [PRODUCT.md](../../../PRODUCT.md) and the supplied
[DESIGN.md](../../../DESIGN.md). Run and verification instructions are in
[README.md](../../../README.md).

## Constraints

- App name: KineVault Track. Language: English. Units: metric.
- Only Application/ belongs to this repository.
- Do not implement logging, accounts, or sync in this phase.
- Use supplied light/dark colors, 14px control radii, and 18px panel radii.
  Use 12px screen margins, panel padding, and gaps; compact local label spacing
  and accessible touch targets remain intentional exceptions.
- Support safe areas, scalable text, labeled inputs, and accessible actions.

## Tasks

- [x] Configure the stable Expo template with Router and strict TypeScript.
      Remove sample screens and unused dependencies. Add typecheck and web export commands.
- [x] Write preference tests before implementation: missing or invalid stored
      values fall back to System; explicit choices override OS appearance; System
      follows OS changes. Run with `npm test`, observe failure, then implement.
- [x] Build semantic theme objects and a provider. Load bundled Comfortaa and saved
      appearance before dismissing the splash screen. Show retryable storage errors
      and preserve the current preference if saving fails.
- [x] Build shared screen, text, panel, and navigation actions. Add Home (formerly
      Today), Food, Exercise, and Settings routes. Home shows calorie and macro
      progress, workout totals, steps, and water. Food groups Breakfast, Lunch,
      Dinner, and Snacks / Drinks; Exercise shows detailed workout information.
      Records stay empty until logging is implemented, without fabricated totals
      or repetitive empty captions. Create/view actions are disabled placeholders.
- [x] Add a compact header without the app name, with a left calendar chevron,
      selected date, and right profile-picture placeholder. Share a seven-column,
      five-week calendar across Home, Food, and Exercise; center the current week
      and exclude Settings. Preserve explicit selections across midnight and wake.
- [x] Use the same 50/50 content/Kine row on all tabs, excluding the 12px gap:
      macros left on Home, action buttons left on Food/Exercise, title left on
      Settings. Mascot width equals its column width at every viewport size.
- [x] Build Settings appearance controls and show English and metric preferences.
- [x] Add Kine-guided setup: welcome → goal → age → name → body → activity →
      calories → review, age 16+ before personal details, adult-only estimates,
      manual/unset teen targets, and resumable/staged profile editing. Add editable
      50%/25%/25% macro gram targets; zero is valid and clearing resumes automatic
      targets. Legacy profiles missing age return to the age question.
- [x] Run `npm run check`, `npx expo-doctor`, and `npm run export:web`.
      Export iOS and Android bundles, inspect web at desktop and phone widths, test
      navigation and persistent appearance, and document native-device test limits.
- [x] Commit and push the verified foundation. Verify the public repository,
      upstream branch, and collaborator invitation.

## October 1 verification

TypeScript checks, all 84 unit tests, and all 15 Chromium regressions pass.
Expo Doctor reports 21/21 checks. Web export produces 11 static routes; iOS and
Android bundle exports succeed. Independent reviews covered each implementation
task and final cleanup, including persistence failure/race behavior and calendar
lifecycle intent. No physical device or native simulator was available: native
keyboard, gestures, safe areas, screen readers, and system text scaling still
require device testing. The earlier foundation publication above is historical.

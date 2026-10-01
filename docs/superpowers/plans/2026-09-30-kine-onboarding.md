# Kine onboarding implementation plan

**Status:** September 30 onboarding delivery completed; October 1 refinements
implemented, verified, and independently reviewed.
**Goal:** A welcoming, resumable first-run profile flow guided by Kine.
**Architecture:** Pure profile parsing, calorie/macro policy, a durable persistence
store, React/platform adapters, and shared onboarding UI. Route guards use the
persisted completion state. `flow.ts` owns transitions and staged edits;
`persistence.ts` owns loading, writes, reset, and lifecycle ordering;
`provider.tsx` only wires React and AsyncStorage.
**Stack:** Existing Expo, React Native, TypeScript, and AsyncStorage.
**Spec:** [Kine onboarding design](../specs/2026-09-30-kine-onboarding-design.md).
Current scope and operations: [PRODUCT.md](../../../PRODUCT.md),
[README.md](../../../README.md).

- [x] Write failing tests for optional metrics, invalid records, draft resume,
      and saved profile round trips in `tests/profile.test.ts`.
- [x] Implement `src/profile/model.ts`, `persistence.ts`, and `provider.tsx`.
      Use a version-1 draft/completed document and a load error recovery state.
- [x] Add Kine to `assets/mascot/`, preserving source provenance.
- [x] Build shared buttons, fields, and radio options in
      `src/onboarding/controls.tsx`, and screen content in `steps.tsx`.
- [x] Implement `src/app/onboarding.tsx`; persist transitions, finish, and skip.
      Reuse it for edits without replacing saved data until final save.
- [x] Wire the provider into the root and guard the tabs. Add profile answers
      and an edit destination to Settings. Update product and run documentation.
- [x] Run type checks, tests, web and native exports. Verify the real flow in
      the browser at desktop and phone widths, including error recovery.
- [x] Review the final source and screenshots; resolve discovered regressions.
- [x] Commit and push the original September 30 onboarding delivery.

## October 1 refinements completed

- [x] Order screens welcome → goal → age → name → body → activity → calories →
      review. Require age 16–100 before personal details; move Set up later to age.
      Keep adult-only automatic estimates and manual/unset targets for ages 16–17.
- [x] Add 50%/25%/25% carb/protein/fat targets using 4/4/9 kcal per gram,
      rounded to whole grams. Permit independent editable gram overrides and
      zero; clearing an override restores automatic calculation.
- [x] Preserve version-1 records without macro fields. Return legacy completed
      profiles missing a supported age to the age question without discarding answers.
- [x] Use Comfortaa and Font Awesome 6; derive setup progress from the step list.
      Apply shared 12px margins, panel padding, and gaps.
- [x] Show saved targets on Home's full-width calorie progress bar and macro
      panel beside Kine. Keep daily records empty pending logging. Use the same
      equal-width Kine split on all four tabs.
- [x] Add a shared selected-day calendar: seven weekday columns, five weeks,
      current week centered; Home, Food, and Exercise share selection, Settings
      excludes the calendar. Preserve deliberate dates across midnight and wake.
- [x] Make persistence methods stable, publish only after durable writes, prevent
      overlapping writes, retain saved state on failure, and reject stale reads
      and callbacks across lifecycle restarts. Keep appearance storage independent.
- [x] Independently review implementation and final cleanup. Remove obsolete
      calendar rollover code while retaining controller lifecycle coverage.
- [x] Verify TypeScript, 84 unit tests, 15 browser regressions, Expo Doctor 21/21,
      11 web routes, and successful iOS/Android bundle exports. Native-device
      behavior remains unverified; exports do not replace device testing.

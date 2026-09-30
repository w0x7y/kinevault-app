# Kine onboarding implementation plan

**Goal:** Add a brief first-run profile flow guided by Kine.
**Architecture:** Pure profile parsing and validation, a local-storage provider,
and shared onboarding UI. Route guards use the persisted completion state.
**Stack:** Existing Expo, React Native, TypeScript, and AsyncStorage.
**Spec:** `docs/superpowers/specs/2026-09-30-kine-onboarding-design.md`.

- [x] Write failing tests for optional metrics, invalid records, draft resume,
      and saved profile round trips in `tests/profile.test.ts`.
- [x] Implement `src/profile/model.ts` and `src/profile/provider.tsx`.
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
- [x] Review the final source and screenshots; resolve the two browser regressions.
- [x] Commit and push the verified implementation.

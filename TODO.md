# TODO

This file is the single source of truth for project status. PRODUCT.md, README.md
and docs/ describe behavior and link here instead of repeating status.

## Food & water

- [x] Integrate drink logging with water tracking.
- [x] Verify barcode scanning and drink/water logging on physical iOS and Android devices.

## Steps

- [x] Count phone steps on Home (Core Motion on iOS, Health Connect on Android) and log missed steps by hand. Logged steps stay on the device.
- [ ] Verify phone steps on a physical iPhone and Android phone: the permission prompts, denied and re-enabled access, Health Connect install on Android 8–13, the count for today and earlier days (iOS keeps 7 days), and Logged steps adding to it.
- [ ] Sync Logged steps across devices. The hosted `track_documents` table only accepts its listed document keys, so `kinevault-track.steps-log.v1` needs a reviewed migration before it can join the Account tracking document registry.
- [ ] Include Logged steps in the account JSON export.
- [ ] Declare Health Connect step access in the Play Console before any Google Play release.

## Exercise

- [x] Build strength/bodyweight exercise and reusable workout creation, search, editing, and deletion.
- [x] Log saved workouts by day with planned set counts, reps, optional kg, and independent left/right measurements.
- [x] Restore the active workout, timer, and saved draft fields after reopening; retain failed edits for retry.
- [x] Share completed-workout totals with Home and skip untouched blank sets.
- [x] Complete workout-edit/template architecture refactors, independent reviews, and automated regression checks.
- [x] Verify a full workout on a physical iPhone: Start, set entry, exercise scrolling, keyboard, background/reopen, End, and completed editing.
- [x] Open the live workout as a full page with its timer centered in the top bar, show the timer in the app header while it runs, and show Kine working out on the Exercise tab in place of the day's cards.
- [ ] Check the live workout page on a physical iPhone and Android phone: the page sheet and back gesture, the header timer at narrow widths, and Link demo returning to the page.
- [ ] Add timed exercises and cardio with duration/distance in a future phase.

## Profile & integrations

- [x] Build the Personal journal Profile with shared avatar, activity streaks, workout graphs, editable goals, and local progress-photo carousel.
- [x] Shared Supabase accounts with email/password sign-in and versioned cloud document sync (PR #3).
- [ ] Verify the new Profile camera/library, photo reopening, carousel scrolling, and accessibility on a physical iPhone. Android emulator photo flows and larger text are verified.
- [x] Integrate KineVault studio exercise videos: linked exercises play demos in workouts, templates and the exercise form, with search thumbnails. See docs/exercise-demos.md.
- [x] Publish the first KineVault demos to the hosted project: 10 demos on 2026-10-14 (the migration was applied on 2026-10-13). Linking and playback were checked on a phone in Expo Go.
- [ ] Re-check demo playback, fullscreen, offline replay and Android rounded video corners in native builds on an iPhone and an Android device before release.
- [x] Build apps to install directly: a signed release `.apk` (`Android release build` workflow, docs/android-apk.md) and an unsigned `.ipa` signed with xtool (`iOS unsigned build` workflow, docs/ios-linux-xtool.md). Both use `com.kinevault.track`.
- [ ] Configure store builds when ready to release: a Play Console app bundle with increasing version codes, and App Store builds, which need a paid Apple Developer Program team.
- [ ] Activate production email delivery and web hosting: Resend SMTP, a verified sender domain, and the Vercel production origin. See docs/supabase-setup.md.

## Quality & security

- [x] Verify the original native keyboard, gestures, safe areas, text scaling, and screen readers.
- [ ] Verify the new offline banner, reconnect sync and crash Reload on native devices before release.
- [ ] Check the October 2026 redesign on a physical iPhone and Android phone: Comfortaa and Manrope rendering, the floating tab bar and safe areas, sheet pages (an iOS page sheet), the live workout timer, the keyboard inside sheets, animations, and reduced motion. So far it has run only in browser tests.
- [x] Resolve the Router decoder advisory (decode-uri-component 0.5.0 override plus query-string adapter patch).
- [x] Resolve the http-cache-semantics shared-cache advisory with a local patch; 4.3.0 alone still reproduces the flaw.
- [ ] Adopt a compatible Expo/node-forge signature-verification fix when available.
- [ ] Adopt a verified compatible Braces nested-pattern denial-of-service fix when available.
- [ ] Enable Supabase leaked-password protection. Requires a Pro plan; the apply command returned HTTP 402. Billing decision.
- [ ] Track the Expo SDK 58 upgrade. It removes the query-string dependency, which retires one local patch. Both patches must be re-validated on every SDK bump.

## Review findings, October 7, 2026

### Placeholder UI shipped as real features

- [x] Represent steps as unavailable and show Not connected until a step source exists.
- [x] Mark Friends, Messages, KineVault, Support and Feedback Upcoming in the menu and disable them accessibly; remove obsolete coming-soon panels.
- [x] Identify English and metric as supported app formats in Settings; selectors remain future work.
- [x] Remove fake exercise video tiles and use one neutral upcoming-studio caption; playback waits on integration.

### Engineering hygiene

- [x] Add SDK-compatible ESLint and Prettier, format source/tests/scripts, and run lint/format verification from `npm run check`.
- [x] Add root crash recovery with accessible Reload, private fallback text, and rendered recovery/escalation regression coverage.
- [x] Add optional Sentry JavaScript reporting with strict health/auth-data scrubbing. See docs/resilience.md.
- [x] Create `idan-gilboa/kinevault-track`, configure the local public DSN, and verify a real sanitized app crash in Sentry, including suppression of inferred IP/location. See docs/sentry-verification.md.
- [ ] Verify reporting from a deployed staging/native build before release. Native crash reporting and source-map uploads remain separate setup work.
- [x] Detect confirmed offline operation with NetInfo, display offline feedback, and retry pending account sync automatically on reconnect.
- [x] Split checks, exports, and browser verification into CI jobs. Browser reuses the exported web artifact and runs alongside unit checks.
- [x] Keep current status here; README.md and PRODUCT.md describe behavior and link to this file. Dated reports retain historical evidence.

### Data and storage

- [x] Bound local food/workout history writes by calendar month with lossless v1 migration and failure-atomic manifests.
- [x] Implement monthly cloud fragments with atomic revision checks, incremental reads, ownership policies, and legacy-client guards. Migration and SQL execution tests are in the repository.
- [x] Validate history SQL, ownership/security policies, deletion cascades and seven concurrent advisory-lock races on isolated local PostgreSQL. See docs/history-migration-rollout.md.
- [ ] Validate against a separate hosted staging project, coordinate the minimum supported client version, apply the reviewed migration, then enable `EXPO_PUBLIC_TRACK_PARTITIONS=true`. Remote rollout remains disabled by user choice; the existing shared project is not staging.
- [ ] Evaluate paged in-memory history and finer conflict handling when needed. Providers still reconstruct the full logical history and preserve category-level conflicts.
- [x] Record local storage and encryption decision with a proposed privacy-policy disclosure in docs/privacy.md. Retain account-scoped unencrypted offline tracking; native tokens use SecureStore and web tokens use browser storage.
- [x] Implement account JSON export with local/cloud versions and photo contents, plus password-confirmed account deletion and owner-scoped local cleanup. See docs/account-management.md.
- [ ] Deploy and validate the account-deletion endpoint using a disposable account in an isolated environment; remote deployment remains disabled. Verify native sharing and deletion cleanup on physical devices before store release.

### Product decisions

- [x] Record the language decision: keep the interface English and metric for now. Hebrew source product names remain valid food data. See docs/language-and-units.md.
- [ ] Add a translated Hebrew interface with RTL when scheduled, including native calendar, charts, numeric input, mixed-language food names, and screen-reader verification.

## Architecture findings, October 8, 2026

- [x] Concentrate Profile media inventory, reservation, import rollback and retirement policy; keep Account namespaces and deletion freeze/drain ownership.
- [x] Own complete Account management attempts outside Settings rendering, with caller-scoped failure feedback and Account-owned confirmed deletion.
- [x] Own body-weight draft validation, replacement guidance and save/delete lifecycle through a directly tested edit interface.

## Latest verification, October 17, 2026

- After the final review fixes, lint, formatting, TypeScript and all 1160 unit and script tests passed. In the full browser run, 206 passed and the optional screenshot case was skipped; one profile-menu test failed on a change that was then reverted, and that file passes 7 of 7. See docs/architecture.md.
- In the October 16 architecture pass, lint, formatting, TypeScript and all 1158 unit and script tests passed; 207 browser tests passed with one optional screenshot case skipped. See docs/architecture.md and docs/redesign-2026-10.md.
- No native export or physical-device check is recorded for the redesign.

## Verification, October 8, 2026

- Dependencies installed with SDK-compatible `expo-sharing`; both dependency security patches remain applied.
- `npm run check` passed after the architecture and final-review fixes: lint, formatting, TypeScript, and all 874 unit/script tests, including local SQL/RLS execution.
- Full browser regression suite passed against the rebuilt web app and Metro fixtures: 166 passed, one optional visual test skipped, zero failures.
- Expo Doctor passed all 21 checks; web, iOS, and Android exports completed.
- Deno checked the deletion function entry; isolated PostgreSQL 18.6 passed ownership/security SQL, all seven observed concurrent advisory-lock races, and Auth-user deletion cascades.
- Sentry delivered a real app render crash; both outbound and stored-event audits confirmed the fresh event excludes raw messages, personal data, local paths and inferred location. See docs/sentry-verification.md.
- Independent architecture follow-up reviews found no remaining material issues. The final review passed 122 focused Account/Auth/SDK/weight tests; all 21 management-attempt tests passed in the final full run. See docs/final-check-2026-10-08-architecture.md for scope, fixes, dependency alerts and verification limits.
- Remote Supabase rollout/deletion deployment, deployed staging reporting, and physical-device verification remain pending. The existing shared project was not changed.

## Feature ideas

Ranked by how much they build on existing code:

1. [x] Body weight log with dated add/edit/delete, durable retry, accessible trend chart, and account export/sync. Profile goals remain independently editable.
2. [x] Previous reps and weights as hints in blank set fields, from the latest completed workout with that exercise.
3. [ ] Rest timer and workout duplication, on top of the active-workout timer and template draft machinery.
4. [ ] Timed and cardio exercises. Extend the set model's `kind` discriminator.
5. [ ] Recently logged and favorite foods above search results. Search already ranks foods the user has logged first.
6. [ ] Copy yesterday's meals to the selected day.
7. [ ] Steps via HealthKit and Health Connect, making the Home tile honest.
8. [x] Reminders for weigh-ins, water, workouts, food logging, progress photos and custom notes, using local notifications.
9. [ ] Weekly nutrition summary in Profile, reusing the workout chart components.
10. [x] Data export and account deletion implementation (deployment/device release checks listed above).
11. [ ] Imperial units and language selection as real preferences beyond the supported English/metric formats.
12. [x] Exercise videos from the KineVault studio.

# TODO

This file is the single source of truth for project status. PRODUCT.md, README.md
and docs/ describe behavior and link here instead of repeating status.

## Food & water

- [x] Integrate drink logging with water tracking.
- [x] Verify barcode scanning and drink/water logging on physical iOS and Android devices.

## Exercise

- [x] Build strength/bodyweight exercise and reusable workout creation, search, editing, and deletion.
- [x] Log saved workouts by day with planned set counts, reps, optional kg, and independent left/right measurements.
- [x] Restore the active workout, timer, and saved draft fields after reopening; retain failed edits for retry.
- [x] Share completed-workout totals with Home and skip untouched blank sets.
- [x] Complete workout-edit/template architecture refactors, independent reviews, and automated regression checks.
- [x] Verify a full workout on a physical iPhone: Start, set entry, exercise scrolling, keyboard, background/reopen, End, and completed editing.
- [ ] Add timed exercises and cardio with duration/distance in a future phase.

## Profile & integrations

- [x] Build the Personal journal Profile with shared avatar, activity streaks, workout graphs, editable goals, and local progress-photo carousel.
- [x] Shared Supabase accounts with email/password sign-in and versioned cloud document sync (PR #3).
- [ ] Verify the new Profile camera/library, photo reopening, carousel scrolling, and accessibility on a physical iPhone. Android emulator photo flows and larger text are verified.
- [ ] Integrate KineVault studio exercise videos. Playback in exercise search and the session editor waits on this.
- [ ] Configure app identifiers and store builds when ready to release: `eas.json`, iOS bundle identifier, Android package name.
- [ ] Activate production email delivery and web hosting: Resend SMTP, a verified sender domain, and the Vercel production origin. See docs/supabase-setup.md.

## Quality & security

- [x] Verify the original native keyboard, gestures, safe areas, text scaling, and screen readers.
- [ ] Verify the new offline banner, reconnect sync and crash Reload on native devices before release.
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

## Latest verification, October 8, 2026

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
2. [ ] Previous reps and weights beside each set, from historical sessions already in the exercise document.
3. [ ] Rest timer and workout duplication, on top of the active-workout timer and template draft machinery.
4. [ ] Timed and cardio exercises. Extend the set model's `kind` discriminator.
5. [ ] Recently logged and favourite foods above search results.
6. [ ] Copy yesterday's meals to the selected day.
7. [ ] Steps via HealthKit and Health Connect, making the Home tile honest.
8. [ ] Daily reminders for logging and water, using local notifications.
9. [ ] Weekly nutrition summary in Profile, reusing the workout chart components.
10. [x] Data export and account deletion implementation (deployment/device release checks listed above).
11. [ ] Imperial units and language selection as real preferences beyond the supported English/metric formats.
12. [ ] Exercise videos from the KineVault studio.

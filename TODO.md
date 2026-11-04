# TODO

This file is the single source of truth for project status. PRODUCT.md, README.md and docs/ describe behavior and link here instead of repeating status.

## Food & water

- [x] Count drinks toward water.
- [x] Verify barcode scanning and drink/water logging on physical iOS and Android devices.
- [x] Log a solid food by Weight or by Servings (saved as grams).

## Steps

- [x] Count phone steps on Home (Core Motion on iOS, Health Connect on Android) and log missed steps by hand. Phone steps stay on the device.
- [x] Verify phone steps on an iPhone and an Android phone: permission prompts, denied and re-enabled access, Health Connect install on Android 8–13, today's and earlier counts (iOS keeps 7 days), and Logged steps adding on (2026-11-04).
- [x] Sync Logged steps as an Account tracking document, with migration `20261029120000_track_documents_steps_log.sql`.
- [x] Apply migration `20261029120000` to the hosted project (2026-10-29, verified).
- [ ] Update every device on an account to a build from 2026-10-29 or later before logging steps there. Older builds fail every cloud download once the account holds a steps row (docs/supabase-setup.md).
- [x] Include Logged steps in the account JSON export.
- [ ] Before any Google Play release, declare Health Connect step access in the Play Console and add a privacy policy page for its permission screen. The link currently just opens the app.

## Exercise

- [x] Build strength and bodyweight exercises and saved workouts: create, search, edit and delete.
- [x] Log saved workouts by day with planned sets, reps, optional kg and separate left/right values.
- [x] Restore the active workout, timer and draft fields after reopening. Keep failed edits for retry.
- [x] Share completed-workout totals with Home and skip untouched blank sets.
- [x] Finish the workout edit and template refactors, independent reviews and regression tests.
- [x] Verify a full workout on a physical iPhone: Start, set entry, exercise scrolling, keyboard, background/reopen, End and completed editing.
- [x] Open the live workout as a full page with a centered timer, show the timer in the app header while it runs, and show Kine working out on the Exercise tab.
- [x] Check the live workout page on an iPhone and an Android phone: page sheet and back gesture, header timer at narrow widths, pinned footer with the keyboard open, edit mode at 320pt, tapping a set number to fill last workout's values, and a countdown buzzing in the background (2026-11-04).
- [x] Add Alternating (reps per side) and Timed (countdown or stopwatch) tracking modes.
- [x] Remove a set from a live workout (that workout only, never its template) and record optional RIR.
- [x] Live workout controls: Discard at the top right, Back/Next/End workout pinned at the bottom (Back/Next/Save in the saved-workout editor), L1/R1 set badges, a ⋯ menu to add or remove the last set, and set numbers that fill last workout's values.
- [x] Add the Rest timer, Personal records and Duplicate in Saved workouts. None adds a document field or value, so older builds still load and re-save these workouts.
- [ ] Check the Rest timer on an iPhone and an Android phone: the buzz with the workout page away and with the app in the background, the −/+ row at 320pt, and the length kept after a restart. Only unit and browser tests so far.
- [ ] Update every installed build before using Alternating, Timed or RIR. Older builds stop loading workouts with the new modes and drop RIR when they re-save a workout.
- [ ] Add cardio with duration and distance in a future phase.

## Profile & integrations

- [x] Build the Personal journal Profile: avatar, streaks, workout graphs, editable goals and a local progress-photo carousel.
- [x] Shared Supabase accounts with email/password sign-in and versioned cloud sync (PR #3).
- [x] Verify Profile camera and library, photo reopening, carousel scrolling and accessibility on an iPhone and an Android phone (2026-11-04). Android emulator photo flows and larger text were verified earlier.
- [x] Show KineVault exercise videos in workouts, templates and the exercise form, with search thumbnails (docs/exercise-demos.md).
- [x] Publish the first 10 KineVault demos to the hosted project on 2026-10-14 (migration applied 2026-10-13). Linking and playback checked on a phone in Expo Go.
- [x] Re-check demo playback, fullscreen, offline replay and Android rounded video corners in native builds on an iPhone and an Android phone (2026-11-04).
- [x] Build installable apps: a signed release `.apk` (`Android release build` workflow, docs/android-apk.md) and an unsigned `.ipa` signed with xtool (`iOS unsigned build` workflow, docs/ios-linux-xtool.md). Both use `com.kinevault.track`.
- [ ] Set up store builds when ready to release: a Play Console app bundle with increasing version codes, and App Store builds, which need a paid Apple Developer Program team.
- [ ] Turn on production email and web hosting: Resend SMTP, a verified sender domain and the Vercel production origin. Gmail SMTP sends account emails until then (docs/supabase-setup.md).
- [ ] Publish the Google sign-in consent screen without buying a domain: deploy the web app to a free `*.vercel.app` address with a `/privacy` page, add its home page and privacy policy links on the Google Auth Platform Branding page, add the address as an authorized domain, then click Publish app. Until then only listed test users can use Google sign-in (100 over the project's lifetime).
- [x] Make new Android and iOS builds (`expo-web-browser` is a new native module) and check Continue with Google, Resend email and the email callback on an iPhone and an Android phone (2026-11-04).
- [ ] Add Sign in with Apple before an App Store release. Apps that offer Google sign-in must offer it too, and it needs a paid Apple Developer Program team.
- [x] Clear the retained email-link result after Google sign-in on iOS without breaking the Android callback route. Unit-tested only; check Continue with Google on an iPhone and an Android phone with the new builds.

## Quality & security

- [x] Verify the original native keyboard, gestures, safe areas, text scaling and screen readers.
- [x] Verify the offline banner, reconnect sync and crash Reload on an iPhone and an Android phone (2026-11-04).
- [x] Check the October 2026 redesign on an iPhone and an Android phone: Comfortaa and Manrope, the floating tab bar and safe areas, sheet pages, the live workout timer, the keyboard in sheets, animations and reduced motion (2026-11-04).
- [x] Resolve the Router decoder advisory (decode-uri-component 0.5.0 override plus query-string adapter patch).
- [x] Resolve the http-cache-semantics shared-cache advisory with a local patch. 4.3.0 alone still has the flaw.
- [x] Adopt the node-forge signature-verification fix: 1.4.2 through `npm audit fix` (2026-10-28, docs/security-remediation.md).
- [x] Braces nested-pattern advisory: GitHub withdrew GHSA-vfj7-8cjw-p6xm on 2026-10-23 as not practically exploitable. No fix exists, so `braces@3.0.3` stays.
- [ ] Enable Supabase leaked-password protection. It needs a Pro plan (the apply command returned HTTP 402), so it's a billing decision.
- [x] Upgrade to Expo SDK 58 (2026-10-29): Expo 58.0.21, React Native 0.88.1, React 19.3.0 and Expo Router 58.0.28. The query-string patch and xcode uuid override are gone; the http-cache-semantics patch stays (patches/README.md). Web routes load eagerly (`asyncRoutes.web: false`) to match native load order, and release builds use R8. `npm run check`, Expo Doctor, all three exports, the browser suite and emulator debug and release builds pass. Checked on an iPhone and an Android phone (2026-11-04).
- [x] Move to Expo 58.0.23 and the SDK's current patch versions, with `react-native-safe-area-context` 5.11.1 (2026-11-04), so Expo Doctor passes. `npm run check`, Expo Doctor, all three exports and the browser suite pass. Not yet tried in a native build on a phone.
- [ ] The zod, glob and minimatch audit findings wait for Expo and Sentry releases that accept the fixed majors (docs/security-remediation.md).
- [ ] Move to the React Native strict TypeScript API before RN 0.90 drops the `tsconfig.json` opt-out.
- [x] Let Google-only accounts delete themselves: without a password, `delete-account` accepts a Google sign-in from the last 10 minutes, and Settings offers "Sign in with Google again" (docs/account-management.md).
- [x] Apply migration `20261018120000_account_deletion_attempts.sql` and deploy `delete-account` (both 2026-10-18).
- [ ] Delete a throwaway Google-only account and a password account through Settings to confirm `delete-account` end to end. Required for App Store review.
- [x] Decide on token-hash email links on a never-signed-in device. Every hosted email template uses `{{ .ConfirmationURL }}` (PKCE), so Track refuses token-hash links (docs/security-remediation.md).
- [x] Move the Android signing secrets into the `android-release` GitHub Environment (limited to `main`, w0x7y as required reviewer) and delete the repository copies (2026-10-28). The 2026-10-28 build used them and kept the original certificate (docs/android-apk.md).
- [ ] Enable Supabase Auth CAPTCHA (such as Turnstile) so sign-up, resend and reset emails can't be spammed through the shared project. The in-app resend cap is only a convenience.
- [x] Add `script-src` and `connect-src` to the Content-Security-Policy in `vercel.json` before deploying the web app. Tested locally against `npm run export:web`; recheck the browser console after the first Vercel deploy.
- [ ] Remove the `localhost` callbacks and the `http://localhost:3000` Site URL from the production Auth settings, or move local testing to a separate Supabase project.
- [x] Raise the server password minimum (`password_min_length`) from 6 to 10 characters (2026-10-28).
- [x] Pin GitHub Actions to commit SHAs with the release tag in a comment. Update both together when bumping an action.
- [x] Check how Supabase links a Google sign-in to an existing account whose email was never confirmed (pre-account takeover). It isn't a takeover with the current settings (docs/security-remediation.md).

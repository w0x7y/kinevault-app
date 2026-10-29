# TODO

This file is the single source of truth for project status. PRODUCT.md, README.md
and docs/ describe behavior and link here instead of repeating status.

## Food & water

- [x] Integrate drink logging with water tracking.
- [x] Verify barcode scanning and drink/water logging on physical iOS and Android devices.
- [x] Log a solid food by Weight or by Servings (a count of the chosen serving, saved as grams).

## Steps

- [x] Count phone steps on Home (Core Motion on iOS, Health Connect on Android) and log missed steps by hand. Logged steps stay on the device.
- [ ] Verify phone steps on a physical iPhone and Android phone: the permission prompts, denied and re-enabled access, Health Connect install on Android 8–13, the count for today and earlier days (iOS keeps 7 days), and Logged steps adding to it.
- [ ] Sync Logged steps across devices. The hosted `track_documents` table only accepts its listed document keys, so `kinevault-track.steps-log.v1` needs a reviewed migration before it can join the Account tracking document registry.
- [ ] Include Logged steps in the account JSON export.
- [ ] Declare Health Connect step access in the Play Console and add a privacy policy page for its permission screen before any Google Play release; the link currently just opens the app.

## Exercise

- [x] Build strength/bodyweight exercise and reusable workout creation, search, editing, and deletion.
- [x] Log saved workouts by day with planned set counts, reps, optional kg, and independent left/right measurements.
- [x] Restore the active workout, timer, and saved draft fields after reopening; retain failed edits for retry.
- [x] Share completed-workout totals with Home and skip untouched blank sets.
- [x] Complete workout-edit/template architecture refactors, independent reviews, and automated regression checks.
- [x] Verify a full workout on a physical iPhone: Start, set entry, exercise scrolling, keyboard, background/reopen, End, and completed editing.
- [x] Open the live workout as a full page with its timer centered in the top bar, show the timer in the app header while it runs, and show Kine working out on the Exercise tab in place of the day's cards.
- [ ] Check the live workout page on a physical iPhone and Android phone: the page sheet and back gesture, the header timer at narrow widths, the pinned Back/Next/End workout footer with the keyboard open, edit mode (the chips' wiggle, press-and-hold drag inside the sheet, the X and Add exercise popups, + and − beside sets at 320pt), tapping a set's number to fill last workout's values, and a countdown buzzing while the workout page is closed or the app is in the background.
- [x] Add Alternating (reps per side) and Timed (whole seconds, with a countdown or stopwatch) tracking modes.
- [x] Remove a set from a live workout (this workout only, never its template) and record optional RIR beside reps and weight.
- [x] Live workout controls: Discard at the top right, Back/Next/End workout pinned at the bottom (and Back/Next/Save in the saved-workout editor), L1/R1 set badges, a ⋯ menu to add or remove the last set, and set numbers that fill last workout's values.
- [ ] Update every installed build before marking an exercise Alternating or Timed or entering RIR: older builds stop loading workouts that hold the new modes, and drop RIR when they re-save a workout.
- [ ] Add cardio with duration/distance in a future phase.

## Profile & integrations

- [x] Build the Personal journal Profile with shared avatar, activity streaks, workout graphs, editable goals, and local progress-photo carousel.
- [x] Shared Supabase accounts with email/password sign-in and versioned cloud document sync (PR #3).
- [ ] Verify the new Profile camera/library, photo reopening, carousel scrolling, and accessibility on a physical iPhone. Android emulator photo flows and larger text are verified.
- [x] Integrate KineVault studio exercise videos: linked exercises play demos in workouts, templates and the exercise form, with search thumbnails. See docs/exercise-demos.md.
- [x] Publish the first KineVault demos to the hosted project: 10 demos on 2026-10-14 (the migration was applied on 2026-10-13). Linking and playback were checked on a phone in Expo Go.
- [ ] Re-check demo playback, fullscreen, offline replay and Android rounded video corners in native builds on an iPhone and an Android device before release.
- [x] Build apps to install directly: a signed release `.apk` (`Android release build` workflow, docs/android-apk.md) and an unsigned `.ipa` signed with xtool (`iOS unsigned build` workflow, docs/ios-linux-xtool.md). Both use `com.kinevault.track`.
- [ ] Configure store builds when ready to release: a Play Console app bundle with increasing version codes, and App Store builds, which need a paid Apple Developer Program team.
- [ ] Activate production email delivery and web hosting: Resend SMTP, a verified sender domain, and the Vercel production origin. Gmail SMTP sends account emails until then. See docs/supabase-setup.md.
- [ ] Publish the Google sign-in consent screen without buying a domain: deploy the Track web app to a free `*.vercel.app` address with a `/privacy` page, add its home page and privacy policy links on the Google Auth Platform Branding page, add that address as an authorized domain, then click Publish app. Until then only listed test users can use Google sign-in (100 over the project's lifetime).
- [ ] Make new Android and iOS builds (`expo-web-browser` is a new native module), then check Continue with Google, Resend email and the email callback on a physical iPhone and Android phone.
- [ ] Add Sign in with Apple before an App Store release: apps that offer Google sign-in must also offer it. Needs a paid Apple Developer Program team.
- [x] Clear the retained email-link result after Google sign-in on iOS, where no callback screen acknowledges it, without breaking the Android callback route's remount. Unit-tested only; check Continue with Google on an iPhone and an Android phone with the new builds.

## Quality & security

- [x] Verify the original native keyboard, gestures, safe areas, text scaling, and screen readers.
- [ ] Verify the new offline banner, reconnect sync and crash Reload on native devices before release.
- [ ] Check the October 2026 redesign on a physical iPhone and Android phone: Comfortaa and Manrope rendering, the floating tab bar and safe areas, sheet pages (an iOS page sheet), the live workout timer, the keyboard inside sheets, animations, and reduced motion. So far it has run only in browser tests.
- [x] Resolve the Router decoder advisory (decode-uri-component 0.5.0 override plus query-string adapter patch).
- [x] Resolve the http-cache-semantics shared-cache advisory with a local patch; 4.3.0 alone still reproduces the flaw.
- [ ] Adopt a compatible Expo/node-forge signature-verification fix when available.
- [ ] Adopt a verified compatible Braces nested-pattern denial-of-service fix when available.
- [ ] Enable Supabase leaked-password protection. Requires a Pro plan; the apply command returned HTTP 402. Billing decision.
- [ ] Finish the Expo SDK 58 upgrade. Done on 2026-10-29: Expo 58.0.21, React Native 0.88.1, React 19.3.0 and Expo Router 58.0.28. The query-string patch and the xcode uuid override are gone, and the http-cache-semantics patch stays (patches/README.md). Web routes load eagerly (`asyncRoutes.web: false`) so the browser suite keeps native's load order. `npm run check`, Expo Doctor, all three exports, the browser suite and Android debug and release builds on the emulator pass. Still to do: build and run iOS on a Mac, and try both phones (Expo Go needs a version that supports SDK 58). Release builds now use R8; one Glide asset error shows in release logcat with and without R8, so check images in a release APK. Move to the React Native strict TypeScript API before RN 0.90 drops the `tsconfig.json` opt-out. The zod and deepmerge audit findings wait for Expo.
- [x] Let Google-only accounts delete themselves: without a password, `delete-account` accepts the session's Google sign-in from the last 10 minutes, and Settings offers "Sign in with Google again". See docs/account-management.md.
- [x] Apply migration `20261018120000_account_deletion_attempts.sql` and deploy `delete-account` (both 2026-10-18).
- [ ] Delete a disposable Google-only account and a password account through Settings to confirm `delete-account` end to end. Required for App Store review.
- [x] Decide on token-hash email links on a never-signed-in device: every hosted email template uses `{{ .ConfirmationURL }}` (PKCE), so Track refuses token-hash links. See docs/security-remediation.md.
- [ ] Move the Android signing secrets into a GitHub Environment limited to `main` with a required reviewer. The workflow already uses the `android-release` environment; create it, move the two secrets and delete the repository copies (docs/android-apk.md).
- [ ] Enable Supabase Auth CAPTCHA (e.g. Turnstile) so sign-up, resend and reset emails can't be spammed through the shared project; the in-app resend cap is only a convenience.
- [x] Before deploying the web app, add `script-src` and `connect-src` to the Content-Security-Policy in `vercel.json` and test it against the export. Checked locally against `npm run export:web` served with these headers; recheck in the browser console after the first Vercel deploy.
- [ ] Remove the `localhost` callbacks and the `http://localhost:3000` Site URL from the production Auth settings, or move local testing to a separate Supabase project.
- [ ] Apply the 10-character password minimum on the server (`password_min_length`); today only the app enforces it.
- [x] Pin GitHub Actions to commit SHAs instead of tags, with the release tag in a comment. Update the SHA and comment together when bumping an action.
- [x] Check how Supabase links a Google sign-in to an existing account whose email was never confirmed (pre-account takeover). Not a takeover with the current settings; see docs/security-remediation.md.

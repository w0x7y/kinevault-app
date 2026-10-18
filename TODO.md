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
- [ ] Declare Health Connect step access in the Play Console and add a privacy policy page for its permission screen before any Google Play release; the link currently just opens the app.

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
- [ ] Track the Expo SDK 58 upgrade. It removes the query-string dependency, which retires one local patch. Both patches must be re-validated on every SDK bump.
- [x] Let Google-only accounts delete themselves: without a password, `delete-account` accepts the session's Google sign-in from the last 10 minutes, and Settings offers "Sign in with Google again". See docs/account-management.md.
- [ ] Deploy `delete-account` (never deployed yet) after adding a per-user rate limit (docs/security-remediation.md), then delete a disposable Google-only and a password account. Required for App Store review.
- [ ] Decide on token-hash email links on a never-signed-in device: if every Track email template uses `{{ .ConfirmationURL }}` (PKCE), refuse token-hash links. Check with the friend's shared project first. See docs/security-remediation.md.
- [ ] Move the Android signing secrets into a GitHub Environment limited to `main` with a required reviewer.
- [ ] Enable Supabase Auth CAPTCHA (e.g. Turnstile) so sign-up, resend and reset emails can't be spammed through the shared project; the in-app resend cap is only a convenience.
- [ ] Before deploying the web app, add `script-src` and `connect-src` to the Content-Security-Policy in `vercel.json` and test it against the export.
- [ ] Remove the `localhost` callbacks and the `http://localhost:3000` Site URL from the production Auth settings, or move local testing to a separate Supabase project.
- [ ] Apply the 10-character password minimum on the server (`password_min_length`); today only the app enforces it.
- [x] Pin GitHub Actions to commit SHAs instead of tags, with the release tag in a comment. Update the SHA and comment together when bumping an action.
- [ ] Check how Supabase links a Google sign-in to an existing account whose email was never confirmed (pre-account takeover).

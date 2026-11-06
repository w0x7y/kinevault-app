# TODO

This file is the single source of truth for project status. PRODUCT.md, README.md and docs/ describe behavior and link here instead of repeating status.

## Food & water

- [x] Count drinks toward water.
- [x] Verify barcode scanning and drink/water logging on physical iOS and Android devices.
- [x] Log a solid food by Weight or by Servings (saved as grams).
- [x] Copy one meal or a whole day of food from another day into the selected day. It adds no document field or value, so older builds load and re-save the copies.
- [ ] Check Copy food on an iPhone and an Android phone: the page sheet and its back gesture, the arrows and date at 320pt with large text, copies rising into their meals, and copied drinks in the water total. Only unit and browser tests so far.

## Steps

- [x] Count phone steps on Home (Core Motion on iOS, Health Connect on Android) and log missed steps by hand. Phone steps stay on the device.
- [x] Verify phone steps on an iPhone and an Android phone: permission prompts, denied and re-enabled access, Health Connect install on Android 8–13, today's and earlier counts (iOS keeps 7 days), and Logged steps adding on (2026-11-04).
- [x] Sync Logged steps as an Account tracking document, with migration `20261029120000_track_documents_steps_log.sql`.
- [x] Apply migration `20261029120000` to the hosted project (2026-10-29, verified).
- [ ] Update every device on an account to a build from 2026-10-29 or later before logging steps there. Older builds fail every cloud download once the account holds a steps row (docs/supabase-setup.md).
- [x] Include Logged steps in the account JSON export.
- [ ] Before any Google Play release, declare Health Connect step access in the Play Console with the privacy policy page. The page exists at `/privacy`, with placeholders to fill and a deploy still to do (docs/privacy.md). Health Connect's privacy policy link still opens the app's start screen, not `/privacy`; routing it there needs a native MainActivity change (docs/privacy.md).
- [ ] Also declare the Health Connect write access for exercise, weight and hydration in the Play Console, with the same privacy policy page (`/privacy`, placeholders still to fill).

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
- [x] Add Cardio (a time and an optional distance, typed in km and saved as `distanceMeters`), Warm-up sets (a `warmUp` flag, marked from the set number in edit mode) and the Plate calculator (bar kept on the device).
- [ ] Update every installed build before using Cardio or warm-up sets. Once any exercise uses the `cardio` mode, older builds fail every cloud download (food, water and Profile too), and drop `warmUp` flags when they re-save a workout. They can't load a Cardio set at all, so they never drop its distance.
- [x] Add supersets: adjacent exercises joined in a saved workout or in edit mode (`supersets` on templates, `superset` on log rows), a bracket under their chips, "+" in workout lists and rounds in the live workout. Import adds none.
- [ ] Update every installed build before using supersets. Older builds drop superset groups when they re-save a template or log.
- [ ] Check supersets on an iPhone and an Android phone: the bracket under the chips, also while edit mode wiggles and drags them, the Superset checkbox at 320pt, and Next and Back going in rounds. Only unit and browser tests so far.
- [x] Add Share workout: a 1080 × 1350 PNG of the day's Completed workouts from the Exercise tab's Workout card, captured with `react-native-view-shot` and shared with expo-sharing. Hidden on web. It adds no document field or value.
- [ ] Make new Android and iOS builds for Share workout: `react-native-view-shot` is a new native module, so a build without it can't capture the image.
- [ ] Check Share workout on an iPhone and an Android phone: share to Messages, WhatsApp and Photos (Save Image on iOS), and check the PNG is 1080 × 1350, light in dark mode, with Kine drawn and nothing cut off at large text sizes. Only unit tests and a web layout check so far.
- [ ] Check Cardio, warm-ups and Plates on an iPhone and an Android phone: the km field keeps a typed decimal point, the Cardio stopwatch, the warm-up checkbox in edit mode at 320pt, the Plates sheet, and the bar kept after a restart. Only unit and browser tests so far.

## Profile & integrations

- [x] Save completed workouts, body weight and daily water to Apple Health or Health Connect from a Settings switch (a device setting, off by default). Turning it on also saves the existing history. It adds no document field or value, so older builds load and re-save everything unchanged.
- [ ] Make new Android and iOS builds for health saving: `@kingstinct/react-native-healthkit` and `react-native-nitro-modules` are new native modules, the Health Connect write permissions are new in the manifest, and the iOS workflow now ad-hoc signs the app so xtool carries the HealthKit entitlement. Expo Go and builds without them show the store as unavailable.
- [ ] Check health saving on an iPhone: that the xtool install keeps HealthKit (turning it on shows Apple's permission sheet; without the entitlement Settings says Apple Health isn't available), the sheet's three write types, a timed and a manual workout in Health with the workout name, body weight, a day's water, an edit replacing and a delete removing each, a denial and Open settings reaching Health access, and a long first sync.
- [ ] Check health saving on an Android phone: the Health Connect write dialog, the install flow on Android 8–13, repeated refusals and Open settings, a strength and a cardio-only workout, weight and water records, edits replacing and deletes removing them, and a first sync of a long history.
- [x] Add a Units setting (Metric or Imperial) beside Appearance: pounds, feet and inches, miles, ounces and US fluid ounces on every tab, in fields and in the share image, with pound plates on the Plate calculator. It converts only at display and input, adds no document field or value and never syncs, so there is no rollout step (docs/language-and-units.md).
- [ ] Check Imperial on an iPhone and an Android phone: the decimal pad (and a decimal comma) in the lb, oz, in and mi fields, the feet and inches row at 320pt with large text, Plates in pounds, and the share image in pounds and miles. Only unit and browser tests so far.
- [x] Build the Personal journal Profile: avatar, streaks, workout graphs, editable goals and a local progress-photo carousel.
- [x] Add Body measurements to the Personal journal: waist, chest, hips, arm and thigh in cm, saved in a new optional `bodyMeasurements` field of the Profile, charted with the body-weight chart and included in the JSON export.
- [ ] Update every installed build before logging body measurements. Older builds load the Profile but drop `bodyMeasurements` when they re-save it (any goal, name or weight edit), and that copy then syncs to the other devices.
- [ ] Check Body measurements on an iPhone and an Android phone: the six-field sheet with the keyboard open, a decimal comma, the measurement chooser, and the history rows at 320pt with large text. Only unit and browser tests so far.
- [x] Shared Supabase accounts with email/password sign-in and versioned cloud sync (PR #3).
- [x] Verify Profile camera and library, photo reopening, carousel scrolling and accessibility on an iPhone and an Android phone (2026-11-04). Android emulator photo flows and larger text were verified earlier.
- [x] Show KineVault exercise videos in workouts, templates and the exercise form, with search thumbnails (docs/exercise-demos.md).
- [x] Publish the first 10 KineVault demos to the hosted project on 2026-10-14 (migration applied 2026-10-13). Linking and playback checked on a phone in Expo Go.
- [x] Re-check demo playback, fullscreen, offline replay and Android rounded video corners in native builds on an iPhone and an Android phone (2026-11-04).
- [x] Build installable apps: a signed release `.apk` (`Android release build` workflow, docs/android-apk.md) and an unsigned `.ipa` signed with xtool (`iOS unsigned build` workflow, docs/ios-linux-xtool.md). Both use `com.kinevault.track`.
- [ ] Set up store builds when ready to release: a Play Console app bundle with increasing version codes, and App Store builds, which need a paid Apple Developer Program team.
- [ ] Turn on production email and web hosting: Resend SMTP, a verified sender domain and the Vercel production origin. Gmail SMTP sends account emails until then (docs/supabase-setup.md).
- [ ] Publish the Google sign-in consent screen without buying a domain: deploy the web app to a free `*.vercel.app` address with the `/privacy` page (it exists; fill its placeholders first, docs/privacy.md), add its home page and privacy policy links on the Google Auth Platform Branding page, add the address as an authorized domain, then click Publish app. Until then only listed test users can use Google sign-in (100 over the project's lifetime).
- [x] Make new Android and iOS builds (`expo-web-browser` is a new native module) and check Continue with Google, Resend email and the email callback on an iPhone and an Android phone (2026-11-04).
- [ ] Add Sign in with Apple before an App Store release. Apps that offer Google sign-in must offer it too, and it needs a paid Apple Developer Program team.
- [x] Clear the retained email-link result after Google sign-in on iOS without breaking the Android callback route. Unit-tested only; check Continue with Google on an iPhone and an Android phone with the new builds.

## Paid plans

Membership already has `free`, `plus` and `pro` on the server (`public.subscriptions`), with no payments yet. Track isn't public yet (two users as of 2026-11-05), so existing features can move behind a plan. Tell current users before gating something they use.

Before charging:

- [ ] Ship store builds first (Profile & integrations above). Subscriptions need a Play Console listing and a paid Apple Developer Program team. Sideloaded `.apk` and xtool `.ipa` builds can't take purchases.
- [ ] Add store billing, for example RevenueCat (`react-native-purchases`) over StoreKit and Play Billing. A server webhook writes `public.subscriptions`; the app only reads it (`src/account/membership.ts`).
- [ ] Add one gate the app reads everywhere (plan, status and a grace period while offline), plus a paywall sheet and Restore purchases. Locked features show what they do and how to unlock them, never an error.
- [ ] Check the plan on the server for anything that costs money to run (Storage policies, Edge Functions), not only in the UI.
- [ ] Decide what happens to Plus data after a plan lapses: keep it readable and exportable, and lock only new entries and Plus views.
- [ ] Launch Plus alone first. Keep `pro` for later.

Stays free, so the app is useful on day one:

- Food logging: search, barcode scan, servings, drinks, Daily macros (calories and the three macros) and a few custom foods and meals.
- Water, steps, reminders, the Units and Appearance settings, and Workout import.
- Workout logging: saved workouts, the live workout, Rest timer, RIR, Personal records and Previous sets hints.
- Calorie and macro goals, body weight, streaks and the 4-week Workout graph.
- Sync, JSON export and account deletion. Export and deletion stay free for trust and store review.

Plus, moved from what exists today:

- [ ] Unlimited custom foods and meals (free keeps 10 of each) and unlimited saved workouts (free keeps 3). Existing items stay usable after a lapse; only new ones are locked.
- [ ] Detailed nutrients in Daily macros and custom foods: fat subtypes, fiber, sugars, minerals, vitamin D, caffeine and alcohol.
- [ ] Copy food from another day.
- [ ] Supersets, warm-up sets and the Plate calculator.
- [ ] Cardio distance totals and the 12 and 52-week Workout graphs.
- [ ] Body measurements and their chart.
- [ ] Progress photos past the first three, and the earliest-and-latest comparison.
- [ ] Saving to Apple Health and Health Connect.
- [ ] Every KineVault exercise demo. Free shows a few starter demos.
- [ ] Share image styles past the default card. The default card stays free because it advertises the app.

Plus, new:

- [ ] Progression suggestions: the next weight and reps from the last session, its RIR and warm-ups.
- [ ] Warm-up generator: warm-up sets built from the working weight, loaded with the Plate calculator.
- [ ] Adaptive calorie target: estimate daily energy use each week from the body-weight trend and logged kcal, then adjust the goal. Needs careful wording and a safe cap on the weekly rate of change.
- [ ] Weekly muscle volume map: sets per muscle on a body figure, from the muscle group or the linked KineVault exercise's muscles.
- [ ] Deeper trends: all-time workout graphs, a smoothed body-weight trend, weekly micronutrient averages and measurement overlays (waist, hips and weight on one chart).
- [ ] Cardio trends: pace, weekly distance and distance records such as the fastest 5 km.
- [ ] Meal plans: repeat a meal on chosen weekdays, built on Copy food.
- [ ] Recap cards: weekly and monthly summaries to share, with dark and photo-background styles.
- [ ] Progress photo cloud backup, and comparing any two dates. Photos are device-only today, and storage costs money.
- [ ] Home-screen widget and a lock-screen workout timer.
- [ ] Cosmetics: Kine outfits, app icons and accent colors.

Pro, later:

- [ ] AI food logging: a meal photo or a typed description becomes draft entries to review before saving. Rate-limit each account on the server.
- [ ] KineVault programs: multi-week plans that schedule and progress saved workouts.
- [ ] Coach sharing: a coach reads a client's logs and leaves notes.

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
- [x] Move to the React Native strict TypeScript API (2026-11-06): `tsconfig.json` drops the `react-native-legacy-deep-imports` condition, and refs use the instance types React Native exports (`ViewInstance`, `ScrollViewInstance`, `TextInputInstance`). `npm run check`, the web export and the browser suite pass. Not yet tried in a native build on a phone.
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

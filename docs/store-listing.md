# Store listing

Answers and copy for submitting KineVault Track (`com.kinevault.track`) to Google Play and the App Store, written on 2026-11-06 from the code on `main` at `098cb47`. Each answer names the file it comes from. Store rules that this repo can't prove are marked **check current Play policy** or **check current App Store policy**: confirm them in the console before submitting.

Read [privacy](privacy.md) and the `/privacy` page ([`src/app/privacy.tsx`](../src/app/privacy.tsx)) first. The store answers have to match the published policy, and that page still has placeholders.

## What the app sends off the device

Every form below follows from this table. Data that never leaves the device isn't "collected" under either store's definition (**check current Play and App Store policy** for the exact wording).

| Data                                                                                                                                        | Where it goes                                                                                                     | Source                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email address, password (Supabase stores a hash), account ID                                                                                | Supabase Auth, in the project shared with KineVault                                                               | [`src/app/privacy.tsx`](../src/app/privacy.tsx) "Your account", [account management](account-management.md)                                                           |
| Google identity (email and basic profile) for Continue with Google                                                                          | Google, then Supabase Auth                                                                                        | [`src/app/privacy.tsx`](../src/app/privacy.tsx), [`src/account/controller.ts`](../src/account/controller.ts) `signInWithGoogle`                                       |
| Profile: optional first name or nickname, goal, age, sex (only for the calorie estimate), height, weight, activity, calorie and macro goals | Supabase `track_documents`                                                                                        | [`src/profile/answers.ts`](../src/profile/answers.ts) `emptyAnswers`, [`src/account/tracking-documents.ts`](../src/account/tracking-documents.ts)                     |
| Body-weight history and body measurements                                                                                                   | Supabase, inside the Profile document                                                                             | [PRODUCT.md](../PRODUCT.md) Profile, [`src/app/privacy.tsx`](../src/app/privacy.tsx)                                                                                  |
| Food log, custom foods and meals, saved barcode imports, water log, water goal                                                              | Supabase                                                                                                          | [`src/account/tracking-documents.ts`](../src/account/tracking-documents.ts)                                                                                           |
| Exercises (name, muscle group, equipment, notes), saved workouts, workout logs, imported workouts, hand-logged steps                        | Supabase                                                                                                          | [`src/account/tracking-documents.ts`](../src/account/tracking-documents.ts), [PRODUCT.md](../PRODUCT.md) Exercise                                                     |
| Membership plan (`free`, `plus`, `pro`) and status                                                                                          | Supabase `public.subscriptions`, set on the server. No payments exist                                             | [`supabase/migrations/20261005150934_account_cloud_storage.sql`](../supabase/migrations/20261005150934_account_cloud_storage.sql), [TODO.md](../TODO.md) Paid plans   |
| Crash reports: error type, a fixed message, bundle line and column numbers, time, platform, event ID, constant IP `0.0.0.0`                 | Sentry (EU region), when the build has a DSN                                                                      | [`src/components/crash-reporting-policy.ts`](../src/components/crash-reporting-policy.ts), [resilience](resilience.md), [Sentry verification](sentry-verification.md) |
| A barcode, with no account data                                                                                                             | Open Food Facts (`world.openfoodfacts.org`), straight from the device                                             | [`src/food/product-provider.ts`](../src/food/product-provider.ts)                                                                                                     |
| A Tracked workout ID, with no cookies or account data                                                                                       | `app.tracked.gg`, straight from the phone (on web, through the `tracked-workout` Edge Function, which keeps none) | [`src/exercise/import/tracked-fetch.ts`](../src/exercise/import/tracked-fetch.ts), [workout import](workout-import.md)                                                |
| Completed workouts, body weight, daily water totals                                                                                         | The phone's own Apple Health or Health Connect store, only when the user turns saving on                          | [`src/health/device-health.ios.ts`](../src/health/device-health.ios.ts), [`src/health/device-health.android.ts`](../src/health/device-health.android.ts)              |

Stays on the device: profile and progress photos, the phone's step count, reminders, the rest timer length, the health saving setting and its record list, units and appearance ([privacy](privacy.md)). The JSON export goes wherever the user sends it through the share sheet; the developer doesn't receive it.

All network traffic uses HTTPS: the Supabase URL in [`.env.example`](../.env.example), the Sentry DSN (`https://…ingest.de.sentry.io/…`), `https://world.openfoodfacts.org` and `https://app.tracked.gg` ([`src/exercise/import/tracked-link.ts`](../src/exercise/import/tracked-link.ts)).

The app has no ads, analytics or attribution SDKs. [`package.json`](../package.json) dependencies list none, and the 2026-11-05 release APK requests no `AD_ID` permission. It never requests a push token (no `getExpoPushTokenAsync` or `getDevicePushTokenAsync` in `src`), although `expo-notifications` still puts `com.google.android.c2dm.permission.RECEIVE` in the Android manifest. The APK also carries the Install Referrer permission (`BIND_GET_INSTALL_REFERRER_SERVICE`), which comes with the `expo-application` dependency; nothing in `src` reads the referrer.

### Is crash reporting on in release builds?

Yes, for builds from the current workflows. Reporting is off unless `EXPO_PUBLIC_SENTRY_DSN` is set ([`crashReportingOptions`](../src/components/crash-reporting-policy.ts)). Both `android-release-build.yml` and `ios-unsigned-build.yml` read it from the repository variable, which is set (`gh variable list`, updated 2026-10-17). The DSN is in the JavaScript bundle of the 2026-11-05 release APK. Users can't turn it off in the app.

Store builds don't exist yet. Whatever builds the Play bundle and the App Store build has to set the same variable, or the crash-log answers below change to "not collected". Only local JavaScript delivery to Sentry has been verified ([Sentry verification](sentry-verification.md)).

## 1. Google Play Data safety

Overview answers:

| Question                                                 | Answer                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does the app collect or share any required user data?    | Yes                                                                                                                                                                                                                                                                     |
| Is all user data encrypted in transit?                   | Yes. Every endpoint above is HTTPS                                                                                                                                                                                                                                      |
| Do you provide a way for users to request data deletion? | Yes. In the app: Settings → Data & account → Delete account ([`src/account/settings-panel.tsx`](../src/account/settings-panel.tsx)). On the web: `https://<production origin>/delete-account`, which another branch is adding. The production origin isn't deployed yet |

Per data type. "Shared" means sent to a third party other than a service provider; Supabase and Sentry process data for the app as service providers (**check current Play policy** for the service-provider and user-initiated exemptions).

| Google data type                                           | Collected                                                                                                                                                                                  | Shared | Required or optional                                                                                                                     | Purposes                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Location (approximate, precise)                            | No. Sentry gets `0.0.0.0` in place of the IP. See the Supabase IP question below                                                                                                           | No     | –                                                                                                                                        | –                                                                                                                          |
| Personal info: Name                                        | Yes. The optional name in setup. Supabase Auth also keeps the Google profile it receives, name included, in the user's metadata (Supabase behavior, not in this repo; check the dashboard) | No     | Optional                                                                                                                                 | App functionality (the Home greeting), Account management                                                                  |
| Personal info: Email address                               | Yes                                                                                                                                                                                        | No     | Required. Home needs an account ([PRODUCT.md](../PRODUCT.md) Accounts and sync)                                                          | Account management, App functionality                                                                                      |
| Personal info: User IDs                                    | Yes. The Supabase account ID                                                                                                                                                               | No     | Required                                                                                                                                 | Account management, App functionality                                                                                      |
| Personal info: Other info                                  | Yes. Age and sex                                                                                                                                                                           | No     | Age is required (setup only finishes with an age of 18 to 100, [`src/profile/calories.ts`](../src/profile/calories.ts)). Sex is optional | App functionality (the age rule and the calorie estimate)                                                                  |
| Personal info: address, phone, race, beliefs, orientation  | No                                                                                                                                                                                         | No     | –                                                                                                                                        | –                                                                                                                          |
| Financial info                                             | No. No purchases exist. Revisit when store billing ships                                                                                                                                   | No     | –                                                                                                                                        | –                                                                                                                          |
| Health and fitness: Health info                            | Yes. Height, body weight, body measurements, food and drink log, water log, calorie, macro and water goals                                                                                 | No     | Optional. Nothing is sent until the user logs it                                                                                         | App functionality                                                                                                          |
| Health and fitness: Fitness info                           | Yes. Exercises, saved workouts, workout logs, imported workouts, hand-logged steps. Phone steps read from Health Connect stay on the device and aren't collected                           | No     | Optional                                                                                                                                 | App functionality                                                                                                          |
| Messages, audio, files and docs, calendar, contacts        | No                                                                                                                                                                                         | No     | –                                                                                                                                        | –                                                                                                                          |
| Photos and videos                                          | No. Photos stay in the app's private storage and are never uploaded                                                                                                                        | No     | –                                                                                                                                        | –                                                                                                                          |
| App activity: Other user-generated content                 | Yes. Names of custom foods, meals, exercises and saved workouts, and exercise notes                                                                                                        | No     | Optional                                                                                                                                 | App functionality                                                                                                          |
| App activity: interactions, search history, installed apps | No. Food search runs on the device                                                                                                                                                         | No     | –                                                                                                                                        | –                                                                                                                          |
| Web browsing                                               | No                                                                                                                                                                                         | No     | –                                                                                                                                        | –                                                                                                                          |
| App info and performance: Crash logs                       | Yes, in builds with the Sentry DSN (see above)                                                                                                                                             | No     | Required. There's no in-app switch                                                                                                       | Pick the purpose Google's form gives for diagnosing crashes, Analytics or App functionality. **Check current Play policy** |
| App info and performance: Diagnostics, other performance   | No. Tracing, profiling, sessions and replay are off ([resilience](resilience.md))                                                                                                          | No     | –                                                                                                                                        | –                                                                                                                          |
| Device or other IDs                                        | No. The Sentry event ID is random per event, events carry no device context, and there's no advertising ID or push token                                                                   | No     | –                                                                                                                                        | –                                                                                                                          |

Not collected and why: the barcode sent to Open Food Facts and the workout ID sent to Tracked are product and workout identifiers, not user data, sent only when the user scans or imports. Both services see the device's IP address. If you decide they count, declare them as shared App activity under the user-initiated exemption (**check current Play policy**).

What deletion removes, for the deletion section and the `/delete-account` page ([account management](account-management.md)):

- The account, its synced Track documents and history, the shared KineVault profile row and the membership, through `auth.admin.deleteUser` and `ON DELETE CASCADE`.
- The account's local records and photos on the device that deletes it. Other devices keep their copies until cleared there.
- Records already saved to Health Connect or Apple Health stay; the user removes them there.
- Crash reports aren't linked to an account, so they stay until Sentry's retention period ends.

Uncertain, for the owner:

- **Supabase request logs.** Supabase's own Auth and API logs may record request IP addresses. Check the project's log settings and retention, then decide whether that counts as approximate location.
- **Shared KineVault account.** Accounts live in the Supabase project shared with KineVault, whose repository has a different GitHub owner ([README.md](../README.md)). If KineVault is run by a different person or company than Track, the email, account ID and membership count as shared with that developer, and the policy's `[Operator name]` has to say who runs what.
- **Deletion scope.** [Account management](account-management.md) says to audit every app's data tied to the shared account, including Storage objects, before claiming deletion removes it, and TODO.md still has the end-to-end deletion check open. Don't say "all data is deleted" until both are done.
- **Optional versus required for health and fitness data.** Users choose what to log, so the table says optional. If Google's definition treats the app's core logging as required, change it.

## 2. Health Connect permission declarations

The release APK (2026-11-05, target SDK 36) declares exactly these four Health Connect permissions, matching [`app.json`](../app.json). It asks for no background or history read permission, so reads happen only with the app open. Each justification describes the user-facing feature, when it runs and what happens to the data, which is what the Play Console's Health Connect declaration asks for (**check current Play policy** for the form's fields and whether it needs a demo video).

**`android.permission.health.READ_STEPS`**

> KineVault Track reads the user's step count to show the day's total on the Home screen's Steps tile, added to any steps the user logs by hand. The user grants access by tapping Connect phone steps in the Steps sheet. The app reads only the step total for the selected day while it is open. It does not store, sync or upload the count, and reads no other Health Connect data.

Source: [`src/steps/device-steps.android.ts`](../src/steps/device-steps.android.ts), [`src/steps/summary.ts`](../src/steps/summary.ts), [privacy](privacy.md) Steps.

**`android.permission.health.WRITE_EXERCISE`**

> When the user turns on Settings → Health → Save to Health Connect, KineVault Track saves each completed workout that has a duration as an exercise session with its name, start and end time, and a strength or other activity type. Editing or deleting the workout in the app updates or removes the session the app wrote. The app never reads exercise data from Health Connect.

Source: [`src/health/device-health.android.ts`](../src/health/device-health.android.ts), [PRODUCT.md](../PRODUCT.md) Settings and reminders.

**`android.permission.health.WRITE_WEIGHT`**

> When Save to Health Connect is on, KineVault Track saves the body-weight entries the user logs in the Personal journal as weight records. Editing or deleting an entry updates or removes the record the app wrote. The app never reads weight data from Health Connect.

Source: [`src/health/device-health.android.ts`](../src/health/device-health.android.ts).

**`android.permission.health.WRITE_HYDRATION`**

> When Save to Health Connect is on, KineVault Track saves each day's water total, including drinks logged on the Food tab, as one hydration record for that day, and replaces it when the total changes. The app never reads hydration data from Health Connect.

Source: [`src/health/device-health.android.ts`](../src/health/device-health.android.ts), [PRODUCT.md](../PRODUCT.md) Home.

What the privacy policy has to state for Health Connect (**check current Play policy** for the exact list):

- Which data types the app reads (steps) and writes (exercise sessions, weight, hydration), and why. The `/privacy` page already covers this in its Steps and "Apple Health and Health Connect" sections.
- That read step data isn't stored, synced, shared or uploaded. Already covered.
- A Limited Use statement. Google has asked for wording close to "The use of information received from Health Connect will adhere to the Health Connect Permissions policy, including the Limited Use requirements." The page doesn't have one yet; copy the current wording from the policy.
- A public URL. `/privacy` isn't deployed, and Health Connect's privacy policy link opens the app's start screen instead of `/privacy` ([privacy](privacy.md), Before publishing). TODO.md already tracks the routing fix.

The `/privacy` page still has placeholders: `[Operator name]`, `[Effective date]`, `[Contact email]` and `[Retention period]` (twice). Google rejects a policy with placeholders, so fill them before any Health Connect declaration.

## 3. App Store Connect App Privacy

Data used to track you: none. The app has no ad or analytics SDKs and doesn't share data with data brokers, so it needs no App Tracking Transparency prompt.

| Apple data type                  | What it covers                                                                                        | Linked to the user | Tracking | Purpose                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------ | -------- | --------------------------------------------------------------- |
| Contact Info: Email Address      | Account email                                                                                         | Yes                | No       | App Functionality                                               |
| Contact Info: Name               | Optional setup name; Google's basic profile for Google accounts                                       | Yes                | No       | App Functionality                                               |
| Health & Fitness: Health         | Height, body weight, body measurements, food and drink log, water log, calorie, macro and water goals | Yes                | No       | App Functionality                                               |
| Health & Fitness: Fitness        | Exercises, saved and logged workouts, imported workouts, hand-logged steps                            | Yes                | No       | App Functionality                                               |
| User Content: Other User Content | Names of custom foods, meals, exercises and workouts; exercise notes                                  | Yes                | No       | App Functionality                                               |
| Identifiers: User ID             | Supabase account ID                                                                                   | Yes                | No       | App Functionality                                               |
| Other Data                       | Age and sex from setup                                                                                | Yes                | No       | App Functionality                                               |
| Diagnostics: Crash Data          | Sentry crash reports, if the App Store build has the DSN                                              | No                 | No       | App Functionality (Apple lists "minimize app crashes" under it) |

Not collected: Photos or Videos (device only), Location (Sentry gets `0.0.0.0`), Purchases (none until billing), Contacts, Browsing History, Search History, Usage Data, Device ID. Phone steps from Core Motion and anything written to Apple Health stay on the device.

Age and sex could also go under Health. Pick one; don't declare them twice.

### HealthKit review notes

- The app only writes. `requestAuthorization` passes `toShare` only, for workouts, body mass and dietary water ([`src/health/device-health.ios.ts`](../src/health/device-health.ios.ts)). Saving is off until the user turns on Settings → Health → Save to Apple Health.
- `NSHealthShareUsageDescription` exists even though nothing is read: "KineVault doesn't read your health data. It only saves the workouts, body weight and water you log, once you turn that on in Settings." It's accurate, but a review may ask why a read-access string is there. Answer that the app requests write access only and the string says so. Removing it is worth testing only if the HealthKit config plugin doesn't fill in its own default read string when the key is missing. `node_modules` isn't installed in this worktree, so the plugin's behavior wasn't checked.
- Apple asks apps that use HealthKit to say so in their marketing text and UI (**check current App Store policy**, guideline 2.5.1). The description below mentions Apple Health, and the Settings switch is labeled Save to Apple Health.
- Health data the app syncs to Supabase is what the user typed, not data read from HealthKit, so the rule against storing HealthKit data in iCloud doesn't apply (**check current App Store policy**, guideline 5.1.3).

## 4. Age ratings

The app is for adults. Setup says "KineVault is for ages 18 and up" ([`src/onboarding/steps.tsx`](../src/onboarding/steps.tsx)) and only accepts an age from 18 to 100 ([`src/profile/calories.ts`](../src/profile/calories.ts)); Set up later still checks the age. A saved profile under 18 reopens at the age question ([PRODUCT.md](../PRODUCT.md)). The age is self-declared and not verified.

The store rating describes content; the audience is a separate answer. Content that bears on the rating:

- The USDA food catalog has alcoholic drinks as plain text entries (Beer, Gin, Liqueur, cocktails; [`assets/food/usda-fndds.json`](../assets/food/usda-fndds.json)), and Daily macros lists an Alcohol nutrient ([`src/food/nutrients.ts`](../src/food/nutrients.ts)). No images or promotion.
- Calorie, weight and nutrition topics. The calorie estimate is limited to people who are 18 or older, not pregnant or breastfeeding, and not on a prescribed nutrition plan ([`src/onboarding/body-question.tsx`](../src/onboarding/body-question.tsx)).
- No violence, sexual content, profanity, horror, gambling or contests.
- No user-to-user interaction, chat or shared user content. Share workout hands a PNG to the system share sheet.
- No unrestricted web browser. External links (Open Food Facts attribution, a PubMed citation in setup) open outside the app. Google sign-in uses the system auth session.
- No ads and no purchases yet.

**Google Play** (IARC questionnaire and App content):

- Category: Utility, Productivity, Communication, or Other (**check current Play policy**; IARC's category list changes).
- Violence, fear, sexuality, language, gambling: No.
- Controlled substances: the alcohol references above. Whether a nutrition entry counts as a "reference to alcohol" depends on the question's wording, so read it and answer accordingly.
- Users interact or exchange content: No. Shares location: No. Digital purchases: No, until Plus ships.
- Target audience and content: choose 18 and over only. That keeps the app out of the Families policy and matches the age rule.

**App Store** (age rating questionnaire, **check current App Store policy**; Apple revised the questions and added 13+, 16+ and 18+ ratings in 2025):

- Alcohol, tobacco or drug use or references: Infrequent (the catalog entries).
- Medical or treatment information: None. Health or wellness topics: Yes, if the form asks.
- Every other content category: None.
- Unrestricted web access: No. User-generated content shared with others: No. Messaging: No. Advertising: No.
- If the form lets you raise the rating, consider 18+ to match the app's own rule.

## 5. Listing copy

### Name and subtitle

App name (App Store 30 characters, Play 30 characters, **check current limits**):

- `KineVault Track` (15)
- `KineVault Track: Food & Gym` (27)
- `KineVault Track: Calorie Log` (28)

App Store subtitle (30 characters):

- `Food, workout and water log` (27)
- `Calories, lifts, water, steps` (29)
- `Log meals, workouts and water` (29)

Play short description (80 characters):

- `A food, water, steps and workout log with offline food search and barcode scans.` (80)
- `Count calories, log workouts and track water and steps, with Kine for company.` (78)
- `Log food, water, steps and workouts. Offline food search, barcode scans, sync.` (78)

### Full description

About 2,430 characters, under both stores' 4,000. It describes what every user has today without mentioning Plus. Health saving is in it because HealthKit and Health Connect apps should say what they do with health data, but it's planned for Plus ([TODO.md](../TODO.md)), so rewrite that line when Plus launches.

```text
KineVault Track is a log for your food, water, steps and workouts. Kine, a small blue creature, walks you through setup and greets you on Home.

HOME
• Calories left for the day, with carbs, protein and fat.
• Water and steps at a glance, plus the day's workout totals.
• Steps add your phone's count (Motion & Fitness on iPhone, Health Connect on Android) to steps you log by hand.

FOOD
• Search 5,431 foods from USDA FoodData Central, even offline. Small typos still match, and foods you've logged come first.
• Scan a barcode or type one in. Open Food Facts fills in a draft that you check before saving.
• Log a food by weight or by servings. Drinks count toward your water.
• Breakfast, Lunch, Dinner, Snacks and Drinks, with the day's calories against your goal.
• Create your own foods and meals. A meal adds up its ingredients.
• Copy one meal or a whole day from another day.

EXERCISE
• Build exercises and saved workouts, then start a live workout with a timer.
• Track single weights, left and right sides, alternating reps, timed sets or cardio with distance.
• A rest timer, optional RIR per set, warm-up sets and supersets.
• Hints from your last workout and personal records by estimated one-rep max.
• Log a saved workout later on any date.
• Import a workout shared as a Tracked link.
• Share a picture of the day's workouts.

PROFILE
• Body weight history with a chart.
• Waist, chest, hips, arm and thigh measurements.
• Streaks and a 4-week workout graph.
• Progress photos, kept on your device.
• Calorie, macro and water goals, starting from an estimate based on your answers.

SETTINGS
• Reminders for weigh-ins, water, workouts, food logging, progress photos or a note of your own, on the days and times you pick.
• Light, dark or system appearance, and metric or imperial units.
• Save completed workouts, body weight and daily water to Apple Health or Health Connect. It's off until you turn it on, and the app never reads your health data.
• Export your data as a JSON file, or delete your account.

YOUR DATA
• Sign in with email and password or with Google. Your tracking syncs to your other devices.
• Logging works offline and syncs when you're back online.
• Photos and your phone's step count stay on your device.
• No ads.

KineVault Track is for adults 18 and over. The calorie estimate is meant for adults who aren't pregnant or breastfeeding and aren't following a prescribed nutrition plan.
```

Claims and their sources: [PRODUCT.md](../PRODUCT.md) for features and counts, [privacy](privacy.md) for data handling, [`src/onboarding/body-question.tsx`](../src/onboarding/body-question.tsx) for the estimate's limits. Share workout is phones only, which is fine for both stores.

Left out because they're planned for Plus ([TODO.md](../TODO.md) "Plus at launch"), even though everyone has them while `plusGatesEnabled` is off ([`src/plus/gate.ts`](../src/plus/gate.ts)): detailed nutrients, the Plate calculator, 12 and 52-week graphs, the body measurement chart, photo comparison, more than the starter exercise demos, and unlimited custom foods, meals and saved workouts.

### Keywords (App Store, 100 characters)

`calorie,counter,food,diary,macro,workout,gym,lifting,water,steps,barcode,weight,nutrition,log` (93)

Apple already indexes the app name and subtitle, so don't repeat "KineVault" or "track". Alternates to swap in: `protein`, `meal`, `fitness`, `rest timer`, `strength`.

### Categories

- App Store: primary Health & Fitness, secondary Food & Drink.
- Google Play: Health & Fitness.

### Screenshots

Capture from a native build with a demo account full of sample data, in light mode. The web preview hides Share workout and the Health switch, and isn't the shipped app. Leave Plus-planned screens (Plates, detailed nutrients, long graphs, measurement chart, photo comparison) out of the set so it stays true when Plus launches.

Screens, in order:

1. Home: the calorie ring with macros, steps, water and the day's workout.
2. Food: the Daily food log with filled meals.
3. Food search results, or a barcode draft with the Open Food Facts attribution showing.
4. The live workout page with the rest timer running.
5. Exercise: the Daily workout log or Saved workouts.
6. Daily macros (calories and the three macros).
7. Profile: the Personal journal with the body-weight chart and streaks.
8. Settings: Health and Reminders.

One dark-mode shot of Home is optional.

Sizes (**check current App Store and Play specs** before capturing):

| Store     | Asset                   | Size                                                                                                                                  |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| App Store | iPhone 6.9" screenshots | 1320 × 2868 portrait (an iPhone Pro Max simulator). Smaller iPhones reuse them                                                        |
| App Store | iPad 13" screenshots    | 2064 × 2752 portrait. Needed because `supportsTablet` is `true` in [`app.json`](../app.json)                                          |
| Play      | Phone screenshots       | 2 to 8, PNG or JPEG, long side at most twice the short side; 1080 × 1920 fits. A 1080 × 2400 phone capture doesn't, so crop or pad it |
| Play      | Feature graphic         | 1024 × 500                                                                                                                            |
| Play      | App icon                | 512 × 512 PNG                                                                                                                         |
| Play      | Tablet screenshots      | Optional; only if you want tablet visibility                                                                                          |

The app is portrait only ([`app.json`](../app.json) `orientation`).

## 6. Review notes

### What a reviewer needs

Both stores need a working demo account because Home needs an account. Use an email and password account: Google sign-in only works for listed test users until the consent screen is published ([TODO.md](../TODO.md)), and a Google-only account can't be deleted without signing in with Google again. Confirm the email, finish setup on the account with an age of 18 or more, and log some sample food, water and a workout before submitting.

Paste into App Store Connect → App Review Information, and Play Console → App content → App access:

```text
Demo account
Email: [demo email]
Password: [demo password]

Signing in: on the first screen, tap "I already have an account", choose Log in, and enter the account above. The account's setup is complete, so the app opens on Home.

Steps: on Home, tap the Steps tile, then Connect phone steps. iOS asks for Motion & Fitness access. Android asks for Health Connect step access (on Android 8 to 13, Get Health Connect opens its install page first). The phone's count shows on the tile and is never uploaded.

Saving to Apple Health or Health Connect: Settings → Health → Save to Apple Health (iOS) or Save to Health Connect (Android). The system asks for write access to workouts, body weight and water. Finished workouts with a duration, body-weight entries (Profile) and each day's water total then appear in the Health app or Health Connect. The app asks for write access only and reads no health data.

Barcode scanning: Food → Scan barcode. The camera is used only for barcodes and for profile and progress photos.

Account deletion: Settings → Data & account → Delete account. Enter the account password and type DELETE. This permanently deletes the account. Please create a new account from the sign-in screen (Sign up) if you want to test deletion, so the demo account keeps working for other reviewers. Web deletion page: https://[production origin]/delete-account

The app is for adults 18 and over; setup asks for an age of 18 or more.
```

Sources: [`src/app/onboarding.tsx`](../src/app/onboarding.tsx) ("I already have an account"), [`src/account/entry-policy.ts`](../src/account/entry-policy.ts) `routeDecision`, [`src/steps/summary.ts`](../src/steps/summary.ts), [`src/health/settings.tsx`](../src/health/settings.tsx), [account management](account-management.md).

### Store requirements TODO.md doesn't list yet

TODO.md already has: the Health Connect read and write declarations, store builds, Sign in with Apple, the end-to-end deletion check, publishing the Google consent screen, production email and web hosting, and the `/privacy` placeholders.

Google Play:

- [ ] Closed testing before production. New personal developer accounts must run a closed test with a minimum number of testers for a set number of days before they can apply for production access (12 testers for 14 days when last announced). **Check current Play policy**, and check whether the account is personal or an organization.
- [ ] Fill the Data safety form (section 1).
- [ ] Add the account deletion URL (`/delete-account`) in the Data safety deletion section. It has to work without the app installed.
- [ ] Health apps declaration under App content. **Check current Play policy**.
- [ ] Target audience: 18 and over. Content rating: the IARC questionnaire (section 4).
- [ ] App access: the demo account and instructions above.
- [ ] Ads: No. Advertising ID: No (the 2026-11-05 APK has no `AD_ID` permission; recheck the first app bundle).
- [ ] Privacy policy URL and a contact email on the store listing.
- [ ] Play App Signing: decide whether the current release key becomes the upload key ([Android APK](android-apk.md)).
- [ ] Target API level: the 2026-11-05 APK targets SDK 36. **Check current Play policy** for the minimum.
- [ ] Store listing assets: icon, feature graphic, screenshots.
- [ ] Android developer verification. Google announced identity verification for developers of apps installed on certified Android devices, sideloaded APKs included, rolling out from 2026. **Check current Play policy**; it may also affect the sideloaded `.apk`.

App Store:

- [ ] Fill App Privacy (section 3) and the privacy policy URL.
- [ ] Age rating questionnaire (section 4).
- [ ] Export compliance. [`app.json`](../app.json) already sets `ITSAppUsesNonExemptEncryption` to `false`; the app only uses HTTPS through the OS and hashing. **Check current App Store policy**.
- [ ] Privacy manifest. [`app.json`](../app.json) has no `ios.privacyManifests`, and AsyncStorage and other modules use APIs Apple wants reasons for (such as `UserDefaults`). Check whether the Expo build generates a complete `PrivacyInfo.xcprivacy` or the upload warns. **Check current App Store policy**.
- [ ] iPad. `supportsTablet` is `true`, so App Review runs it on an iPad and wants iPad screenshots. Nothing in TODO.md records an iPad check. Either test the iPad layout or set `supportsTablet` to `false` before the first submission.
- [ ] Support URL (required) and an optional marketing URL.
- [ ] Demo account in App Review Information.
- [ ] HealthKit capability on the App ID for the paid team's signing.
- [ ] Sign in with Apple, once added: account deletion has to revoke the Apple token too. **Check current App Store policy**.
- [ ] EU trader status under the Digital Services Act, if the app is offered in the EU. Play asks a similar question. **Check current Play and App Store policy**.

Both:

- [ ] Fill `[Retention period]` for Sentry from the project's retention setting, and for accounts.
- [ ] Add the Health Connect Limited Use statement to `/privacy`.
- [ ] Make sure the store builds set `EXPO_PUBLIC_SENTRY_DSN`, or change the crash-data answers to "not collected".
- [ ] Update the Data safety form, App Privacy labels and description when Plus billing ships: purchase history, the subscription, and the Plus features.

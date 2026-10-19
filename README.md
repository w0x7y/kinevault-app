# KineVault Track

The React Native and Expo companion to KineVault, for iOS and Android with a web
preview. This repository lives inside `Application/`; the sibling `KineVault/`
studio is maintained separately.

See [module ownership](docs/architecture.md) for the current architecture and
[domain language](CONTEXT.md) for tracking terms.
[TODO.md](TODO.md) is the source for completed work, remaining verification,
and release blockers. Dated [review reports](docs/final-check.md) preserve
evidence from earlier revisions, rather than current status.

## Current foundation

- Home, Food, Exercise, and Settings tabs through Expo Router, in a floating tab bar.
- Compact header with the selected date, a calendar chip that opens a shared
  five-week day picker, and a profile dropdown. The current week stays centered; Settings and Profile have no calendar.
  Dates use the device's local time zone. Selecting Today follows local day
  changes; a deliberately chosen other date stays selected until changed again.
  Profile, Friends, Messages, and KineVault appear above a separator, followed by
  Support and Feedback. Profile opens the personal journal; the other entries
  are disabled and marked Upcoming.
- Daily layouts for nutrition, workouts, steps, water, and five meal sections.
  Home opens with a time-of-day greeting beside a small Kine, then a Calories
  card whose ring shows kcal left, filled with each macro's share, beside the
  macro rows. Carbs use
  honey, protein Kine blue, and fat rose throughout.
  Food and Exercise open with a title and today's total (kcal eaten against
  the goal, or weight lifted and minutes), then search and three labeled
  action tiles. Food shows one card per meal.
  Workout details list completed exercises with sets, reps, and actual weight ranges.
  Food records can be logged to a meal on the selected day. Exercise supports
  user-created exercises, reusable workouts, and multiple workout logs per day.
  Steps shows the phone's step count for the selected day plus any steps logged by
  hand.
- The redesigned look: cool blue-gray surfaces, slate-blue primary actions, 20px
  screen margins, 18px card padding and 14px gaps. See
  [the redesign notes](docs/redesign-2026-10.md).
- Rounded Comfortaa titles, Manrope text and tabular figures, Ionicons outline
  icons, and shared themed components.
- Flows that leave the day view (food details and editing, create/edit forms,
  Daily macros, barcode scan and import, saved workouts, workout import, the live
  workout, manual and completed workouts) open as full-page sheets with a back
  button. Steps inside a flow replace each other on the same page.
- Reanimated motion for presses, sheets, popovers, progress rings and bars, new
  log rows, and the live workout. Reduced motion turns it off.
- System, Light, and Dark appearance, saved locally on the device.
- English copy, metric units, safe-area layout, and scalable text.
- Empty states, a missing-route recovery screen, and root crash recovery with Reload.
- Confirmed offline notices and automatic cloud sync retry after reconnect.
  Optional JavaScript crash reporting is described in [resilience setup](docs/resilience.md).
- Profile body-weight history with dated measurements, editing/removal, and an accessible trend chart. Measurements sync with the profile and do not change calorie or macro goals. See [weight history](docs/weight-history.md).
- Settings reminders for weigh-ins, water, workouts, food, progress photos, and
  custom notes, scheduled as local notifications in the iOS and Android apps.
  Exercise imports a workout template from a Tracked share link; on the web this
  needs the `tracked-workout` Edge Function. See [workout import](docs/workout-import.md)
  and [privacy storage decisions](docs/privacy.md).
- Settings account JSON export includes device/cloud copies and local photos. Account deletion confirms with the password, or a Google sign-in from the last 10 minutes for Google-only accounts, then cleans up this device. The `delete-account` Edge Function allows 5 attempts per account an hour and was deployed on 2026-10-18; the end-to-end check with disposable accounts is still open. See [account management](docs/account-management.md).
- Offline food database search with 5,431 USDA foods, calories and macros per
  100 g, serving weights, and nutrition previews for a custom gram amount.
- Tap Home's Water widget to edit manually logged water in milliliters for the selected day.
  The sheet opens with the current manual amount. Save replaces that amount;
  zero clears manual water. Drinks continue contributing separately to the Home total.
  The -250 ml and +250 ml buttons adjust the draft amount before saving.
  Daily totals combine manual water with saved Drinks volumes and display in liters; failed saves retain the entry for retry.
  Settings offers an editable daily water goal, defaulting to 1,500 ml.
  Previously unset goals use this default. A confirmation appears after saving.
  Home shows a compact cup beside the water amount that fills to the rim;
  totals above the goal remain visible.
  Drinks use one whole amount from 1 to 10,000 ml for nutrition and hydration.
- Home's Steps tile counts the phone's steps for the selected day: Core Motion on
  iOS (the last 7 days) and Health Connect on Android. Phone steps need a native
  build and the user's permission; the web preview and Expo Go on Android show none.
  Tap the tile to connect phone steps or log steps the phone missed, with -500 and
  +500 buttons. Logged steps add to the phone count, stay on this device for the
  signed-in account, and don't sync or appear in the account export yet. See
  [privacy storage decisions](docs/privacy.md).
  Editing or removing a drink updates hydration with the same food-log save.
  Legacy Snacks stay Snacks and have no inferred drink volume.
- Drink search includes named energy drinks and common cola/pepper-style aliases.
  Generic alternatives are labeled; use Scan barcode for an exact product.
- Local food logging to Breakfast, Lunch, Dinner, Snacks, or Drinks, with
  saved gram or beverage volume amounts, editing, removal, and shared daily calorie/macro totals.
  Empty meals say “No food has been logged yet”.
- Create reusable custom foods with a name, serving weight, calories, and macros.
  Foods persist on the device and appear alongside USDA foods in search.
- Create reusable meals from foods and gram amounts, with calculated calories
  and macros that can be overridden. A Food/Meal switch changes the creation form.
- Scan product barcodes, review an editable
  import draft, and save it for offline reuse. Only scanned imports show a barcode badge.
- Daily macros shows calories, carbs, protein, and fat first, then an ordered nutrient list
  for the selected date with gram, milligram, and microgram units.
- First-run onboarding with Kine, resumable local answers, and profile editing.
  Welcome and goals precede the age confirmation. Account screens appear after
  saving the final review. Supabase email/password sign-up, login, confirmation, and
  password recovery are connected, plus Continue with Google. Resend email is capped at
  three confirmation emails per address an hour, sign-up included. Email links must
  carry a PKCE code; token-hash links are refused. An account is required before entering Home.
  Native sessions use encrypted storage; passwords never enter tracking documents.
- Editable calorie estimates for losing, maintaining, or gaining weight.
  Users can skip estimation or set a target manually.
- Editable carb, protein, and fat targets in grams. Automatic targets use
  50%/25%/25% of calories with 4/4/9 kcal per gram. Clear an override to follow
  the calorie target again; zero is an explicit override. Custom grams do not
  change the calorie target.
- Ages 16+. Automatic calorie estimates are for adults; ages 16–17 use a
  custom target agreed with a health professional, or leave it unset.
- Twelve distinct flat 2D Kine poses, quick page transitions, and an animated setup
  progress bar. System reduced-motion preferences are respected.
- Small transparent WebP mascot assets, native memory/disk caching, and
  background prefetching of upcoming poses.

Accounts share Supabase identities with KineVault. Goals, custom exercises, workout
history, food and water logs sync to private account storage. Membership defaults
to Free and has no payment processing. See [Supabase setup](docs/supabase-setup.md)
for email delivery, callback URLs, and future integration details.
KineVault exercise demos are described in [Exercise demos](docs/exercise-demos.md);
the friend's broader program features remain future work.

## Exercise tracking

Create Exercise saves a reusable account definition with a name, optional muscle
group, equipment, and notes. Choose how its sets are tracked: a single weight,
separate left and right sides, alternating sides (reps per side), or timed (seconds,
with a stopwatch or countdown).
Search finds exercises for editing. Results appear only while searching; there
is no exercise-library widget on the daily screen.

Create Workouts saves a named, ordered exercise list. Search for available
exercises above the order list; matching rows load in groups of 20. Set planned
counts from 0 to 100 per exercise; new selections default to three sets. Logging begins
only from a saved workout in the Saved workouts sheet, opened from the tile under
search. Choosing one shows a compact
workout card on the captured selected date. The sheet also provides access to that day's
workout drafts, active workout, and completed logs for editing or removal.
Workout settings inside a compact workout adjusts its counts before Start, without
removing any entered measurements.

Start workout requires a nonblank name; an unnamed draft stays editable until
corrected. It runs the sole active timer. Its start time and
entered sets are saved on the device, so switching tabs, backgrounding, or reopening keeps elapsed
time. Starting opens the live workout on its own page: the running timer, with a
stopwatch, centered in the top bar, then the workout name, a horizontally scrolling
row of exercise chips, and a selected-exercise detail with a sets/reps/weight table
and the exercise's KineVault demo, or a Link demo button. Chips show short names
(initials for long names); accessible labels keep the full names. Add set and View
notes sit beside the exercise name. There is no active name field or date/status
line. Back to Exercise saves the entered sets and leaves the workout running; if
the save fails, the page stays open with Retry draft save. While a workout runs,
the app header shows its timer in the center on every tab, and tapping it opens the
workout; the Exercise tab shows Kine working out with an Open workout button in
place of the day's cards.
End workout sits above a red Discard workout button. Ending
validates and saves the completed workout. Drafts and
active workouts do not contribute to daily totals. A saved workout can also be
logged manually on any selected date, with optional duration in minutes.
Logging has no remove-set or remove-exercise buttons. Entirely blank sets are
skipped when saving completion, so unlogged exercises do not enter daily totals.
Partially entered sets still require valid repetitions and weight.
Saved workout editing and completed workout editing use the same exercise bar
and selected detail. Exercises opens template name/search/order controls, and
Details opens logged name/duration controls. Completed edits stay local until Save changes.
Logged editors show the duration as compact minutes:seconds; unknown or invalid duration
has a short caption, while Details preserves the entered minute text.

Home and Exercise show the workout summary only when that day has an active or
completed workout. An empty day shows a button-only Add workout widget that opens the same
Saved workouts sheet as the tile under search. Home opens this sheet in Exercise
for the selected day. An empty menu says “No workout found. Create a workout to
get started.” There is no separate sessions widget or ad hoc logging flow.

Exercise shows its daily widget only when no search, form, Saved workouts sheet, or workout
editor is open. Storage loading and recovery remain visible.
Selected planned workouts appear as compact cards on their day. An active
workspace retains unsaved fields across searches and calendar changes; leaving its
page or opening another view requires a successful draft save.

Exercise search shares Food's field and result-card styling. It searches from
the first character, shows exercise metadata, and pages results in groups of 20.
Exercises linked to KineVault show a demo poster thumbnail.

Bodyweight uses repetitions and blank kilograms, without inventing lifted body
mass. Left/right sets keep each side's reps and weight, count as one set, and
add both sides' reps and lifted volume. Multiple completed workouts contribute
to Home and Exercise's shared daily totals. Missing manual duration is shown as
not recorded. Library edits and deletions preserve historical exercise snapshots.
Workout changes stay on the captured date, including across midnight. All
exercise data is local and available offline, though KineVault demos need a
connection until the catalog has loaded and each clip has been viewed once;
timed holds and cardio remain future increments.

Delete, remove, and discard buttons use red styling. Their first tap changes
the same button to "Are you sure?"; the second performs the deletion. Leaving
the button cancels confirmation. Failed deletes retain data and offer retry.

Development builds seed Squat, Push-up, and Dumbbell curl once, preserving
existing data. The marker is saved with the exercises so deleted examples do
not return after reopening. Signed-in accounts and production builds do not inject these examples.

The agreed strength/bodyweight Exercise v1 is implemented. The
physical-iPhone workout acceptance is complete according to the user, including
keyboard, scrolling, background/reopen, End, and completed editing. Timed exercises and
cardio with duration/distance belong to a later phase. Previous reps/weights,
workout duplication and a rest timer remain optional
ideas. See [TODO.md](TODO.md) for the current backlog.

## Personal journal Profile

Open Profile from the top-right avatar menu. Overview, Goals, and Photos are
sections inside Profile; Home, Food, Exercise, and Settings remain the four
bottom tabs. Back returns to the previous tab without changing its selected date.
Profile always uses today in the device's local time zone.

Overview shows current and longest streaks, the Sunday–Saturday week containing
today, and workout progress. Saved food/drinks, positive manual water, and
completed workouts count once per day. Current streak can end yesterday while today is still available
to log. Deleted and future records do not count.

Workout charts start with lifted volume over 12 weeks and offer 4, 12, or 52
weeks. Switch to duration or an exercise's heaviest recorded set. Independent
left/right weights remain separate. Missing duration stays unknown or partial;
bodyweight sets do not invent kilograms. The chart groups daily records into
seven-day periods; periods without measurements remain gaps. Selecting a point
shows its values. The chart icon is decorative and opens no measurement list.

Goals shows today's calorie, macro, and combined water intake against saved
targets. Focused editors save personal details, calorie preferences, macro
overrides, and the water goal. Cancel or a failed save preserves saved values.
Editing one section keeps unrelated current answers. The pencil beside the
centered name opens an underlined inline field, with Cancel on the left and Save
on the right. Names are limited to 40 characters. The details chooser also has
a Cancel action.

Choose an avatar or optional progress photos from the library or camera.
Progress photos have an editable date and optional note. Photos presents a
horizontal carousel with dates and separators. Overview automatically shows the
earliest dated photo on the left and the latest on the right, with dates below
both; it has no Add or Compare controls or separate comparison picker. Images
and thumbnails persist in the owned native document directory or browser IndexedDB. Photo metadata uses the separate
`kinevault-track.profile-media.v1` key. Photo metadata is isolated per account on this device; images are not uploaded.
Native supports library and camera; the web preview offers file selection.

See [TODO.md](TODO.md) for current device acceptance and the dated
[Profile review](docs/superpowers/reviews/2026-10-04-profile-personal-journal.md)
for the recorded emulator evidence.

The selected layout is version 3, Personal journal, in the standalone
[layout reference](design/profile-prototype.html).

## Food database

The daily log is displayed once under Food search. Searching filters logged names
without hiding catalog search. Solid food details offer gram amounts, source serving
presets, and a Breakfast, Lunch, Dinner, or Snacks destination for the displayed date.
Drink details have one Drink amount (ml) input, no gram presets or meal picker,
and Log drink to Drinks. Selecting a catalog result dismisses the native keyboard.
Long solid serving lists show 100 g and two source servings initially.
Catalog saves show inline confirmation and add no intake until that action.

Search foods finds both foods and saved meals. Tap Create food or meal, then choose
Food or Meal in the form. In Food mode, choose Solid food or Drink. Solid foods need a name, serving weight in grams, and
calories, carbs, protein, and fat for that serving. All nutrition values are
required; zero and decimal amounts are accepted. Save food stores it locally,
then opens its serving screen with an inline Saved to your foods message. Custom search results show a
small person-and-pen icon beside the name and announce their custom origin to
screen readers. Choose a meal and tap Log food to add it to the
selected day. Cancel discards the unsaved form. Failed saves keep the form for retry.
Changing the selected calendar day preserves an open creation draft. Food names
can be searched in non-English scripts as well as English.

Custom solid foods are normalized to per-100g nutrition for search and have a separate
identity from USDA records. Their entered serving remains selectable. They use
their own versioned storage key, `kinevault-track.custom-foods.v1`, and persist
across restarts. A corrupt or unreadable custom catalog offers Retry custom foods
and blocks creation, while USDA search and existing logged entries remain usable.
More nutrients opens optional fields in the existing g/mg/mcg units. Blank values
remain unknown; entered zero is known. Hiding the fields preserves their values.
Unknown values display Not available in daily totals. Creating foods does not
change the daily log until Log food is used.
Open a custom item from search to use Edit food/meal or Delete food/meal.
Editing opens a prefilled form, saves under the same identity, and updates future
logging and search. Cancel discards changes. Deletion requires confirmation and
removes the item from the catalog. Failed edits and deletes keep the saved item
and offer retry. Calendar changes preserve open catalog-edit drafts. Existing daily log entries and ingredient snapshots in saved
meals keep their names and nutrition when source items are edited or deleted.

In Meal mode, add foods from ingredient search and set each amount in grams.
Calories, carbs, protein, and fat are calculated for the whole collection.
Editing a nutrition value overrides only that value; other values continue to
follow ingredient amounts. Use calculated nutrition clears all overrides.
Save meal stores the ingredients and nutrition locally, opens the serving screen,
and shows Saved to your meals inline. Search foods finds USDA foods, custom foods and saved meals. Both creation
drafts survive switching between Food and Meal or changing the selected day.
One complete meal is its combined ingredient weight, up to 10,000 g. Log meal
can record any gram amount as a single entry in Breakfast, Lunch, Dinner,
or Snacks. Its nutrition and ingredient amounts scale with the logged
portion. Detailed nutrients follow the ingredients, preserving unknown values.
More nutrients supports individual whole-meal overrides. Clear a field to return
that nutrient to its calculated amount, or use the reset button for all detailed overrides.
Meals share the custom-food storage document; existing saved foods remain readable.

Drinks store a per-100ml label basis and have no invented gram weight or serving.
Bundled beverage nutrition converts only literal source US fluid ounce or cup
servings, excluding with-ice and guideline portions. US fl oz is 29.5735295625 ml
and cup is 236.5882365 ml, per [NIST SP 811](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9).
The catalog keeps real gram nutrition for bundled beverages used as ingredients.
Volume-only custom drinks are excluded from ingredient search with conversion guidance.
Ingredient result counts and pages include only foods with gram nutrition, so
unusable drinks cannot leave an empty page or hide selectable foods. A search
matching only volume-based drinks explains the missing gram conversion.
Unknown volume nutrition requires all four label calorie/macro values per 100 ml;
blank nutrients remain unknown and zero is known. New drink log entries explicitly
store volume and nutrition snapshots. Old gram logs remain readable. Editing a
legacy beverage with known ml scales its stored snapshot; missing volume requires
entered ml and a label basis. Legacy Snacks remain Snacks until explicitly edited.

Scan barcode, the first action tile under Food search, opens the camera and manual barcode
entry. It supports EAN/UPC product barcodes, including UPC-E camera expansion,
and excludes QR codes. Camera permission is requested on opening the scanner;
denied or unavailable cameras leave manual entry usable. The camera closes on
tab blur, scanner close, or app background. The camera permission covers barcode
scanning and profile/progress photos. Android audio recording is disabled,
microphone access is blocked, and no iOS microphone permission is declared.

Barcode lookup opens an unsaved food draft with editable name,
brand, macros, and optional nutrients. Saving adds it to local search without
logging it. Saved names and brands support formatting differences and bounded
one-letter typos in eligible words, including ingredient search, entirely offline.
Every query term must match; variant words such as zero and diet remain distinct.
Unknown scanned products offer a blank manual draft. Scan-origin metadata survives edits and reloads; previously saved non-scanned
imports retain their provenance without a barcode badge. Imported records retain visible Open Food Facts
attribution. Missing nutrition stays blank, and products reported by volume require
label nutrition per 100 ml for drinks. Volume packaging alone does not classify a product as a drink; Open Food Facts beverage categories or the editable Drink setting do. Solid foods still need nutrition for a weighed serving.

The Food tab searches a bundled copy of USDA FoodData Central's
[FNDDS 2021-2023](https://fdc.nal.usda.gov/download-datasets/) dietary database,
released October 31, 2024. The 2.70 MB catalog includes 5,431 foods with complete
calorie, carbohydrate, protein, and fat values. One source record, human milk,
has no nutrients and is excluded. Search runs on-device without an API key,
network connection, or hosted backend. Results are paged in groups of 20.

Search accepts partial words and common plurals, and matches words in any
order. Open a solid result to choose a listed serving weight or enter grams. Values
come from USDA's per-100g data and scale to that weight. Calories round to whole
kcal and macros to one decimal for display; calculations retain source precision.
Choose a meal and tap Log food to save the amount to the calendar's selected
day. The meal list and Home totals update after saving succeeds. Removing an
entry updates the same totals. Tap Edit beside a logged food to change its
gram amount or meal. Cancel preserves the saved entry; Save changes replaces
that entry after durable success. Entries persist locally across app restarts;
signed-in accounts also sync these records across devices.

Failed saves and edits retain the amount and meal for retry, and failed removals retain
the entry. A failed or corrupt load shows recovery instead of invented empty
totals. Food records use their own versioned storage key, separate from the
profile and appearance preferences. Resetting the profile leaves food records
intact.

Daily macros uses the calendar's selected date, including past days.
Calories and progress appear first, followed by calories, carbs, protein, fat,
saturated fat, trans fat, fiber, total sugars, sodium, cholesterol, potassium,
calcium, iron, vitamin D, caffeine, and alcohol. Fat subtypes are indented.
The importer retains the source's per-100g nutrient units; Vitamin D's micrograms
are labeled mcg. The pinned FNDDS release omits trans fat, so that value is
unavailable for logged foods. Other absent or invalid source values remain
unknown rather than becoming zero. A daily total is unavailable if any of that
day's entries lacks the value. Empty days display zero intake.

New entries store scaled nutrient snapshots, and editing their amount scales
those values. Older entries without detailed snapshots resolve them from the
bundled food's USDA ID and saved grams. Existing saved snapshots take precedence.

The colored calorie bar retains logged calories for progress toward the goal.
Its category shares use 4 kcal/g for carbs and protein and 9 kcal/g for fat,
normalized to the consumed portion of the bar. Food-source calories may differ
from that estimate. Calories without recorded macros use a neutral fill.

The USDA catalog is a fixed set of foods and prepared dishes, not a live branded-product
or barcode service. USDA food descriptions are in English and retain source
abbreviations such as NFS, meaning not further specified. The
[USDA data license](https://fdc.nal.usda.gov/api-guide/#licensing) is CC0 1.0.
Source attribution, release, download URL, archive SHA-256, and record counts
are stored alongside the foods in `assets/food/usda-fndds.json`.

To rebuild the catalog, use Python 3 and download the pinned official release:

```sh
curl --fail --location --output /tmp/usda-fndds.zip \
  https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip
npm run foods:import -- /tmp/usda-fndds.zip
```

The importer also accepts the extracted USDA JSON file. It validates nutrient
units, excludes missing or invalid macros without inventing zero values,
rejects other releases and duplicate USDA identifiers, and keeps distinct named
portions with positive gram weights. Builds use the committed catalog and need no download.
Python 3 is needed for importer tests; it is available on the Ubuntu CI runner.

## Run locally

Use Node.js 24 LTS (`.nvmrc`) and npm. Install the locked dependencies with `npm ci`.

An account is required before Home, so the app needs the shared Supabase project.
Copy `.env.example` to the ignored `.env.local` and set
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Without
them, account features report unavailable configuration. `EXPO_PUBLIC_SENTRY_DSN`
(crash reporting) is optional, and `EXPO_PUBLIC_TRACK_PARTITIONS` stays `false`
until the history migration ships. Restart Expo after editing the file. See
[Supabase setup](docs/supabase-setup.md).

```sh
npm start
```

Scan the QR code with the iPhone Camera or Expo Go on Android, using an SDK
57-compatible client. For LAN mode, phone and computer must share a network.
If the installed
Expo Go version does not support SDK 57, use a compatible client or development
build. Expo Go on Android can't read phone steps (Health Connect needs a native
build); use the [Android release build](docs/android-apk.md) to check them.

```sh
npm run web       # Browser preview
npm run android   # Connected Android device or emulator
npm run ios       # iOS simulator, requires macOS and Xcode
```

The web preview uses the same screens and components; it does not replace testing
on native devices. No app-store build or EAS project is configured yet; the two
manual workflows below build apps to install directly. The iOS bundle identifier
and Android package are `com.kinevault.track`.

### Native iPhone build with Xcode

To install the app on an iPhone from Xcode, follow [iOS builds with Xcode](docs/ios-xcode.md).
It works with a free Apple ID. The short version, on a Mac with Xcode 26 or newer
and CocoaPods:

```sh
npm ci
npm run ios:prebuild   # generate ios/ from app.json and run pod install
npm run ios:open       # open ios/KineVaultTrack.xcworkspace in Xcode
```

After signing is set up in Xcode, `npm run ios:device` builds a Debug app, installs
it on a connected iPhone, and starts Metro in one command.

Then choose your team under Signing & Capabilities, select the iPhone, and press
Run with `npm start` running for Debug builds. `ios/` is generated and ignored by
Git; change native settings in `app.json` or `plugins/` and run
`npm run ios:prebuild` again.

### Native iPhone build from Linux

Without a Mac, the manual `iOS unsigned build` workflow compiles an unsigned Release
`.ipa` on a GitHub macOS runner, and [xtool](https://github.com/xtool-org/xtool) signs
it with a free Apple ID and installs it over USB. Follow
[iPhone installs from Linux with xtool](docs/ios-linux-xtool.md).

### Android phone install

The manual `Android release build` workflow builds a release `.apk` signed with
the project's release key on a GitHub runner. It reads the signing secrets from the
`android-release` GitHub Environment. Install it with `adb install -r` or by
opening it on the phone. Follow [Android installs](docs/android-apk.md), which also
says where the key lives and why it must not be lost.

### iPhone connection

For a timeout such as “This is taking much longer than it should”:

```sh
npx expo login
npm run start:tunnel
```

Sign into the same Expo account in Expo Go on the iPhone. Physical iOS devices
check the developer account ([Expo CLI authentication](https://docs.expo.dev/more/expo-cli/#authentication)).
Update Expo Go from the App Store if necessary; this app uses SDK 57.
Scan the new terminal QR with the Camera; pasting `exp://` into a browser search
does not open the app. The tunnel bypasses local Wi-Fi routing and firewall
restrictions. The tunnel address changes between sessions.

For local Wi-Fi, use `npm run start:lan` and allow Expo Go's Local Network access
in iOS Settings. Check whether the server is reachable by opening its printed
`http://<computer-IP>:8081/status` address in Safari. A response of
`packager-status:running` confirms connectivity from the phone.

Run `npm run doctor:connection` to inspect the advertised iOS bundle address,
runtime, available network addresses, and Expo sign-in status. Pass a different
port if necessary: `npm run doctor:connection -- 8082`.

The checked-in tunnel dependency makes the command usable after `npm ci`.
Internet access is needed for tunnel mode.

If ngrok fails with `remote gone away` or `session closed`, use the Cloudflare
fallback. Install [cloudflared](https://developers.cloudflare.com/tunnel/downloads/),
then run `npm run start:cloudflare`. The launcher starts both servers, verifies the
public iOS manifest, and prints a secure `exps://` QR code. Keep the terminal open;
Ctrl+C stops both processes. The address is temporary and changes on each launch.
The QR is also saved at `.expo/connection-qr.svg`. You can pass another port with
`npm run start:cloudflare -- 8083` or set `CLOUDFLARED_BIN` to a custom binary path.

### Android emulator keyboard

If tapping a field shows no keyboard, boot the emulator and run:

```sh
npm run android:keyboard
```

This enables the on-screen keyboard alongside computer keyboard input and turns
off stylus handwriting on Android 14+ emulators. A virtual stylus can put Gboard
in handwriting mode and hide the keypad. Tap the field again after running the
command. These settings persist on the emulator; physical phones are untouched.
The command uses `adb` from your Android SDK or PATH.

Age, calorie, and macro fields accept whole numbers. Height and weight allow a decimal
point or comma. Invalid typed or pasted edits are rejected, and you can still
clear a field or leave a decimal separator while typing.

## Verify

`npm run check` runs ESLint, Prettier verification, TypeScript and unit/script
tests. `npm test` and `npm run typecheck` run single steps. Use `npm run format` to format source/tests/scripts and
`npm run lint:fix` for safe lint fixes. ESLint uses the SDK-compatible Expo
configuration; two compiler-specific ref/effect diagnostics are excluded because
React Compiler is not enabled and persisted-draft effects/owner refs are intentional.
`react/no-unescaped-entities` is also off, because native Text renders apostrophes
literally. Hook ordering and effect dependency checks remain enabled.

```sh
npm run check
npx expo-doctor
npm run export:web
npx expo export --platform all --output-dir dist
```

Tests cover appearance, profile record validation, draft resume, staged profile
edits, save/retry ordering, metric input, mascot transparency/resolution/size
budgets, calorie-mode changes, and build-tool UUID buffer bounds and compatibility.
Food tests cover import units and provenance, incomplete records, unique source
IDs, the shipped dataset, ranked search, common plurals, pagination, and serving
calculations. Food-log tests cover date/meal separation, scaled nutrient snapshots,
document validation, save-before-publish, write failure/retry, editing, removal, and stale
reads or writes across restarts. Browser regressions verify search with networking
disabled, gram edits, invalid-amount recovery, visible results after page navigation,
accessible meal selection, past-day logging, reload, Home totals, save/removal
failure recovery, and corrupt-storage recovery.
Macro tests check energy shares, source-calorie progress, exceeded goals, empty
days, and neutral fill. Browser checks verify matching category colors in both
themes, vertical centering, edit cancellation/retry/reload, updated daily macro
totals, and selected-day isolation.
Detailed-nutrition checks cover source-unit validation, missing versus zero
values, serving scaling, persisted snapshots, old-entry lookup, ordered rows,
fat subtype indentation, and both theme layouts.
Controlled clock and wake fixtures verify Selected day rollover, deliberate date
selection, and lifecycle cancellation. Controlled storage verifies Profile recovery,
failed writes, reset ordering, and stale reads across restarts. Completed workout
tests keep totals, exercise rows, and load ranges consistent.
Exercise tests cover strict completed-set validation, raw draft ordering, separate
left/right measurements, historical snapshots, failed completion retries, and
active timer restoration. Browser checks exercise library and workout creation,
manual and timed workouts, completed edits across exercise editing and workout-menu navigation, confirmed
deletion, and independent Home recovery when Food or Exercise storage fails.
Connection checks use local HTTP fixtures for
manifest errors, bundle host rules, HTTPS links, startup retries, and shutdown. Formula assumptions and supported ranges are recorded
in [the onboarding design](docs/superpowers/specs/2026-09-30-kine-onboarding-design.md). The web export produces static routes in `dist/`.
GitHub Actions runs checks and exports independently. The check job also
type-checks the Supabase Edge Functions with Deno, runs Expo Doctor and confirms the
generated iOS entitlements have no push entitlement. The browser job reuses the
web export and runs alongside the check job on pushes and pull requests. Every
workflow pins its actions to commit SHAs.

The suite has 1062 unit and script tests and 171 browser tests. The optional Profile
screenshot case runs only when `KINE_PROFILE_VISUAL_DIR` is set.

For browser checks, install Chromium once with `npx playwright install chromium`.
Start the preview with `npm run web -- --port 8081`, then run `npm run test:browser`
in another terminal. Set `KINE_PREVIEW_URL` if the preview uses a different address.
When it points at a static build, as in CI, set `KINE_DEV_PREVIEW_URL` to the Metro
preview, which serves the test-only fixture bundles. Browser contexts default to reduced motion,
so assertions read settled UI; tests that check motion opt back in.
The runner limits browser files to two at a time to reduce preview startup load.
Suites with a 10-second interaction timeout allow 30 seconds for navigation,
so initial page loads have a separate budget without relaxing interaction checks.
These tests cover draft resume, calorie and macro overrides, canceled edits, switching to
manual targets, age gating, teen setup, onboarding poses, daily tab layouts,
shared calendar selection, responsive widths, Profile recovery and failed resets,
nonempty workout rendering and exercise filtering,
reduced motion, mascot prefetching, and retrying a failed save while editing the
review screen.

Current verification and pending device checks live in [TODO.md](TODO.md).
Dated reports preserve the checks run for their own revisions:

- [Profile verification](docs/superpowers/reviews/2026-10-04-profile-personal-journal.md)
  and [Profile final review](docs/superpowers/reviews/2026-10-04-profile-final-check.md).
- [Saved-workout revision](docs/superpowers/reviews/2026-10-04-saved-workout-revision-review.md)
  and [workout architecture review](docs/superpowers/reviews/2026-10-04-workout-depth-final-check.md).
- [Account and editing review](docs/final-check.md) and
  [dependency remediation evidence](docs/security-remediation.md).

Dependency overrides and local patches are described in
[patch maintenance](patches/README.md). Run `npm audit` to inspect the installed
versions; dated audit counts describe only their recorded revision. Keep patch
regression tests through every Expo upgrade. Do not use `npm audit fix --force`
to downgrade Expo or React Native.

Local storage and sign-out behavior are documented in [privacy storage decisions](docs/privacy.md).
[Language and units](docs/language-and-units.md) records the current English/metric
scope and the future Hebrew/RTL work.

## Structure

The standalone [branding preview](design/branding.html) shows the exported
launcher icons and splash screens. It runs independently of the Expo app.

- `src/app/`: routes and navigation layouts.
- `src/components/ui.tsx`: shared text, panel, titles, and screen.
- `src/components/`: the shared controls. Tappable is every pressable; AppButton,
  IconButton and DeleteButton, SegmentedControl, Chip, TextField, InlineMessage,
  LoadFailure, ModalSheet, `popover.tsx`, SheetPage, IconWell, ViewHeader and the
  round ± Stepper build on it. Use and extend these instead of adding another pressable, field or sheet;
  see [module ownership](docs/architecture.md#shared-controls).
- `src/theme/`: palette, geometry, typography, and appearance persistence;
  `tokens.ts` holds every color, spacing, radius and font.
- `src/profile/answers.ts`: profile vocabulary and editable numeric strings.
- `src/profile/calories.ts`: estimate/manual/teen policy, answer changes, and target source.
- `src/profile/macros.ts`: calculated gram targets and custom overrides.
- `src/profile/activity.ts`: local-date streaks and historical workout graph data.
- `src/profile/media-persistence.ts`: durable avatar/photo metadata and owned-file lifecycle;
  `media-files.ts` and `media-files.web.ts` own native files and browser IndexedDB blobs.
- `src/profile/media-editing.ts`: selection, retained photo drafts, validation, Save,
  removal and temporary-source retirement; `use-media-editing.ts` binds it to React.
- `src/profile/focused-editing.ts`: one Profile section's draft, latest-answer
  merging and validation, built on the shared document edit.
- `src/profile/profile-screen.tsx`: Personal journal composition and editor requests;
  focused goals, charts, photo editors, and automatic progress comparison reuse
  the shared providers.
- `src/calendar/selection.ts`: shared Selected day lifecycle with clock and wake adapters.
- `src/calendar/`: local date arithmetic, centered week grid, and React/platform wiring.
- `src/exercise/`: validated local exercise definitions, ordered workout templates,
  queued workout-log persistence, resumable timers, side-aware totals, and tracking forms.
  `activeWorkout` in `model.ts` is the one lookup of the Active workout.
- `src/exercise/tracking.ts`: what each Tracking mode means: names, set columns, empty
  and blank sets, value entry, hints and measurements.
- `src/exercise/summary.ts`: the completed workout's totals and exercise rows, one
  reading of completed sets.
- `src/exercise/workout-editing.ts`: retained log fields, count safety, save feedback,
  the Set clock and each log mode's controls; `use-exercise-tab-view.ts` binds the
  owners to React.
- `src/exercise/workout-template-draft.ts`: template selection/order, raw counts,
  retained definitions, and ready-to-save preparation for both form layouts.
- `src/exercise/demo/`: KineVault demo catalog parsing, device cache, search, link
  rules, player, and the exercise form section.
- `src/daily/activity.ts`: Daily activity reads every source of the selected day (food,
  Manual water and the Water goal, workouts, Phone steps and Logged steps), each with
  its own availability and retry, and owns nutrition progress, the Home tile wording
  and the journal streak; unavailable sources stay distinct from zero.
- `src/daily/`: daily record types, nutrition summaries, and dashboard widgets.
- `src/exercise/tab-view.ts`: the Exercise tab's panel, query and route requests, and
  where each Workout log and panel goes (on the tab or in a sheet). `src/food/tab-view.ts`
  owns the Food tab's query, page, Logging attempt, Product import flow and Logged food
  entry removal. Both have unit tests.
- `src/persistence/durable-write.ts`: shared read ordering, write exclusion,
  durable publication, and restart recovery for food, catalog, exercise, water, and goal
  records. Each domain retains its own keys, validation, and saved results.
- `src/persistence/document-edit.ts`: shared draft, save and load-retry lifecycle for
  Manual water, Logged steps, Water goal and focused Profile edits; `use-document-edit.ts`
  is its one React adapter.
- `src/persistence/day-amount-log.ts`: the day amount document behind Manual water and
  Logged steps and its edit; `day-amount-sheet.tsx` is the entry sheet both use.
- `src/persistence/document-provider.tsx`: `createDocumentProvider`, which builds
  each tracking document's provider per account scope.
- `src/account/`: Supabase Auth adapter, account controller, account storage and
  cloud sync, export/deletion, and Settings account UI.
- `src/account/entry-policy.ts`: the entry policy, which decides what each route shows
  for the current Account, storage and Profile; `entry-gate.tsx` renders its decisions.
- `src/navigation/track-tabs.ts`: the tab list, the hidden Personal journal tab, which
  screens show the calendar, and typed route requests.
- `src/account/tracking-documents.ts`: the Account tracking document registry. Every
  synced document is listed once with its storage key, parser and Settings name;
  `tracking-provider.tsx` (`AccountTrackingProvider`) mounts them for the tabs.
  Adding a synced document means a key constant, a provider from the factory and
  one registry entry. Never change an existing key; saved data would be orphaned.
- `src/connectivity/`: reachability observations and offline notices.
- `src/reminders/`: reminder settings and local notification scheduling.
- `src/exercise/import/`: Tracked share-link workout import.
- `supabase/`: migrations, SQL tests and the `delete-account` and
  `tracked-workout` Edge Functions.
- `src/water/`: validated local water totals, persistence, and direct Home entry.
- `src/steps/`: phone step counts (`device-steps.ts` with iOS and Android versions),
  the device-only Logged steps document, and the Home step entry.
- `src/food/`: offline catalog search, USDA data adapter, result pages, nutrition
  previews, and local food-log validation, persistence, and React wiring.
  Food search does not filter the daily log.
- `src/food/catalog-selection.ts`: saved/bundled search assembly, current saved-item
  identity and kind, and eligible ingredient paging with volume-only exclusions.
- `src/food/product-import-flow.ts`: Product import request ownership, cancellation,
  retry, and reviewed/manual Catalog draft adoption through an injected lookup.
- `scripts/import-food-catalog.py`: reproducible import of USDA FNDDS nutrition
  and serving weights. Source data and provenance live in `assets/food/`.
- `src/profile/model.ts`: stored document parsing and legacy age recovery.
- `src/profile/persistence.ts`: storage lifecycle, durable saves, reset, and recovery.
- `src/profile/provider.tsx`: Profile document provider, built with `createDocumentProvider`.
- `src/onboarding/flow.ts`: setup transitions, validation, staged edits, and save ordering.
- `src/onboarding/`: Kine artwork, form controls, and question content.
- `assets/mascot/2d/`: optimized page poses, source artwork, and exact generation prompts.
- `scripts/optimize-mascot.mjs`: reproducible mascot compression; see the [artwork notes](assets/mascot/README.md).
- `src/components/motion.tsx`: reduced-motion policy, shared curves and durations,
  and entrance, layout, progress and step helpers. Native Reanimated needs these
  `cubicBezier()` curves; CSS timing strings crash on a phone.
- `scripts/expo-connection.ts`: shared manifest checks and cancelable readiness; Node 24+ runs it directly.
- `scripts/expo-connect.mjs`: Expo Go connection diagnostics.
- `scripts/publish-catalog.mjs`: mirrors published KineVault exercises into the hosted
  project; dry run by default. Run it with `npm run catalog:publish`; see
  [Exercise demos](docs/exercise-demos.md).
- `scripts/validate-demo-catalog-postgres.sh`: SQL checks on a private cluster.
- `plugins/`: local Expo config plugins for the generated native projects (iOS local-only
  notification entitlements and scene life cycle, Android Gradle memory for release
  builds); see [iOS builds with Xcode](docs/ios-xcode.md).
- `vercel.json`: web export hosting and security headers, including a CSP that limits
  scripts and connections; `tests/web-headers.test.ts` checks it.
- `CONTEXT.md`: domain vocabulary for accounts, profile, daily activity, food,
  exercise, water, reminders, and onboarding.
- `DESIGN.md`: supplied KineVault design reference. For Track's look, the
  [redesign notes](docs/redesign-2026-10.md) win where the two disagree.
- `PRODUCT.md`: confirmed product scope.
- `TODO.md`: completed work, outstanding verification, and future/optional work.

The [import, Daily activity, and persistence depth contract](docs/superpowers/specs/2026-10-02-import-daily-persistence-depth.md)
records the behavior and test seams preserved by the latest architecture work.

Future tracking features should use the existing theme and components and keep
their domain logic outside route files. Changes to shared design rules should be
coordinated with the KineVault studio.

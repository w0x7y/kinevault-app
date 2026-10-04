# KineVault Track

The React Native and Expo companion to KineVault, for iOS and Android with a web
preview. This repository lives inside `Application/`; the sibling `KineVault/`
studio is maintained separately.

## Current foundation

- Home, Food, Exercise, and Settings tabs through Expo Router.
- Compact header with a profile dropdown and shared five-week day picker.
  The current week stays centered; Settings has no calendar.
  Dates use the device's local time zone. Selecting Today follows local day
  changes; a deliberately chosen other date stays selected until changed again.
  Profile, Friends, Messages, and KineVault appear above a separator, followed by
  Support and Feedback. Each entry opens a coming-soon panel.
- Daily layouts for nutrition, workouts, steps, water, and five meal sections.
  Kine uses the same even split and size beside Home macros, Food/Exercise
  action buttons, and the Settings title. Macro counts sit beside their labels.
  A full-width calorie count and progress bar sit below Home’s macro/Kine row.
  Carbs use amber, protein blue, and fat purple in the macro breakdown and
  stacked calorie bar. The macro rows center vertically beside Kine.
  Food and Exercise place their search fields below their action/Kine rows.
  Workout details list completed exercises with sets, reps, and actual weight ranges.
  Food records can be logged to a meal on the selected day. Exercise supports
  user-created exercises, reusable workouts, and multiple workout logs per day.
  Steps remain empty until their logging is implemented.
- Shared 12px screen margins, panel padding, and gaps across tabs and onboarding.
- Comfortaa typography, Font Awesome 6 icons, and shared themed components.
- System, Light, and Dark appearance, saved locally on the device.
- English copy, metric units, safe-area layout, and scalable text.
- Empty states and a missing-route recovery screen.
- Offline food database search with 5,431 USDA foods, calories and macros per
  100 g, serving weights, and nutrition previews for a custom gram amount.
- Tap Home's Water widget to edit manually logged water in millilitres for the selected day.
  The popup opens with the current manual amount. Save replaces that amount;
  zero clears manual water. Drinks continue contributing separately to the Home total.
  The -250 ml and +250 ml buttons adjust the draft amount before saving.
  Daily totals combine manual water with saved Drinks volumes and display in litres; failed saves retain the entry for retry.
  Settings offers an editable daily water goal, defaulting to 1,500 ml.
  Previously unset goals use this default. A confirmation appears after saving.
  Home shows a compact cup beside the water amount that fills to the rim;
  totals above the goal remain visible.
  Drinks use one whole amount from 1 to 10,000 ml for nutrition and hydration.
  Editing or removing a drink updates hydration with the same food-log save.
  Legacy Snacks stay Snacks and have no inferred drink volume.
- Drink search includes named energy drinks and common cola/pepper-style aliases.
  Generic alternatives are labelled; use Scan for an exact product.
- Local food logging to Breakfast, Lunch, Dinner, Snacks, or Drinks, with
  saved gram or beverage volume amounts, editing, removal, and shared daily calorie/macro totals.
  Empty meals say “No food has been logged yet”.
- Create reusable custom foods with a name, serving weight, calories, and macros.
  Foods persist on the device and appear alongside USDA foods in search.
- Create reusable meals from foods and gram amounts, with calculated calories
  and macros that can be overridden. Food/Meal buttons switch creation forms.
- Scan product barcodes, review an editable
  import draft, and save it for offline reuse. Only scanned imports show a barcode badge.
- View macros for the day shows calories, carbs, protein, and fat first, then an ordered nutrient list
  for the selected date with gram, milligram, and microgram units.
- First-run onboarding with Kine, resumable local answers, and profile editing.
  Welcome and goals precede the age confirmation.
- Editable calorie estimates for losing, maintaining, or gaining weight.
  Users can skip estimation or set a target manually.
- Editable carb, protein, and fat targets in grams. Automatic targets use
  50%/25%/25% of calories with 4/4/9 kcal per gram. Clear an override to follow
  the calorie target again; zero is an explicit override. Custom grams do not
  change the calorie target.
- Ages 16+. Automatic calorie estimates are for adults; ages 16–17 use a
  custom target agreed with a health professional, or leave it unset.
- Eleven distinct flat 2D Kine poses, quick page transitions, and an animated setup
  progress bar. System reduced-motion preferences are respected.
- Small transparent WebP mascot assets, native memory/disk caching, and
  background prefetching of upcoming poses.

Accounts, video playback,
and KineVault integration are not implemented in this phase.

## Exercise tracking

Create Exercise saves a reusable local definition with a name, optional muscle
group, equipment, and notes. Choose single-load or separate left/right tracking.
Search finds exercises for editing. Results appear only while searching; there
is no exercise-library widget on the daily screen.

Create Workouts saves a named, ordered exercise list. Logging begins only from
a saved workout in the menu beside search. Choosing one opens a workout draft
on the captured selected date. The menu also provides access to that day's
workout drafts, active workout, and completed logs for editing or removal.

Start workout runs the sole active timer. Its start time and entered sets are
saved on the device, so switching tabs, backgrounding, or reopening keeps elapsed
time. Finish workout validates and saves the completed workout. Drafts and
active workouts do not contribute to daily totals. A saved workout can also be
logged manually on any selected date, with optional duration in minutes.

Home and Exercise show the workout summary only when that day has an active or
completed workout. An empty day instead explains how to use the workout menu
or create a workout. There is no separate sessions widget or ad hoc logging flow.

Bodyweight uses repetitions and blank kilograms, without inventing lifted body
mass. Left/right sets keep each side's reps and weight, count as one set, and
add both sides' reps and lifted volume. Multiple completed workouts contribute
to Home and Exercise's shared daily totals. Missing manual duration is shown as
not recorded. Library edits and deletions preserve historical exercise snapshots.
Workout changes stay on the captured date, including across midnight. All
exercise data is local and available offline; timed holds and cardio remain
future increments.

Development builds seed Squat, Push-up, and Dumbbell curl once, preserving
existing data. The marker is saved with the exercises so deleted examples do
not return after reopening. Production builds do not inject these examples.

## Food database

The daily log is displayed once under Food search. Searching filters logged names
without hiding catalog search. Solid food details offer gram amounts, source serving
presets, and a Breakfast, Lunch, Dinner, or Snacks destination for the displayed date.
Drink details have one Drink amount (ml) input, no gram presets or meal picker,
and Log drink to Drinks. Selecting a catalog result dismisses the native keyboard.
Long solid serving lists show 100 g and two source servings initially.
Catalog saves show inline confirmation and add no intake until that action.

Search foods finds both foods and saved meals. Tap Create food/meal, then choose
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

The barcode button on the right of Food search opens the camera and manual barcode
entry. It supports EAN/UPC product barcodes, including UPC-E camera expansion,
and excludes QR codes. Camera permission is requested on opening the scanner;
denied or unavailable cameras leave manual entry usable. The camera closes on
tab blur, scanner close, or app background. The expo-camera plugin declares a
food-barcode camera permission, disables Android audio recording, blocks its
microphone permission, and omits the iOS microphone permission. Camera capture
still needs real-device verification on iOS and Android.

Food has two search-row controls: offline Search and barcode Scan, with a 75/25
width split. Barcode lookup opens an unsaved food draft with editable name,
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
there is no account or cross-device sync.

Failed saves and edits retain the amount and meal for retry, and failed removals retain
the entry. A failed or corrupt load shows recovery instead of invented empty
totals. Food records use their own versioned storage key, separate from the
profile and appearance preferences. Resetting the profile leaves food records
intact.

View macros for the day uses the calendar's selected date, including past days.
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

Use Node.js 24 LTS and npm. Install the locked dependencies with `npm ci`.

```sh
npm start
```

Scan the QR code with the iPhone Camera or Expo Go on Android, using an SDK
57-compatible client. For LAN mode, phone and computer must share a network.
If the installed
Expo Go version does not support SDK 57, use a compatible client or development
build. No backend credentials are needed for this foundation.

```sh
npm run web       # Browser preview
npm run android   # Connected Android device or emulator
npm run ios       # iOS simulator, requires macOS and Xcode
```

The web preview uses the same screens and components; it does not replace testing
on native devices. No app-store build, application identifier, or EAS project is
configured yet.

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
Internet access is needed for tunnel mode; app profile data still stays local.

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

```sh
npm run check
npx expo-doctor
npm run export:web
npx expo export --platform ios --platform android --output-dir dist-native
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
GitHub Actions runs these checks and the browser regressions on pushes and pull requests.

For browser checks, install Chromium once with `npx playwright install chromium`.
Start the preview with `npm run web -- --port 8081`, then run `npm run test:browser`
in another terminal. Set `KINE_PREVIEW_URL` if the preview uses a different address.
The runner limits browser files to two at a time to reduce preview startup load.
Suites with a 10-second interaction timeout allow 30 seconds for navigation,
so initial page loads have a separate budget without relaxing interaction checks.
These tests cover draft resume, calorie and macro overrides, canceled edits, switching to
manual targets, age gating, teen setup, onboarding poses, daily tab layouts,
shared calendar selection, responsive widths, Profile recovery and failed resets,
nonempty workout rendering and exercise filtering,
reduced motion, mascot prefetching, and retrying a failed save while editing the
review screen.

The October 4, 2026 Exercise increment passed TypeScript with unused-code checks,
463 unit tests, and all 100 browser scenarios. The full browser run passed 99;
its remaining layout test used an obsolete expectation that Exercise creation
buttons were disabled and passed after that assertion was updated. Web, iOS,
and Android bundle exports passed. Native keyboard, app backgrounding, and
screen-reader interactions still need a device or simulator check.

The saved-workout-only revision passed 476 unit tests, TypeScript with unused-code
checks, and all 103 browser scenarios. The full run passed 102; its remaining
captured-date test was corrected to include the calendar's existing “today”
accessible-label suffix and passed on rerun. Web/iOS/Android exports passed.
Independent UI, domain, and final reviews passed. See the
[revision review](docs/superpowers/reviews/2026-10-04-saved-workout-revision-review.md)
for the exact verification evidence and native-device limits.

The October 1, 2026 final check passed TypeScript, including unused-code checks,
84 unit tests, 15 browser tests, Expo Doctor's 21 checks, the 11-route static web
export, and iOS/Android bundle exports. Browser checks cover 320, 390, and 1280px
widths in both themes. Native keyboard, gestures, safe areas, text scaling, and
screen-reader behavior still need testing on a native device or simulator.
See [the architecture contract](docs/superpowers/specs/2026-10-01-architecture-refactor-design.md)
for module ownership and lifecycle rules.

The food database increment passed 98 unit tests, all 16 browser tests,
TypeScript with unused-code checks, and web, iOS, and Android bundle exports.
Reimporting the pinned USDA archive reproduced the committed catalog byte for
byte. Native serving controls and keyboard interaction still need device testing.

The food-logging and layout increment passed 108 unit tests, all 18 browser tests,
TypeScript with unused-code checks, and web, iOS, and Android bundle exports.
Browser checks verify empty-meal labels, the Kine-first layout, meal selection,
durable past-day logging, shared totals, removal, and failure recovery.
Native logging controls and screen-reader behavior still need device testing.

The macro-view and food-editing increment passed 114 unit tests, all 20 browser
tests, TypeScript with unused-code checks, and web, iOS, and Android bundle exports.
Native editing and keyboard behavior still need device testing.

The detailed-nutrition increment passed 120 unit tests, all 21 browser tests,
TypeScript with unused-code checks, and web/iOS/Android bundle exports. Reimporting
the pinned archive reproduced the expanded catalog byte for byte.

The October 2, 2026 dependency audit reports seven affected package entries:
four high and three moderate, representing two advisory chains. No critical
findings were reported. These are installed dependency findings; a working
application exploit was not demonstrated in this review.

The high-severity chain is `expo` → `@expo/cli` →
`@expo/code-signing-certificates` / `node-forge` 1.4.0. The
[RSA signature-verification advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
affects versions through 1.4.0; no patched release was available at review time.
Expo tooling calls the affected verifier when validating code-signing certificates
and checking generated signatures. The app source does not import this library,
and no update-signing configuration is enabled. This does not establish that
the tooling is safe. Update the compatible Expo toolchain when an upstream fix
is available; the audit's proposed Expo 44 downgrade is unsuitable for SDK 57.

The moderate-severity chain is:
`expo-router` → `query-string` → `decode-uri-component`. The decoder has a
[malformed-input denial-of-service advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
Its fixed version, 0.5.0, is ESM; the installed `query-string` 7 calls it through
CommonJS as a function. A decoder-only override would break URL parsing, and
newer `query-string` versions also change the export interface used by Router.
The current Expo linking parser uses `URL.searchParams`; no reachable use of the
vulnerable decoder was confirmed in this app. The dependency advisory remains
open. An isolated compatibility check of the fixed decoder under query-string 7
failed with `decodeComponent is not a function`.
This needs a compatible Router update or a separately validated dependency patch. Do not use
`npm audit fix --force`, which proposes an incompatible Router downgrade.

Scoped overrides give the Xcode and Expo tunnel tools `uuid` 11.1.1, fixing
[UUID output-buffer validation](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
while retaining their CommonJS `v4()` calls. Tests check both consumers and Xcode
project identifier generation. Keep the overrides until upstream dependencies
include the fix.

## Structure

The standalone [branding preview](design/branding.html) shows the exported
launcher icons and splash screens. It runs independently of the Expo app.

- `src/app/`: routes and navigation layouts.
- `src/components/ui.tsx`: shared text, panel, screen, and destination link.
- `src/theme/`: palette, geometry, typography, and appearance persistence.
- `src/profile/answers.ts`: profile vocabulary and editable numeric strings.
- `src/profile/calories.ts`: estimate/manual/teen policy, answer changes, and target source.
- `src/profile/macros.ts`: calculated gram targets and custom overrides.
- `src/calendar/selection.ts`: shared Selected day lifecycle with clock and wake adapters.
- `src/calendar/`: local date arithmetic, centered week grid, and React/platform wiring.
- `src/daily/workout.ts`: one interpretation of completed sets for totals and exercise rows.
- `src/exercise/`: validated local exercise definitions, ordered workout templates,
  queued workout-log persistence, resumable timers, side-aware totals, and tracking forms.
- `src/daily/activity.ts`: selected-day food availability, combined manual/Drink
  water availability, completed workout totals, and goal progress; unavailable
  sources stay distinct from zero.
- `src/daily/`: daily record types, nutrition summaries, and dashboard widgets.
- `src/persistence/durable-write.ts`: shared read ordering, write exclusion,
  durable publication, and restart recovery for food, catalog, exercise, water, and goal
  records. Each domain retains its own keys, validation, and saved results.
- `src/water/`: validated local water totals, persistence, and direct Home entry.
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
- `src/profile/provider.tsx`: React subscription and AsyncStorage adapter.
- `src/onboarding/flow.ts`: setup transitions, validation, staged edits, and save ordering.
- `src/onboarding/`: Kine artwork, form controls, and question content.
- `assets/mascot/2d/`: optimized page poses, source artwork, and exact generation prompts.
- `scripts/optimize-mascot.mjs`: reproducible mascot compression; see the [artwork notes](assets/mascot/README.md).
- `src/components/motion.tsx`: reduced-motion preferences and setup transitions.
- `scripts/expo-connection.ts`: shared manifest checks and cancelable readiness; Node 24+ runs it directly.
- `scripts/expo-connect.mjs`: Expo Go connection diagnostics.
- `CONTEXT.md`: profile, daily activity, and onboarding domain vocabulary.
- `DESIGN.md`: supplied KineVault design reference, preserved as shared authority.
- `PRODUCT.md`: confirmed product scope.

The [import, Daily activity, and persistence depth contract](docs/superpowers/specs/2026-10-02-import-daily-persistence-depth.md)
records the behavior and test seams preserved by the latest architecture work.

Future tracking features should use the existing theme and components and keep
their domain logic outside route files. Changes to shared design rules should be
coordinated with the KineVault studio.

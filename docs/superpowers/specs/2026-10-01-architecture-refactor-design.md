# Architecture contract

This is the historical October 1 contract. Later account ownership and cloud
tracking supersede its local-only scope; see [current architecture](../../architecture.md)
and [shared account setup](../../supabase-setup.md).

Updated October 1, 2026 after both accepted architecture reviews and the final
check. This contract covers the implemented onboarding, calorie policy, Expo
connection checks, Selected day lifecycle, completed-workout interpretation,
Profile persistence, and local food logging.

English, metric units, local profile version 1, minimum age 16, and the current
[product scope](../../../PRODUCT.md) remain the product contract. The app has
no hosted logging service, accounts, backend, or sync. Food can be logged locally
to a meal on the Selected day. Workouts, steps, and water remain empty in
production; nonempty workout data exists only in test fixtures.

## Onboarding and targets

`src/onboarding/flow.ts` owns navigation, per-step validation, review return,
staged profile edits, pending-write exclusion, and save-before-navigation.
`createOnboardingFlow` exposes a stable snapshot, subscription, answer updates,
and actions. React handles subscriptions; the screen handles focus,
announcements, keyboard avoidance, and rendering. Welcome and goals precede
age confirmation, followed by name, body, activity, calories/macros, and review.

`src/profile/calories.ts` owns changes affecting estimate eligibility, opting
in/out, teen transitions, custom-target retention, and target source. Screen
callers submit intentions instead of mutating related flags. Numeric inputs
retain their transient strings while being edited. Ages 16–17 use manual or
unset targets; the adult formula and supported ranges are recorded in
[the onboarding design](2026-09-30-kine-onboarding-design.md).

`src/profile/macros.ts` derives grams from the active calorie target using
50% carbs, 25% protein, and 25% fat with 4/4/9 kcal per gram. Individual custom
grams override calculation without changing calories. Zero is an override;
clearing a value restores calculation. Shared validation enforces whole grams
and supported bounds. Version-1 records missing macro fields gain empty
strings and retain their saved calorie target. Legacy completed profiles with
unsupported ages return to the age question while preserving their answers.

## Selected day

`src/calendar/selection.ts` owns the Selected day lifecycle. `createSelectedDay`
accepts a clock/scheduler and wake subscription, and exposes `getSnapshot`,
`subscribe`, `selectDay`, `start`, and `stop`. Construction acquires no timers
or event listeners. Starting acquires one timer and wake listener; stopping
releases them, and restarting preserves selection and subscriptions.

Today means the current device-local date. A selection following Today advances
at local midnight or when waking after skipped days. A deliberately selected
other date remains selected even when it later becomes Today. Explicitly
selecting Today resumes following. Invalid date identifiers are rejected;
callbacks from canceled timers or earlier lifecycles cannot publish.

`src/calendar/provider.tsx` supplies React subscriptions and platform adapters
for timers, native AppState, and web visibility. Its existing `useSelectedDay`
interface is retained. The shared header renders seven weekday columns and
five week rows, with the current week centered. Home, Food, and Exercise share
selection; Settings omits the picker.

## Daily activity and completed workouts

`src/daily/use-day.ts` combines the Selected day's saved food with empty workout,
step, and water records, then derives its summary. Home and Food withhold food
totals and meal records until storage is ready; failed loads show recovery.

`src/daily/workout.ts` interprets completed sets once. `interpretWorkout`
returns one `CompletedWorkout` containing total weight × repetitions, duration,
set and rep totals, average reps per completed set, and completed exercise rows.
Each row contains its own volume, sets, reps, and Bodyweight, single-weight, or
weight-range classification. Planned sets and exercises with no completed sets
are excluded. A missing session and a logged empty session keep distinct names
and durations.

`summarizeDay` combines nutrition totals with that workout interpretation.
Home and Exercise pass the coherent workout value to `WorkoutWidget`; callers
cannot supply separate raw-session and summary values. Exercise search filters
only rendered exercise rows, leaving session totals unchanged. No duplicate
completion filter or obsolete flat workout-summary API remains.

## Food catalog and local logging

`src/food/catalog.ts` owns offline search, ranking, paging, gram validation, and
nutrition scaling. The bundled USDA FNDDS catalog retains per-100g values and
source serving weights. Its pinned, validated importer and provenance are
documented in [README.md](../../../README.md).

`src/food/log-model.ts` validates version-1 food logs at the storage boundary.
Each date holds entries with a unique ID, source food ID, description, meal,
grams, and scaled nutrition snapshot. Dates, meals, IDs, amounts, and finite
nonnegative nutrients are checked. Display rounding does not change stored totals.

`src/food/log-persistence.ts` owns loading, retry, add, remove, and lifecycle
cancellation behind an injected storage adapter. Construction is inert;
snapshots and subscriptions are stable. Only one write runs at a time. Changes
publish after durable success; failures preserve saved entries and allow retry.
Older reads cannot overwrite newer loads. Restart waits for any uncancelable
write before reloading its durable result.

`src/food/log-provider.tsx` supplies React subscriptions and AsyncStorage within
the shared tab layout. Its storage key is independent of Profile reset.
Logging captures the selected date, food, amount, and meal before saving.
Changing dates or unmounting cannot navigate a newer screen after an old save.
Failed saves preserve the form draft; invalid amounts cannot be submitted.
Removal is scoped to an entry on its date. Successful changes update both meal
rows and Home nutrition through the shared food-log subscription.

Editing is also scoped to an entry ID and date. It rescales that entry's saved
nutrition snapshot to the new gram amount and replaces its meal without changing
identity or consulting a newer catalog release. Missing targets never create an
entry. Edits share write exclusion, validation, durable publication, and failure
recovery with add/remove. The common nutrition form uses an add/edit discriminant
and keeps unsaved amount and meal choices separate from the persisted entry.

`src/daily/nutrition.ts` defines macro categories and calorie-bar shares.
Progress length follows source calories and the calorie goal, clamped to the
track. Colored shares use normalized 4/4/9 kcal-per-gram estimates, with a neutral
fallback for calories without macros. Theme tokens supply category colors in
both appearances. The Home macro panel centers its rows vertically.
`src/food/daily-macros.tsx` uses the shared daily summary and target policy for
calorie totals, progress, and the ordered detailed-nutrient list. It reads the same Selected day and saved
entries as Home and the meal log.

`src/food/nutrients.ts` defines detailed nutrient keys and display units. The
importer keeps source values separately from the required calories/macros;
missing or invalid details are null. Microgram aliases normalize to mcg, while
Vitamin D in IU is not silently accepted. `nutritionForGrams` copies scaled
details into new entries; `nutritionForEntry` rescales them during edits.
The version-1 food-log parser accepts older entries without details, validates
new numeric/null fields, and copies them canonically before durable writes.

`src/daily/detailed-nutrition.ts` sums saved detail snapshots. Older entries can
resolve per-100g details through catalog lookup by USDA ID and scale by saved
grams; existing snapshots remain authoritative. A missing value in any entry
makes the corresponding day's total unavailable. Empty days have zero intake.
The pinned FNDDS release does not provide trans fat.

## Profile persistence and recovery

`src/profile/persistence.ts` owns storage loading, retry, save, reset, and
lifecycle cancellation behind the `ProfileStorage` adapter. Construction is
inert. `createProfilePersistence` exposes a stable snapshot/subscription and
stable `start`, `stop`, `retryLoad`, `save`, and `reset` methods.

One write can run at a time. Save validates and copies the version-1 document
before writing, publishes the canonical Profile only after durable success,
and returns success only for its current lifecycle. Failed writes preserve
the prior Profile and expose a retryable error. Retry cannot overlap a write.
Reset clears only the Profile storage key before publishing fresh setup;
failed reset retains existing data. Reset from failed loading requires the
existing in-app confirmation.

Older reads and callbacks cannot overwrite a newer load or restarted lifecycle.
Storage writes cannot be canceled, so a restart waits for an outstanding write
and then reloads its durable result. React's provider handles subscriptions and
supplies AsyncStorage. The public `useProfile` fields remain unchanged; stable
save callbacks can safely be captured by the onboarding flow. Appearance keeps
its own independent storage policy.

## Expo connection checks

`scripts/expo-connection.ts` owns iOS manifest interpretation, HTTP/exps scheme
choice, loopback detection, expected-origin validation, bounded retries, and
cancellation. The doctor and Cloudflare launcher share it. The launcher's child
process ownership remains in its script; shutdown aborts readiness promptly.
Tests use local HTTP fixtures, with no running public tunnel needed.

## Verification and limits

Controlled clock/wake fixtures cover midnight, skipped days, daylight saving,
selection intent, cancellation, and restart. Controlled storage covers failed
loads/writes/resets, recovery, write exclusion, canonical copying, and stale
results. Completed-workout tests and an isolated Metro browser fixture cover
nonempty totals, planned-set exclusion, load ranges, and row-only filtering.

The final check passed 84 unit tests, 15 browser tests, TypeScript with unused
checks, Expo Doctor 21/21, the 11-route static web export, and iOS/Android exports.
Every changed subsystem and final cleanup received independent review. Native
device behavior remains outside bundle-export verification.

The later food-logging and layout increment passed 108 unit tests, 18 browser
tests, TypeScript with unused-code checks, and web/iOS/Android exports. Controlled
storage covers date/meal separation, scaled nutrition, validation, write failure,
removal, retry, and restart ordering. Browser tests cover past-day logging and
reload, shared Home totals, failed save/removal recovery, corrupt loads, empty
meal labels, Kine-first layout, and accessible meal selection. Independent
review found a missing web selection state. Meal buttons now expose their
pressed state, with a browser regression covering Space-key selection and the
chosen meal.

The macro-view and food-editing increment passed 114 unit tests, 20 browser tests,
TypeScript with unused-code checks, and web/iOS/Android exports. Tests cover
identity/date preservation, amount scaling, meal moves, failed and pending edits,
invalid targets, calorie share math, category colors, vertical centering, cancel,
retry, reload, and selected-day macro totals. Native editing and keyboard behavior
remain outside bundle-export verification.

The detailed-nutrition increment passed 120 unit tests, 21 browser tests,
TypeScript with unused-code checks, and web/iOS/Android exports. Unit tests
cover source units, unknown versus zero, saved/scaled detail snapshots, old-entry
lookup, and incomplete daily totals. Browser tests cover all requested labels
and units in order, calories above the list, indented fat subtypes, real serving
totals, edited snapshots, old entries, empty days, and phone/desktop layouts in
both themes. Reimporting the pinned archive reproduced the expanded catalog.

The dependency audit reports three moderate package entries for one existing
Router decoder advisory. No reachable use of that decoder was confirmed in the
configured Expo linking parser. A direct patched-decoder override breaks
query-string 7 compatibility; retain the disclosed limitation until a compatible
upstream fix or separately validated dependency patch is available. Details
and the advisory link are in [README.md](../../../README.md).

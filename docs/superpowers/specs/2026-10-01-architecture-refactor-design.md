# Architecture contract

Updated October 1, 2026 after both accepted architecture reviews and the final
check. This contract covers the implemented onboarding, calorie policy, Expo
connection checks, Selected day lifecycle, completed-workout interpretation,
and Profile persistence.

English, metric units, local profile version 1, minimum age 16, and the current
[product scope](../../../PRODUCT.md) remain the product contract. The app has
no logging service, accounts, backend, or sync. The selected day's activity is
empty in production; nonempty workout data exists only in test fixtures.

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

`src/daily/use-day.ts` maps the Selected day to an empty activity record and its
summary. It intentionally has no persistence or logging adapter.

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

The dependency audit reports three moderate package entries for one existing
Router decoder advisory. No reachable use of that decoder was confirmed in the
configured Expo linking parser. A direct patched-decoder override breaks
query-string 7 compatibility; retain the disclosed limitation until a compatible
upstream fix or separately validated dependency patch is available. Details
and the advisory link are in [README.md](../../../README.md).

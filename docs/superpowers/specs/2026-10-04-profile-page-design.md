# Profile page design

Status: implemented. The user selected version 3, Personal journal, from the
three-layout prototype on October 4, 2026. Android emulator photo acceptance
passed; the new physical-iPhone photo flow remains to verify separately.

## Purpose and agreed scope

Profile gives the user one place to see their identity, tracking consistency,
workout progress, saved goals, today's intake, and optional progress photos.
It is a personal, on-device feature for the existing Expo companion app.

The user confirmed:

- Open Profile through the existing top-right Profile menu entry. Keep the four
  bottom tabs.
- Choose profile and progress photos from the photo library or camera, with
  replacement/removal controls. Show the profile photo in the shared avatar.
- Count consecutive days containing saved food, water, or a completed workout.
  Show current and longest streaks. The displayed calendar week starts Sunday.
- Show lifting progress, such as lifted volume, selected-exercise weights, and
  total workout duration, rather than an activity calendar.
- Show saved calorie, macro, water, and weight-direction goals plus today's
  intake/progress. Edit individual profile sections directly.
- Include an optional dated progress-photo carousel, notes, and deletion.
  Overview shows the earliest and latest saved photos. The subsequent revision
  removes arbitrary two-photo selection and its comparison viewer.
- Store the feature on the device. Account backup/sync belongs to a later phase.

The existing physical-iPhone workout verification and general native
interaction/accessibility verification are complete according to the user.
TODO.md records that correction. This does not verify the new Profile feature.

## Approaches considered

1. Extend the existing Settings profile summary. This reuses its layout but mixes
   personal progress and settings, and does not give the menu destination its own
   page.
2. Add a dedicated Profile page using the existing shared data providers and
   design system. This fits the requested entry point and keeps today's progress,
   history, and editing connected to the same saved records. Recommended.
3. Add a new account/profile subsystem with cloud photo storage. This would add
   authentication, hosting, and sync decisions beyond the agreed local scope.

## Page structure and navigation

Use a dedicated /profile route within the shared provider scope, hidden from the
bottom tab destinations. Icons, labels, and tab bar dimensions stay consistent
when entering Profile. The menu entry navigates to this page instead of its
coming-soon panel. Return navigation restores the originating screen. Profile
does not show a calendar picker or change the shared selected date.

Preserve the existing Comfortaa typography, Font Awesome icons, semantic
light/dark theme, macro colors, 12px layout spacing, and shared panels/buttons.
The screen is scrollable with safe-area and keyboard support.

The selected Personal journal composition has a centered profile photo, name,
goal/activity summary, and edit action above three sections: Overview, Goals,
and Photos. These are sections within Profile, not additional app tabs.

- Overview: current/longest streaks and the current Sunday-to-Saturday week,
  the workout progress graph, a compact link to today's nutrition under Goals,
  and Progress comparison. This section shows the earliest dated saved photo
  on the left and the latest on the right, with dates beneath. It has no Add
  or Compare button.
- Goals: today's calories/carbs/protein/fat/water and their saved targets,
  followed by editable name, age, height, current weight, activity level,
  lose/maintain/gain direction, and calorie-estimation preference. Each logical
  section has an Edit action.
- Photos: a horizontally scrolling carousel in date order with a date below
  each photo and a vertical separator between adjacent items. Photo presses
  open the date/note/replace/remove editor; library/camera adding remains here.
  There is no two-photo selection or comparison dialog.

The chosen visual reference is VariantC in `design/profile-prototype.html`.
Its numbers and photo wells are illustrative only. Production uses real saved
records and honest empty states. The user's subsequent screenshot instruction
requires faithful Variant C typography and spacing: 76px avatar, underline
section tabs, 18px card corners, compact streak circles, segmented graph
metrics and a range dropdown, three macro columns with inline water, and an
unframed photo section, updated to a horizontal carousel by the latest request.
Text still follows native font scaling and
interactive targets remain at least 44px.

## Workout graph behavior

The proposed interpretation of the user's examples is three switchable metrics:

- Volume: sum of recorded kilograms multiplied by repetitions across completed
  sets, including both sides of independently tracked exercises. Label it
  "Lifted volume (kg x reps)"; do not treat it as a strength estimate.
- Duration: recorded completed-workout duration in minutes. Never replace a
  missing manual duration with a fabricated zero-length workout.
- Exercise weight: heaviest recorded weighted set for a chosen exercise on each
  workout date. Label it "Heaviest set (kg)". For left/right tracking, show
  separate labelled Left and Right series. Blank or zero kilograms do not
  invent body mass or a weighted personal record.

Start with Volume and the last 12 weeks ending today. Offer 4-, 12-, and 52-week
ranges. Plot weekly buckets with readable date ticks and units. Volume and known
durations sum within each week; exercise weight uses the highest recorded
weight, with independent maxima for left/right. Missing weeks remain gaps and
partial duration stays marked. Tapping a plotted point reveals its week-ending
date and weekly value; an accessible daily data list retains the original
record values and independent day selection.

Multiple workouts on a date add volume and known duration. If a date includes
workouts with missing duration, identify its known duration as partial; if none
has a duration, show it as unknown. A day without a completed workout is distinct
from a completed workout whose duration was not recorded. Exercise-weight points
appear only for recorded weighted sets, with no invented values between dates.

Use historical exercise identities and snapshots, including exercises whose
library definition was edited or deleted. Exercise names are display labels,
not grouping keys. A tracking-mode change must not silently merge single-load
and left/right history into one misleading series.

Exclude planned/active workouts and future dates. No workout history produces a
helpful empty state instead of sample progress. Loading or unreadable exercise
storage shows loading/recovery, not a zero-value chart.

## Streak rules

Derive a union of qualifying local dates from the saved log documents:

- At least one saved food or drink entry.
- A positive manually logged water amount.
- At least one completed workout with recorded sets.

Each date counts once. Creating a food, exercise, or workout template, starting
a workout, setting a goal, adding a photo, or opening the app does not qualify.
Zero/cleared manual water does not qualify on its own.

Current streak ends today when today qualifies, otherwise yesterday. This gives
the user the rest of today to log activity. If neither qualifies, current streak
is zero. Longest streak uses all qualifying dates through today. Backdated logs
count on their saved activity date, and edits/deletions recompute the result.
Future records do not count. Use local date helpers rather than 24-hour UTC
arithmetic so midnight, daylight-saving changes, and leap days remain correct.

Do not persist redundant streak counters. If any required source is loading or
unreadable, show loading/recovery rather than an apparently authoritative streak
computed from incomplete data.

## Saved details, goals, and today's progress

Reuse the existing Profile answers, calorie estimator, macro-target calculation,
food totals, and combined manual/drink water totals. Profile always shows today's
progress, regardless of the date selected in another tab. It follows local-day
rollover while preserving that other tab's selected date.

Display unset targets as "Not set". Preserve explicitly entered zero macro
targets. Show actual amounts above their goal without truncating the number;
progress graphics may cap their fill without hiding the excess.

Editing uses focused sections with Save and Cancel, existing validation, and
the existing adult-estimate/teen-manual rules. Estimated targets respond to body,
activity, and goal changes as they do now. Manual calorie and macro overrides
retain their current meaning. Failed saves retain entered fields for retry.
Save only the section's changes against current saved answers so another edit
cannot silently overwrite unrelated changes.

No target-weight, weekly-workout-goal, or bodyweight-history feature is added in
this scope; the user requested their existing saved goals. Existing Settings and
onboarding editing remain compatible with Profile rather than owning a separate
copy of those answers.

## Profile and progress photos

The native flow offers photo library or camera through the platform picker,
with permissions requested when the user invokes that source. Canceling or
denying permission leaves saved photos and draft fields unchanged. The web
preview supports persistent file selection; browser camera support follows the
platform's available capture behavior without claiming parity with native.

The avatar has one saved photo, optionally cropped for its circular display.
Progress photos preserve their aspect ratio and contain an editable local date
and optional note. Default a new photo's date to today. Allow multiple photos on
the same date. Sort by date with stable ordering for ties. Replace/remove and
metadata edits retain their drafts after failed saves.

Progress comparison selects the earliest and latest dated saved records across
the complete gallery, with stable ID ordering for ties. A single saved photo
is both the first and latest; no photos show truthful empty placeholders. Dates
include the year. The Photos carousel keeps original aspect ratios with
contain-fit images, dates below, and separators between entries. Date edits and
deletions immediately update ordering and the overview endpoints.

Store photo metadata in a separate versioned document so existing profile answers
and onboarding records remain readable. Use an application-owned native document
directory for durable image files; do not retain temporary picker URIs as the
only saved copy. On web, use persistent browser image storage rather than
temporary object URLs. A storage adapter owns both implementations.

Resize images for display and create appropriately sized thumbnails to keep
scrolling and storage practical. Do not generate stock profile/progress photos.
An unreadable photo has a recoverable unavailable state without losing unrelated
metadata or photos.

Save an imported file before publishing its metadata; on metadata failure,
retain the existing saved photo and clean up only the new staged file. When
deleting/replacing, commit metadata before removing an old owned file. Cleanup
failures must not roll back successful metadata changes or delete a different
photo. All data remains on-device with a short "Stored on this device" caption.

## Architecture boundaries

- Existing profile persistence continues to own body details and goals.
- Existing food, water, and exercise persistence remain the activity sources.
- Pure profile-activity functions derive streaks and graph series from validated
  records and an explicit local today date.
- Photo persistence owns metadata mutations and import/delete lifecycle through
  a focused durable-media adapter.
- A shared media provider supplies the avatar and Profile gallery.
- Focused sections own their editing drafts; the page composes sections rather
  than owning a second copy of all domain state.

Keep a single instance of each activity provider shared by tabs and Profile.
Avoid reading AsyncStorage independently in graph/streak widgets. No backend,
cloud upload, new account requirement, or public photo sharing is introduced.

## Verification and acceptance

Add meaningful tests for streak grace through today, merged activity sources,
backdated edits/deletions, future exclusion, local date boundaries, and unavailable
sources. Test chart aggregation, historical identities, independent sides,
missing/partial duration, and bodyweight-only history.

Test durable photo publication and cleanup order, canceled imports, denied
permissions, failed writes, replacement, deletion, and reopen persistence using
controllable storage adapters. Test focused goal edits against the current
profile and preserve existing estimator/macro validation behavior.

Verify navigation from each existing tab, avatar refresh, today's progress while
another day is selected, section Save/Cancel/retry, all chart modes, photo date/note
editing, first/latest previews, carousel scrolling, and reload persistence in
the preview.

Run the repository's TypeScript/direct-test checks, relevant browser regressions,
and exports for web/iOS/Android. Verify new native picker/camera behavior,
durable-photo reopen, carousel scrolling, keyboard, and accessibility on
available native hardware/emulators; distinguish those results from web evidence.

The feature is complete when the agreed interactions work against real local
data, existing records remain readable, and failures preserve the user's saved
data and editable drafts.

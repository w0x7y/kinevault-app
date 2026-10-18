# KineVault Track

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

React Native with Expo and TypeScript. iOS and Android, plus a web preview.

## Product purpose

A companion to KineVault for tracking food, calories, and exercise. KineVault's
exercise creation studio remains a separate project in the sibling directory.

## Current scope

Daily dashboard layouts, navigation, and Kine-guided onboarding. Home, Food, Exercise, and
Settings are the top-level destinations. English copy and metric measurement units.
Appearance supports System, Light, and Dark, with a saved preference.
A local profile and editable, goal-adjusted calorie estimates are included.
Profile also logs dated body-weight measurements with editing, removal and an accessible trend chart. These measurements do not change the separately configured calorie or macro goals.
Settings exports account tracking data and local photos as JSON. Account deletion is confirmed with the password, or with a fresh Google sign-in for an account created with Google, and includes owner-scoped device cleanup; the deployed `delete-account` endpoint allows five attempts per account an hour. See [account management](docs/account-management.md).
Settings also holds profile editing, the water goal, reminders, appearance and an
Import workouts shortcut. Reminders are device notifications at a chosen time on
selected weekdays for a weigh-in, water, a workout, food logging, a progress photo
or a custom note; tapping one opens its screen. Import workouts previews a workout
shared as a Tracked link and saves it as a reusable workout.
Macro targets start at 50% carbs, 25% protein, and 25% fat, with editable gram
overrides. Home starts with a two-line greeting beside a small Kine: the time of
day, then the first name on Today, or the weekday on other days. A
Calories card follows: a ring for kcal left or over, filled with each macro's share of
the calories eaten, with macro rows beside it. Carbs use honey, protein Kine blue, and fat rose throughout the
macro breakdown and the calorie ring. Calorie progress
uses logged calories; the colored shares estimate macro energy using 4/4/9 kcal/g.
Steps and water tiles, then workout totals, follow below. Widget icons sit at the right of their headers.
Tap Water to add manual water in milliliters for the selected day. Home combines
manual water with saved Drinks volumes and displays the total in litres.
The tile and entry form explain that Drinks are already included. Cancel makes no change; failed saves retain the amount
for retry, and unreadable water storage offers recovery without replacing its data.
Food groups meals into Breakfast, Lunch, Dinner, Snacks, and Drinks. Logging or
editing drinks requires one whole amount from 1 to 10,000 ml for nutrition and
hydration. Beverages log automatically to Drinks without gram or meal controls. Saved edits and removals update hydration
with the same food-log write. Legacy snacks remain Snacks without guessed ml. Exercise
is titled Daily workout log, with the day's weight lifted and minutes (or "No
workouts yet") on the right. It shows summaries for active or completed workouts; totals include completed
workouts only, with sets, reps, and actual weight ranges. Exercise search opens
library definitions for editing and matches Food's search and result styling,
matching from the first character and showing
20 results per page. Exercises linked to KineVault show a small demo poster.
Three tiles below search open Saved workouts (saved workouts and that day's
drafts and logs), Create workout and Create exercise. Logging starts only from a
saved workout. Empty days show an Add workout card opening the same menu. Exercise hides its daily widget while
search, a form, the saved menu, or a workout editor occupies the screen. Storage
recovery stays visible. Home opens the menu in Exercise for the selected day.
An empty menu says “No workout found. Create a workout to get started.” The sessions and exercise
library widgets are removed. Steps shows the phone's count for the selected day (Core
Motion on iOS, Health Connect on Android, none on the web) plus steps logged by hand in
its Log steps sheet. Logged steps stay on the device.
Workout creation searches available exercises above the ordered list. Selecting
a saved workout shows a compact card with Start workout, Log completed workout and
Workout settings. Templates and pre-start Workout settings can set exercise counts from 0 to 100; new
template exercises default to three. Start opens the workout on its own page: a
horizontally scrolling exercise bar above the selected-exercise sets table,
with notes and the exercise's KineVault demo, or a Link demo button.
Add set and View notes sit on the exercise
title row. Exercise chips show short names (initials for long names); full names
stay in accessible labels. The active workout's page centers the elapsed timer in its
top bar; Back to Exercise saves the entered sets and leaves the workout running. While
it runs, the app header centers the same timer on every tab and opens the page when
tapped, and the default Exercise view shows a Live workout card (Kine working out and
Open workout) in place of the day's cards. Date/status text, Close workout and
explanatory footer are removed. End workout leads the bottom
actions, with Discard workout below it. Ending saves completion before stopping the timer.
Template and completed editing use the same bar and selected exercise detail,
with name/search/order under Exercises or name/duration under Details. Templates show a linked
demo without a Link demo button, because leaving would discard unsaved changes.
Completed edits require Save changes. Saved workouts, exercise and workout
forms, workout import, the active workout, manual logging and completed workouts open
as a page that slides up over the tab, with a back button; compact cards stay on the
tab. Blank set fields show the reps and weights of the latest
completed workout with that exercise, or the set above, as hints.
Exercise selection, search and
calendar changes preserve entered sets. Set counts cannot remove entered data.
Workout logging has no remove-set or remove-exercise buttons. Entirely blank
sets and unlogged exercises do not contribute to completion totals; partially
entered sets must be valid. Delete, remove and discard actions
are red and confirm by changing their own label to "Are you sure?" before a
second tap. Failed deletion keeps the saved data and editable drafts.
Drink search includes existing named energy drinks and common aliases for generic
cola and pepper-style soda. Generic alternatives are labeled rather than treated as
current branded nutrition. Food is titled Daily food log, with the day's eaten and goal kcal on the right.
Three tiles below its search field open Scan barcode, Create food or meal, and
Daily macros. Saved imports join offline food and ingredient search. Formatting
differences and bounded typos in eligible words match locally, with every query term
required and diet/zero variants preserved. Scan looks up exact products by barcode.
Food displays the daily log below search, one card per meal. Typing at least two
letters replaces the log with matching catalog foods and meals, with foods the
user has logged ranked first. Food details, logged-entry edits, creation, resumed
drafts, Daily macros, barcode scan and import review open as a page over the log. Solid serving presets precede nutrition and destination
choices for the selected date. Long solid lists show 100 g and two source servings
first. Drink details show only Drink amount (ml), nutrition per that volume, and
Log drink to Drinks. Selecting a result dismisses the native keyboard.
Catalog saves never add intake.
Food search uses an offline USDA FNDDS catalog of 5,431 foods, with calorie and
macro previews for a solid gram amount or a beverage volume. Choose a meal to
save that amount to the selected day. Entries persist locally, can be edited or removed,
and contribute to Home's daily calories and macros. Food results are separate
from the daily log. Edit changes the amount or meal after a successful save;
cancel and failed saves preserve the original entry. Daily macros
shows the selected date's calories and progress first, then calories, carbs, protein,
fat, its saturated/trans subtypes, fiber, total sugars, sodium, cholesterol,
potassium, calcium, iron, vitamin D, caffeine, and alcohol in their metric units.
Missing source values show Not available. New entries retain detailed nutrient
snapshots; older entries can resolve them using the same bundled USDA food and grams.
Create food/meal saves reusable custom foods with a name, serving weight, calories,
carbs, protein, and fat. Nutrition is entered per serving and normalized for
search alongside USDA foods. Saving opens the serving screen without adding a
meal entry; Log food records it on the selected day. Custom foods persist locally
with separate IDs and storage, and unknown detailed nutrients remain unavailable.
More nutrients expands optional per-serving fields using the existing g/mg/mcg
units. Blank values are unknown; zero is known. Collapsing retains values.
Failed saves retain the form for retry; unreadable custom storage blocks creation
until a successful retry.
Unified Food search finds USDA foods, custom foods and saved meals. Food and
Meal buttons inside Create food/meal choose the creation form. A custom
meal contains foods and gram amounts, with calories and macros calculated from
the ingredients. Users can override any value or restore calculated nutrition.
Detailed nutrient overrides are amounts for the whole meal. Clearing an individual
field restores its ingredient total, and the detailed reset clears all such overrides.
Meals persist locally, appear in meal search with a custom-item icon, and can be
logged as one entry for a complete meal or a gram portion. Saving shows an inline
Saved to your foods/meals message on its serving screen. Switching Food/Meal or calendar dates preserves open
creation drafts.
Scan barcode supports EAN/UPC product scanning
and manual barcode entry with on-demand camera permission. QR codes are excluded.
Open Food Facts barcode lookup open editable, unsaved
food drafts. Users review nutrition and brand before saving for offline reuse.
Only foods imported through scanning or manual barcode lookup show the barcode
badge. Previously saved non-scanned imports retain provenance without a scan badge. Provider attribution stays visible
on imported foods. Missing nutrition stays blank; volume-based products require
confirmation or entry of label nutrition per 100 ml for drinks. Volume packaging alone is insufficient to classify a beverage. The explicit editable Drink setting works for custom and scanned foods. Solid ingredients require gram nutrition. Closing, reopening Scan, tab blur,
backgrounding, or changing the day cancels stale online work without saving or logging.
Custom item details offer Edit food/meal and Delete food/meal. Edits reuse the
prefilled creation form; saved meals retain their ingredient amounts and explicit
nutrition overrides. Saves replace the catalog item under the same identity.
Deletion requires confirmation. Failed writes preserve saved records and retain
the edit or delete view for retry. Existing log entries and ingredients in saved
meals retain their snapshots when a catalog item changes or is deleted.
Custom macro grams are independent of the calorie target. Zero is a valid
override; clearing a field returns that macro to its calculated target.
The app is for ages 16 and up. Automatic estimates are adult-only; users aged
16–17 can enter a target agreed with a qualified health professional or leave it unset.
Exercise has a local library with name, optional muscle group, equipment, notes,
and single-load or independent left/right tracking. Reusable workouts save only
a name, ordered exercise list, and optional planned set counts. Workout drafts
require a nonblank name before starting an explicit workout timer,
restored from a saved timestamp after reopening. Valid entered sets become completed
when End workout successfully saves; untouched blank sets are skipped.
One timer may run at once. Draft and active workouts stay outside daily totals. Saved workouts can be logged
manually on any date, with optional duration. A left/right set counts as
one set, with both sides contributing reps and kg-times-reps volume. Blank weight
means bodyweight. Historical snapshots survive library edits and deletions.
Development builds seed Squat, Push-up, and Dumbbell curl once; production builds
do not inject these examples.
KineVault demos come from published KineVault exercises (see docs/exercise-demos.md).
In the exercise form, the Find in KineVault search links a published exercise and
fills only blank name, muscle group and equipment fields. Change opens the search
again, and Unlink removes the link. Demos show a poster until tapped.
Timed holds, cardio, coaching notes and the broader KineVault program integration remain future work.

The agreed strength/bodyweight Exercise v1 is implemented. The user confirmed
physical-iPhone verification, including keyboard, exercise scrolling,
background/reopen, completion, and completed editing; that check predates the
October 2026 redesign. Workout duplication and a rest timer are optional
ideas, not scheduled requirements. See [TODO.md](TODO.md) for outstanding work.

Profile uses the selected Personal journal layout with Overview, Goals, and
Photos sections. It opens from the existing avatar menu, preserves the four
bottom tabs and selected date, and shows today. Current/longest streaks derive
from saved food/drinks, positive manual water, and completed workouts. Workout
graphs offer volume, duration, or a selected exercise's heaviest set across
4/12/52 weeks, starting with 12-week volume. Goals combines saved targets with
today's calorie, macro, and water intake, with focused section editing.

The avatar and optional dated progress photos support library/camera selection,
replacement/removal and notes. Photos is a dated horizontal carousel with
separators; Overview automatically compares the earliest and latest dated photos
without a separate comparison picker. The streak week starts on Sunday. Files
and thumbnails remain on the device, separately from profile answers. No photo upload, target-weight
history, weekly-workout target, or cloud backup is included in this version.
Library and camera are native sources; web offers file selection. Android
emulator checks cover the new photo flows, durable reopening, carousel scrolling,
and larger text. Physical-iPhone Profile acceptance remains separate from the
completed workout checks.

Food search needs no credentials or hosted service. API and shared-login
requirements remain undecided.

## Brand commitments

Follow the "Quiet Vault" direction in [the redesign notes](docs/redesign-2026-10.md):
cool blue-gray surfaces, white cards with hairlines, slate-blue primary actions,
and color reserved for meaning. The companion uses rounded Comfortaa for display
titles, Manrope for text and figures, and Ionicons outline icons. Preserve
accessible touch targets. Screens use 20px outer margins, 18px card padding and
14px gaps between cards.
The top bar shows the selected date with a calendar chip on the left and a
saved avatar or initials on the right; Settings and Profile show their name instead
of the date. The tabs sit in a floating rounded bar over the page.
Its calendar has seven columns and five rows, with the current week centered.
Home, Food, and Exercise share the selected day; Settings and Profile have no calendar.
Dates follow the device's local time zone. Selecting Today resumes automatic
day advancement; deliberately selecting another date preserves that choice.
Kine guides onboarding, which starts with welcome and goals before asking age,
and greets on Home beside the day's greeting, and appears in loading states. Onboarding and account screens
stand him on a soft brand-tinted disc. Full-body page poses are separate from
the purpose-built Kine launcher icon and splash branding.
Motion is brief and respects system reduced-motion preferences.
Keep interface copy short and conversational; omit repeated introductions.

After the final profile review is saved, users create an account or log in with
Supabase email/password authentication or Continue with Google. An account is required
before entering Home. The confirmation email can be resent until three have gone to the
address in an hour, sign-up included. Confirmation and recovery email links have
dedicated callback screens and complete only with a sign-in code this device requested.
Passwords
never enter profile storage. Drafts resume at their saved question; signed-in profile
editing bypasses the account screen.

Goals, custom exercises, workout templates, full sessions, food and water logs sync
to private account storage. Pending edits survive offline restarts; conflicting
device edits require choosing a copy. Existing device data is imported once, and
accounts have isolated local caches. Membership plans/status are server-managed,
default to Free/active, and have no payment processing. Photos and logged steps stay
on the device.

English and metric are the supported interface formats. See
[language and units](docs/language-and-units.md) for the recorded decision and
[privacy storage decisions](docs/privacy.md) for local storage and sign-out behavior.
Root recovery offers Reload after a render failure. Confirmed offline operation
is visible, and reconnect retries pending cloud saves. Optional JavaScript
reporting requires a configured destination; see [resilience setup](docs/resilience.md).

## Evidence on hand

Food entries come from users logging catalog foods; exercises and workout
records come from local definitions and saved workouts, with development-only
exercise examples. Food search uses USDA
FoodData Central's FNDDS 2021-2023 release of October 31, 2024, with source
attribution and provenance in the bundled catalog. Open Food Facts supplies
product barcode lookup. Saved imports
remain local and searchable offline.
Empty days keep the metric and meal layouts without fabricated activity.
Each empty meal says “No food has been logged yet”. Failed food-log loads
show recovery before displaying meal records or Home totals.

[TODO.md](TODO.md) records completion, remaining verification, and release
blockers. [Dated review reports](docs/final-check.md) record evidence for the
revisions they reviewed. [Patch maintenance](patches/README.md) describes the
validated dependency fixes and the checks required when upgrading Expo.

Drinks persist explicit volume entries with nutrition snapshots and no invented grams.
Bundled beverage volume nutrition uses actual non-iced fluid source servings, with
US fluid ounce and cup conversions. Condensed milk, unreconstituted lemonade
concentrate, milk-derived powders, and desserts remain solids. Label drinks store
per-100ml calories/macros and optional detailed nutrients. Missing values remain
unknown; entered zero remains known. Volume-only custom drinks need a reliable
gram basis before use as meal ingredients. Existing meal snapshots and overrides
still use their real source gram nutrition. Editing legacy beverages preserves
their known volume nutrition snapshot; missing volume requires entered ml and
label nutrition per 100 ml. Stored legacy Snacks stay Snacks until explicit edit.

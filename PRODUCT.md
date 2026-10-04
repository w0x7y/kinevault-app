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
Macro targets start at 50% carbs, 25% protein, and 25% fat, with editable gram
overrides. Home starts with an even split between macro progress and Kine,
followed by a full-width calorie count and horizontal progress bar.
Macro counts share a line with their labels above each bar.
Macro rows center vertically beside Kine. Carbs use amber, protein blue, and fat
purple throughout the macro breakdown and stacked calorie bar. Calorie progress
uses logged calories; the colored shares estimate macro energy using 4/4/9 kcal/g.
Workout totals, steps, and water follow below. Widget icons sit at the right of their headers.
Tap Water to add manual water in millilitres for the selected day. Home combines
manual water with saved Drinks volumes and displays the total in litres.
The tile and entry form explain that Drinks are already included. Cancel makes no change; failed saves retain the amount
for retry, and unreadable water storage offers recovery without replacing its data.
Food groups meals into Breakfast, Lunch, Dinner, Snacks, and Drinks. Logging or
editing drinks requires one whole amount from 1 to 10,000 ml for nutrition and
hydration. Beverages log automatically to Drinks without gram or meal controls. Saved edits and removals update hydration
with the same food-log write. Legacy snacks remain Snacks without guessed ml. Exercise
shows summaries for active or completed workouts; totals include completed
workouts only, with sets, reps, and actual weight ranges. Exercise search opens
library definitions for editing and matches Food's search and result styling,
matching from the first character and showing
20 results per page. Each result has a landscape video placeholder with a
No video found icon. The button beside search opens saved workouts and that day's drafts and
logs. Logging starts only from a saved workout. Empty days show a button-only
Add workout widget opening the same menu. Exercise hides its daily widget while
search, a form, the saved menu, or a workout editor occupies the screen. Storage
recovery stays visible. Home opens the menu in Exercise for the selected day.
An empty menu says “No workout found. Create a workout to get started.” The sessions and exercise
library widgets are removed. Steps remain empty.
Workout creation searches available exercises above the ordered list. Selecting
a saved workout shows a compact card with Start workout, Settings and manual logging.
Templates and pre-start Settings can set exercise counts from 0 to 100; new
template exercises default to three. Start expands the card into a horizontally
scrolling exercise bar above the selected-exercise sets table,
with notes and a video placeholder. Add set and View notes sit on the exercise
title row; dividers sit above and below the exercise bar. The workout name and
elapsed timer share the active widget's title row. Date/status text, the separate
timer panel, Close workout and explanatory footer are removed. Active workouts
automatically expand on the default Exercise view. Discard and End workout share
equal halves of the bottom row. Ending saves completion before stopping the timer.
Template and completed editing use the same bar and selected exercise detail,
with name/search/order or name/duration under Settings. Completed edits require
Save changes. Exercise selection, search and
calendar changes preserve entered sets. Set counts cannot remove entered data.
Workout logging has no remove-set or remove-exercise buttons. Entirely blank
sets and unlogged exercises do not contribute to completion totals; partially
entered sets must be valid. Delete, remove and discard actions
are red and confirm by changing their own label to "Are you sure?" before a
second tap. Failed deletion keeps the saved data and editable drafts.
Drink search includes existing named energy drinks and common aliases for generic
cola and pepper-style soda. Generic alternatives are labelled rather than treated as
current branded nutrition. Food provides two search-row controls: offline Search and barcode Scan, using
a 75/25 width split. Saved imports join offline food and ingredient search. Formatting
differences and bounded typos in eligible words match locally, with every query term
required and diet/zero variants preserved. Scan looks up exact products by barcode.
Food displays one daily log below search. Search text filters logged names and
also finds catalog foods. Solid serving presets precede nutrition and destination
choices for the selected date. Long solid lists show 100 g and two source servings
first. Drink details show only Drink amount (ml), nutrition per that volume, and
Log drink to Drinks. Selecting a result dismisses the native keyboard.
Catalog saves never add intake.
Food search uses an offline USDA FNDDS catalog of 5,431 foods, with calorie and
macro previews for a solid gram amount or a beverage volume. Choose a meal to
save that amount to the selected day. Entries persist locally, can be edited or removed,
and contribute to Home's daily calories and macros. Food results are separate
from the daily log. Edit changes the amount or meal after a successful save;
cancel and failed saves preserve the original entry. View macros for the day
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
The small barcode button beside Food search supports EAN/UPC product scanning
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
Accounts, timed holds, cardio, and KineVault integration remain outside this increment.

The agreed strength/bodyweight Exercise v1 is implemented. Physical-iPhone
verification remains pending, including keyboard, exercise scrolling,
background/reopen, completion, and completed editing. Previous reps/weights,
progress/history charts, workout duplication, and a rest timer are optional
ideas, not scheduled requirements. See [TODO.md](TODO.md) for outstanding work.

Food search needs no credentials or hosted service. API and shared-login
requirements remain undecided.

## Brand commitments

Follow the supplied DESIGN.md palette and flat panels. The companion uses
Comfortaa throughout and Font Awesome 6 icons. Preserve mobile spacing and
accessible touch targets. Screens use 12px outer margins, panel padding, and
gaps between cards or form groups. Local label spacing stays compact.
The compact top bar has a calendar chevron on the left,
the selected date in the middle, and a profile-picture placeholder on the right.
Its calendar has seven columns and five rows, with the current week centered.
Home, Food, and Exercise share the selected day; Settings has no calendar.
Dates follow the device's local time zone. Selecting Today resumes automatic
day advancement; deliberately selecting another date preserves that choice.
Kine guides onboarding, which starts with a welcome and goals before asking age,
and stays on Home, Food, Exercise, and Settings. Home places him beside
nutrition; Food and Exercise place their action buttons to his left, and
Settings places its title to his left. Food and Exercise search fields follow
the action/Kine row. Every tab uses the same even split and
mascot size for a given content width. Full-body page poses are separate from
the purpose-built Kine launcher icon and splash branding.
Motion is brief and respects system reduced-motion preferences.
Keep interface copy short and conversational; omit repeated introductions.

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

The current implementation passed 120 unit tests, 21 browser tests, TypeScript
with unused-code checks, and web/iOS/Android bundle exports on October 1, 2026.
Native device interaction and screen-reader behavior have not been verified by
those exports. The known Router decoder dependency advisory remains documented
in README.md; the app's configured linking parser bypasses that decoder, and a
direct dependency override is incompatible.

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

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
overrides. Home shows a full-width calorie count and horizontal progress bar above an even
split between macro progress and Kine. Macro counts share a line with their labels above each bar.
Workout totals, steps, and water follow below. Widget icons sit at the right of their headers.
Food groups meals into Breakfast, Lunch, Dinner, and Snacks / Drinks. Exercise
shows session totals and completed exercises with sets, reps, and actual
weight ranges. These screens use empty records until
logging is implemented. Search filters the selected day's entries; creation and
macro-view buttons are disabled placeholders.
Custom macro grams are independent of the calorie target. Zero is a valid
override; clearing a field returns that macro to its calculated target.
The app is for ages 16 and up. Automatic estimates are adult-only; users aged
16–17 can enter a target agreed with a qualified health professional or leave it unset.
Tracking, accounts, food search, and KineVault integration remain outside scope. API and shared-login requirements remain undecided.

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
Settings places its title to his left. Every tab uses the same even split and
mascot size for a given content width. Full-body page poses are separate from
the purpose-built Kine launcher icon and splash branding.
Motion is brief and respects system reduced-motion preferences.
Keep interface copy short and conversational; omit repeated introductions.

## Evidence on hand

No food entries, exercise records, or connected catalog have been supplied.
Empty days keep the metric and meal layouts without repetitive placeholder
captions or fabricated activity.

The current implementation passed 84 unit tests, 15 browser tests, TypeScript,
Expo Doctor's 21 checks, and web/iOS/Android bundle exports on October 1, 2026.
Native device interaction and screen-reader behavior have not been verified by
those exports. The known Router decoder dependency advisory remains documented
in README.md; the app's configured linking parser bypasses that decoder, and a
direct dependency override is incompatible.

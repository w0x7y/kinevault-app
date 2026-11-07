# KineVault Track

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

React Native with Expo and TypeScript. iOS and Android, plus a web preview.

## Product purpose

A companion to KineVault for tracking food, calories and exercise. KineVault's exercise creation studio is a separate project in the sibling directory.

The app is for ages 18 and up. It uses English copy and Metric or Imperial units ([language and units](docs/language-and-units.md)). Home, Food, Exercise and Settings are the four tabs, and Home, Food and Exercise share the selected day.

## Current scope

### Home

- A two-line greeting beside a small Kine: the time of day, then the first name on Today or the weekday on other days.
- A Calories card: a ring for kcal left or over, filled with each macro's share of calories eaten (4/4/9 kcal/g), with macro rows beside it. Carbs are honey, protein Kine blue and fat rose everywhere.
- Steps and water tiles, then the day's workout totals.
- Tapping Water adds manual milliliters for the selected day. The total includes saved Drinks and shows in liters.
- Steps shows the phone's count (Core Motion on iOS, Health Connect on Android, none on web) plus steps logged by hand. Logged steps sync to the account. The phone's count is never uploaded.

### Food

- The Daily food log groups the day into Breakfast, Lunch, Dinner, Snacks and Drinks, with eaten and goal kcal in the title.
- Search covers an offline USDA catalog of 5,431 foods, custom foods, saved meals and saved barcode imports. It tolerates small typos, and foods the user has logged rank first.
- Tiles open Scan barcode, Create food or meal, and Daily macros.
- A solid food logs by Weight or by Servings, saved as grams. A drink logs one whole amount from 1 to 10,000 ml to Drinks and counts toward water.
- Copy food from another day, under the meals, copies one meal or the whole day into the selected day. It starts from the day before, its arrows skip to days with food, and each meal shows its entries and kcal before the copy. Copied drinks count toward water.
- Daily macros lists calories, macros and detailed nutrients (fat subtypes, fiber, sugars, sodium, cholesterol, potassium, calcium, iron, vitamin D, caffeine, alcohol). Missing source values show Not available.
- Custom foods have a name, serving weight, calories and macros, plus optional detailed nutrients. Blank means unknown and zero is known.
- Custom meals add up their ingredients. Any value can be overridden or restored.
- Custom foods and meals can be edited and deleted. Existing log entries keep their nutrition snapshot.
- Scan barcode reads EAN/UPC codes or takes a typed barcode. Open Food Facts fills an editable draft the user reviews before saving. Provider attribution stays visible.

### Exercise

- The Daily workout log shows the day's weight lifted, cardio distance and minutes in its title.
- Tiles open Saved workouts, Create workout and Create exercise. Logging always starts from a saved workout.
- Exercises have a name, optional muscle group, equipment, notes and a tracking mode: Single weight, Left and right, Alternating, Timed or Cardio. Cardio logs a time in minutes and seconds and an optional distance in km or miles.
- Saved workouts hold an ordered exercise list with planned sets (0 to 100, default 3). Duplicate makes a copy.
- Adjacent exercises can form a superset, joined in a saved workout or in a workout's edit mode. The live workout goes through it in rounds: Next returns to its first exercise until every set in it is done, then moves on.
- Start opens the live workout as a page with its timer in the top bar. While it runs, the app header shows the timer on every tab and the Exercise tab shows a Live workout card.
- The live workout has a Rest timer (90 seconds by default, 15 seconds to 10 minutes, buzzes when done), optional RIR per set, and hints from the last workout in blank fields.
- In edit mode, tapping a weighted set's number marks it as a warm-up (W). Warm-ups don't count toward totals, records or graphs.
- Plates shows the plates per side for each set's weight, on a 20, 15 or 10 kg bar or none (45, 35 or 15 lb in Imperial). The device remembers the bar.
- A saved workout can also be logged after the fact on any date, with an optional duration.
- The Workout card marks Personal records by estimated one-rep max (Epley).
- Share workout on the Exercise tab's Workout card shares a 1080 × 1350 PNG of the day's workouts: name, date, duration, sets, volume (or distance), each exercise's top set, records and Kine, always in the light palette. Phones only; the web preview hides it.
- Exercises can link a published KineVault exercise to show its demo video ([exercise demos](docs/exercise-demos.md)).
- Development builds seed Squat, Push-up and Dumbbell curl once. Production builds don't.
- Not built yet: coaching notes and wider KineVault program integration.

### Profile

- The Personal journal opens from the avatar menu, with Overview, Goals and Photos.
- Streaks count days with food or drinks, manual water or a completed workout. The week starts on Sunday.
- Workout graphs show volume, duration or one exercise's heaviest set over 4, 12 or 52 weeks.
- Goals shows the calorie, macro and water targets against today's intake. Calories use the estimate or a custom number. Macros start at 50% carbs, 25% protein and 25% fat, with editable grams.
- Body-weight entries are dated, editable and charted. They don't change the calorie or macro goals.
- Body measurements sit below them: waist, chest, hips, arm and thigh in cm, any of them per dated entry, charted one at a time. They don't change goals either.
- The avatar and progress photos come from the library or camera (file picker on web), with dates and notes. Overview compares the earliest and latest photo.
- Photos stay on the device. There is no photo upload or cloud backup.

### Settings and reminders

- Settings holds profile editing, the water goal, reminders, health saving, appearance (System, Light, Dark), units and Import workouts.
- Units, Metric or Imperial, is a device setting. Imperial shows and takes pounds, feet and inches, miles, ounces and US fluid ounces everywhere; nutrients stay in grams. Saved values stay metric.
- Save to Apple Health (iOS) or Save to Health Connect (Android), off by default, saves completed workouts that have a duration, body-weight entries and each day's water total. Edits update them and deletes remove them. Turning it on asks for write access. Each account turns it on separately on each device, so another account signing in on the phone starts with it off. Hidden on web.
- Reminders are device notifications at a chosen time on chosen weekdays: weigh-in, water, workout, food logging, progress photo or a custom note. Tapping one opens its screen.
- Import workouts previews a workout shared as a Tracked link and saves it as a saved workout.
- Export saves account tracking data and local photos as JSON.
- Deleting the account needs the password, or a fresh Google sign-in for Google accounts. The `delete-account` endpoint allows five attempts per account an hour ([account management](docs/account-management.md)).

### Accounts and sync

- Kine guides onboarding: welcome and goals first, then age and the other questions.
- After the profile review, the user signs up or logs in with email and password or Continue with Google. Home needs an account.
- Confirmation emails can be resent until three have gone to the address in an hour. Email links only complete with a sign-in code this device requested.
- A saved profile with an age under 18 reopens at the age question.
- Goals, exercises, saved workouts, workout logs, food and water logs and logged steps sync to private account storage through Supabase. Pending edits survive offline restarts, and conflicting edits ask which copy to keep.
- Data already on the device is imported once. Each account has its own local cache.
- Membership plans are set on the server, default to Free, and have no payments.
- An offline banner shows when the app is offline, and reconnecting retries pending saves. A render crash offers Reload. The app sends no crash reports ([resilience](docs/resilience.md)).
- Storage and sign-out behavior: [privacy](docs/privacy.md). Food search needs no credentials or hosted service.

## Brand commitments

- Follow the Quiet Vault direction in [the redesign notes](docs/redesign-2026-10.md): cool blue-gray surfaces, white cards with hairlines, slate-blue primary actions, and color only where it means something.
- Comfortaa for display titles, Manrope for text and figures.
- Ionicons outline icons.
- 20px outer margins, 18px card padding, 14px gaps between cards, and accessible touch targets.
- Kine, the app's blue creature, guides onboarding, greets on Home and appears in loading states. On onboarding and account screens he stands on a soft brand-tinted disc. The launcher icon and splash use their own Kine art.
- Motion is brief and follows the system's reduced-motion setting.
- Copy is short and conversational, with no repeated introductions.

Component rules are in [DESIGN.md](DESIGN.md), and screen layouts in [the redesign notes](docs/redesign-2026-10.md).

## Evidence on hand

- Food data comes from USDA FoodData Central's FNDDS 2021-2023 release (October 31, 2024), bundled with source attribution. Drink volumes use USDA's actual non-iced fluid servings.
- Barcode lookup uses Open Food Facts. Saved imports stay local and searchable offline.
- All other records come from what the user logs. Empty days show empty layouts, never made-up activity.
- Status and release blockers live in [TODO.md](TODO.md). Dated reviews are in [docs/final-check.md](docs/final-check.md), and dependency patches in [patches/README.md](patches/README.md).

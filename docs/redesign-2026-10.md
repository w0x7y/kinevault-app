# KineVault Track redesign (October 2026)

"Quiet Vault" is the current look of Track. Where [DESIGN.md](../DESIGN.md) disagrees, these notes win. DESIGN.md holds the system rules: every token, the type scale, spacing, navigation, controls, motion timings and accessibility.

Restyles keep every accessible name, role, test ID and test-asserted copy. Browser tests depend on them.

## Direction

A calm wellness journal, not a fitness dashboard. The restraint of Oura and Bevel, and iOS grouped settings.

- Cool blue-gray surfaces, white cards with hairlines, slate-blue primary actions.
- Color only where it means something: macros, water, progress, records and danger.
- Numbers lead. Hierarchy comes from type, figures and spacing, not decoration.
- Kine appears small and on purpose: the Home greeting, the live workout, onboarding and loading.
- One primary action per view. Destructive actions are red text on a soft red fill.

## Palette

| Role                  | Light                             | Dark                              |
| --------------------- | --------------------------------- | --------------------------------- |
| Page                  | `#eef2f6`                         | `#10161c`                         |
| Card                  | `#ffffff`                         | `#18212a`                         |
| Primary               | `#2c5070`                         | `#94bdd7` with dark text          |
| Kine blue (`brand`)   | `#3a6a96`                         | `#94bdd7`                         |
| Carbs / protein / fat | `#a4661a` / `#3a6a96` / `#b04e72` | `#e8ae55` / `#8db3dc` / `#e58aaa` |
| Water                 | `#1f78a6`                         | `#62c0ea`                         |
| Success / danger      | `#2f7d5b` / `#b42318`             | `#6fc59c` / `#fca5a5`             |

Carbs are honey, protein Kine blue and fat rose, everywhere. Icon wells, the active tab and the workout timer pill use the primary blue.

## Type and icons

- Rounded Comfortaa 600 for display (32) and title (24) text only.
- Manrope for all other text and every number, with tabular figures. Hero figures are Manrope 800. Numbers are never Comfortaa.
- Overlines (Manrope 700, 11, uppercase, muted) label card sections, so cards don't need headings.
- Ionicons outline icons, 18 to 20pt, behind the existing `Icon` names. A row's leading icon sits in a tinted rounded square.

## Home

- A two-line greeting: "Good morning," then the first name, larger. Other days show the weekday. Kine's `today` pose sits to its right at 96pt, 84pt on narrow phones.
- The Calories card: an overline with eaten / goal kcal, then a calorie ring beside the carbs, protein and fat rows. The ring's center shows kcal left or over. It fills with each macro's share of the calories eaten. Energy without macro data uses the foreground color and an overage arc is red. The ring carries the accessible calorie progress and the `home-calorie-*` test IDs.
- Each macro row puts its label and grams / target on one line above a thin bar.
- Steps and water tiles sit side by side and both are buttons.
  - Steps shows the phone's count plus steps logged by hand. It opens a Log steps sheet: the phone's count or its connect state, then a hero field between round -500 and +500 steppers.
  - Water shows manual water plus Drinks volumes and says "Includes Drinks". Its sheet uses ±250 ml steppers. While water storage loads or can't be read, the total hides.
- The workout card leads with total lifted, then duration, sets and reps. A running workout shows a plain Live badge. With no workout it offers "Add workout". Home doesn't show records.

## Food

- A title row, "Daily food log" with eaten / goal kcal on the right, then search, then three quiet sunken tiles with the icon above the label: Scan barcode, Create food or meal, Daily macros.
- One card per meal (Breakfast, Lunch, Dinner, Snacks, Drinks): icon well, meal name and kcal, entries split by hairlines. An empty meal says "No food has been logged yet". Entries show the amount, Edit and a named remove control. Drink rows show ml.
- A quiet "Copy food from another day" button follows the meals. Its page shows the source day between round arrows with its entry count and kcal, then one row per meal with food (count, kcal, names and a small Copy), then a primary Copy whole day.
- Search covers the offline USDA catalog, custom foods and saved meals. Foods from the user's log rank first, then [everyday foods](../src/food/common-foods.ts). Animal by-products such as feet or skin rank last unless typed. Filtering by logged name never replaces catalog results. Picking a result dismisses the keyboard.
- Custom foods and meals show a Custom food category and a small person-and-pen icon.
- Food details put the amount and serving choices before nutrition, then four meal destinations and a dated Log button. A food with servings gets a Weight / Servings switch. By Servings, the field takes a count, serving chips pick the serving and a caption shows "each = total" grams. Long serving lists show 100 g and two source servings first.
- Drink details have one Drink amount (ml) field before the nutrition preview, with no gram panel or meal chooser. Drinks log to Drinks. With no known volume nutrition, the form asks for calories and macros per 100 ml. Log stays disabled until the amount is valid. Editing keeps a known volume; an unknown old volume is never guessed.
- Create food or meal opens a sheet page. Food and Meal buttons switch forms, and Solid food and Drink switch the nutrition basis. Nutrition inputs form a wrapping two-column grid in the macro colors, with Cancel and Save food in one row below. The meal form adds ingredients by search, with editable grams and remove controls, and calculates nutrition in the same grid. Edited values stay until "Use calculated nutrition". A save shows "Saved to your foods" or "Saved to your meals" inline.
- Custom item details put Edit and Delete under the name. Edit opens the prefilled form. Delete keeps existing log entries and ingredients. USDA foods have neither.
- Daily macros shows calories and progress above the nutrient list. Labels and values align in columns with units in the labels. Saturated and trans fat indent under Fat. Missing values say "Not available" and nutrients with no data fold behind one control.

## Exercise

- A title row, "Daily workout log" with the day's weight lifted and minutes, or "No workouts yet". Then search, which matches name, muscle group, equipment and notes, and three tiles: Saved workouts, Create workout, Create exercise.
- While a workout runs, one card replaces the day's cards and Import workouts: Kine's `exercise` pose at 132pt on a brand disc, an "In progress" overline, the workout name and a primary Open workout button. Search and the tiles stay.
- The Workout card adds a Personal record line in success green under a record-setting exercise's counts: a trophy, "New record", the lift and the estimated one-rep max. It wraps between those parts like the counts above it.
- Saved workouts rows list title, muted metadata and small action pills. Duplicate, with the copy icon, follows Edit and wraps to a second line at 320pt.
- A completed workout shows total lifted as the hero, a stat row, and exercises as hairline rows.
- Share workout, a secondary button at the end of the Exercise tab's Workout card, shares a 4:5 image: a white card on the page tone, the date overline and the Comfortaa name beside Kine's `review` pose on a brand disc, a stat row, top sets as hairline rows, records in success green with a trophy, and "KineVault Track" in Comfortaa below. It's always light.

### Live workout

- Opens as a sheet page: full screen on Android and web, a page sheet on iOS. Back to Exercise leaves it running.
- The elapsed time sits on a primary-blue stopwatch pill (deep Kine blue in dark mode) centered in the top bar. The page leaves out the workout's name. Discard, a no-entry icon, sits at the top bar's right.
- Back, Next and End workout are pinned to the bottom with `useSheetControls`. The saved-workout editor pins Back, Next and Save workout the same way.
- Exercise chips are one size, at least 72pt, with the exercise's number above a short name: up to three initials, or a single word's first three letters, ignoring any parenthetical (`src/exercise/short-name.ts`). Accessible labels keep the full name.
- Each set line starts with the set's number, L1 and R1 on a left/right set. Weighted modes add an optional RIR column. Gray italic hints come from the matching set of the last completed workout with that exercise; pressing the set's number fills them in.
- A warm-up's number reads W (LW and RW on a left/right set). A Plates pill under weighted sets opens a sheet with each set's plates per side and a bar choice. Cardio sets add a Distance (km) field beside the seconds.
- The Rest timer row sits under the shown exercise's sets: round minus and plus buttons around a full-width "Rest 1:30" button. While a rest runs, the button turns primary and counts down ("Rest 1:12"). Tapping it stops the rest. The label has no icon so it stays on one line at 320pt.
- A superset's chips share a thin Kine-blue bracket underneath. In a saved workout and in edit mode, a "Superset with …" checkbox chip under the exercise's name joins it to the next one. Saved workouts and the planned card join a superset's names with "+".
- A pencil right of the notes toggles edit mode. Sets get plus and minus buttons in place of the clock button, and a weighted set's number becomes its warm-up checkbox. Chips wiggle, wear an X (removal asks first) and reorder by press-and-hold then drag; holding one at either end scrolls the bar. A final plus chip opens Add exercise, which searches or creates the exercise when nothing matches.
- Edit mode changes only that workout, except notes: they become a field that also saves to the library for later workouts.
- A live workout doesn't offer "Link demo". Logged and manual workouts do.

## Profile

Version 3, Personal journal, from [the prototype](../design/profile-prototype.html).

- A centered avatar with a camera badge, the name, and a goal and activity line. The name pencil opens a centered underlined field with Cancel on the left and Save on the right.
- An Overview, Goals and Photos segmented control.
- Overview: the Sunday to Saturday streak week, the workout graph, a link to today's nutrition, and an automatic comparison of the earliest and latest progress photos with dates below each. Photos are contained, never stretched or force-cropped.
- Goals shows real intake against targets, with focused editors.
- Photos is an optional horizontal carousel with dates, separators and notes.
- Charts use theme colors, labeled Left and Right series and gaps for missing data. Empty states offer an optional add action and never fill in sample records.

## Settings

- A grouped list: an overline title above one card of rows, with icon wells, hairline dividers and values on the right.
- The account card comes first: avatar, email, plan badge and sync status.
- Membership follows it, only once Plus is switched on: Free shows Get KineVault Plus and Restore purchases; Plus shows the plan and Manage subscription, which opens the store's subscriptions page.
- Appearance is a three-segment control that is still a radio group. Units (Metric, Imperial) follows it the same way.
- Reminders, then Health (a Save to Apple Health or Save to Health Connect switch row, with its status and fix below), are hidden on web.
- Data & account (export, log out) comes last. Delete account sits apart below it in red. Confirming takes the current password and typed DELETE. A Google-only account signs in with Google again instead, which unlocks deletion for 10 minutes.
- Language, units and version share one caption at the bottom.

## Plus

The paywall is a SheetPage that stacks over whatever sheet opened it ([design/paywall-prototype.html](../design/paywall-prototype.html)): Kine's review pose on a brand-soft disc, a Comfortaa title, a brand-soft strip naming the locked feature, one card of the seven Plus rows, Yearly and Monthly radio cards (Yearly preselected, with a green Save badge), and a pinned footer with one primary button, the renewal terms and the Restore purchases, Terms and Privacy links. After a purchase it turns into Welcome to Plus with one button back. A locked control keeps its look and adds a small brand-soft Plus tag with sparkles; a locked view fades the person's own data under one See Plus. Limits show a brand-soft notice from one item before the limit.

## Onboarding and account

- Kine stands on a soft brand-tinted disc above a Comfortaa question, choice cards with a checked ring, a slim progress bar and a primary Continue button pinned at the bottom.
- Order: welcome, goals, age (18 and up), profile questions, then editable calorie and macro targets. Account screens follow the final review.
- Account screens share the look, with a Sign up / Log in segmented control and inline field errors. Recovery, not-found and error screens match.

## Motion

Timings and what never animates are in DESIGN.md.

- Home: the ring's macro arcs sweep in and glide between values, macro bars and the water cup fill, and cards rise in once on first load.
- Chrome: the calendar and profile menu scale in from their trigger. The tab bar's highlight slides to the chosen tab.
- Food: a newly logged food rises into its meal. A removed one fades out, the cards below glide up and other entries stay disabled until the fade ends. Steps inside a sheet crossfade.
- Exercise: chips and set badges ease their fill, new sets and exercises rise in, and the day's card fades in after a workout ends.
- Profile, Settings and Onboarding: segment indicators slide, sections crossfade, streak days pop, charts draw in, dialogs rise as sheets, switches slide and choice cards ease their selection.

## Where it lives

| File                                                                                                                     | What                                         |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `src/theme/tokens.ts`                                                                                                    | Palette, radii, spacing, fonts, `cardShadow` |
| `src/components/ui.tsx`                                                                                                  | Text variants, `Overline`, `Panel`, `Screen` |
| `src/components/icon.tsx`                                                                                                | Ionicons mapping behind `IconName`           |
| `src/components/button.tsx`, `text-field.tsx`                                                                            | Buttons, `TextField`, `inputSurface`         |
| `src/components/sheet-page.tsx`, `modal-sheet.tsx`                                                                       | Sheets                                       |
| `src/components/motion.tsx`                                                                                              | Shared motion helpers and curves             |
| `src/food/food-ui.tsx`, `src/exercise/controls.tsx`, `src/account/settings-list.tsx`, `src/onboarding/status-screen.tsx` | Area helpers                                 |

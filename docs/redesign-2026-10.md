# KineVault Track redesign (October 2026)

A full visual and structural redesign of the Track app. Written after
exploring every screen of the running app (web build, seeded fixture data,
light and dark), before changing any code. `DESIGN.md` was deliberately not
consulted; this direction replaces it.

## 1. Verdict on the current app

What works and stays:

- The information model is sound: a day-scoped tracker (Home / Food /
  Exercise / Settings, plus Profile behind the avatar), a shared date, and
  honest loading, error and retry states everywhere.
- Kine, the mascot, is a real brand asset with warmth. It stays, but it
  stops being a layout column.
- Accessibility is unusually thorough (roles, labels, focus rings, 48px
  targets, reduced motion). Every accessible name, role and test ID that the
  browser tests depend on is a contract the redesign keeps.

What makes it feel unfinished:

1. **No hierarchy.** Every block is the same white rounded rectangle on the
   same blue-gray page, at the same weight. Nothing tells you what matters on
   a screen. Home gives the mascot as much area as the numbers.
2. **Cold, generic palette.** Slate blue on blue-gray reads as a default
   admin theme. Macro colors (brown, blue, purple) do not belong to one
   family.
3. **Typography fights itself.** Comfortaa (rounded, toy-like) for headings,
   Nunito for everything else; headings at 20-28px are nearly the same
   weight as body copy. Numbers, the heart of a tracker, are not emphasized.
4. **Heavy icons.** Font Awesome solid glyphs at full ink weight dominate
   every row (edit/delete pencils and bins on every food entry, giant tab
   icons).
5. **Layout by equal splits.** The Kine split row forces Home, Food,
   Exercise and Settings into 50/50 columns, so macros are squeezed into a
   half card while the other half is decoration. Action grids are three equal
   tiles with wrapped two-line labels ("Create food or / meal").
6. **Flat chrome.** The header is a bare date with a chevron; the tab bar is
   a plain white strip with oversized icons. Neither feels designed.
7. **Settings and forms are walls.** Long panels of label / paragraph /
   input / button stacks without grouping or rhythm.
8. **Calorie progress is a thin bar.** The single most important daily number
   (energy remaining) is a label in the corner of a card.

## 2. Direction: "Quiet Vault"

Premium wellness journal rather than a fitness dashboard. Calm warm
neutrals, ink-black primary actions, an editorial serif for titles and a
precise grotesk with tabular figures for data. Color is reserved for
meaning (macros, water, progress), never for chrome. Kine appears small and
deliberate: greeting, empty states, onboarding, loading.

Reference points: the restraint of Oura and Bevel, the editorial titling of
Gentler Streak, iOS grouped settings.

### Color

Light ("porcelain"):

| Token                 | Value                             | Use                                       |
| --------------------- | --------------------------------- | ----------------------------------------- |
| background            | `#F5F3EF`                         | page                                      |
| card                  | `#FFFFFF`                         | surfaces                                  |
| surfaceSunken / muted | `#EEEAE3`                         | tracks, chips, segmented controls         |
| foreground            | `#16181C`                         | ink                                       |
| mutedForeground       | `#62666E`                         | secondary text (AA on both page and card) |
| border                | `#E6E1D9`                         | hairlines                                 |
| primary               | `#16181C`                         | filled buttons, selected states, rings    |
| primaryForeground     | `#FAF8F4`                         | text on primary                           |
| brand                 | `#3E6A9A`                         | Kine blue: links, avatar, highlights      |
| carbs / protein / fat | `#A4661A` / `#3E6A9A` / `#B04E72` | macro family (honey, Kine blue, rose)     |
| water                 | `#1F78A6`                         | hydration                                 |
| success / danger      | `#2F7D5B` / `#B42318`             |                                           |

Dark ("vault"):

| Token                 | Value                                         |
| --------------------- | --------------------------------------------- |
| background            | `#0E0F11`                                     |
| card                  | `#17191C`                                     |
| surfaceSunken / muted | `#212429`                                     |
| foreground            | `#F3F1EC`                                     |
| mutedForeground       | `#A0A4AC`                                     |
| border                | `#2A2D33`                                     |
| primary               | `#F3F1EC` (inverted: cream buttons, ink text) |
| brand                 | `#8DB3DC`                                     |
| carbs / protein / fat | `#E8AE55` / `#8DB3DC` / `#E58AAA`             |
| water                 | `#62C0EA`                                     |

### Type

- **Instrument Serif 400** for display only: screen titles (34-40px),
  the Home greeting, onboarding headlines, empty-state headlines. Never below
  22px.
- **Manrope** (400/500/600/700/800) for all UI text and every number, with
  tabular figures. Hero metrics are Manrope 800 with tight tracking.
- Overlines: Manrope 700, 11px, +1.3 letter spacing, uppercase, muted. They
  label card sections ("ENERGY", "WATER") so cards no longer need headings.

Scale: display 38 / title 30 / heading 18 / body 16 / label 14 / caption 13 /
overline 11; hero metric 34, metric 24.

### Shape, space, depth

- 4pt grid; screen gutter 20; card padding 18; gap between cards 14.
- Radii: cards 24, controls 16, chips and pills 999, small tiles 12.
- Cards: white with a 1px hairline and a very soft two-layer shadow in light
  mode; hairline only in dark mode.
- Pressed state: a subtle scale (0.97) plus tint, not just a color swap.

### Icons

Ionicons outline (already shipped with `@expo/vector-icons`) replace Font
Awesome solid. The `Icon` component keeps its existing `IconName` API and
maps each name to an Ionicons glyph, so call sites do not change. Icons get
lighter and smaller (18-20px), and sit in tinted rounded squares when they
lead a row.

### Chrome

- **Header:** sits on the page color, not a white bar. The selected date
  is left-aligned in bold, followed by a calendar chip (calendar icon and
  chevron) that opens the calendar; the avatar is on the right. The calendar
  is a floating rounded popover with circular day cells. A 7-day week strip
  was considered and dropped: it would duplicate the calendar's day buttons
  (same accessible names), which makes navigation ambiguous for assistive
  tech and tests.
- **Tab bar:** a floating rounded bar inset from the screen edges, with
  outline icons, labels, and an active "pill" behind the selected icon.
- **Screen titles:** large serif titles in the content (Food, Exercise,
  Settings, Profile) with an overline summary above (e.g. "776 OF 2,000
  KCAL").

## 3. Screen plans

Ground rules for every screen:

- Keep behavior, copy that tests assert, accessible names, roles and test
  IDs. Visual-only test assertions (fonts, pixel geometry of the old layout)
  are updated to the new design and noted below.
- One primary action per view, in ink. Secondary actions are quiet sunken
  pills or text links; destructive actions are red text until they confirm.
- Numbers are Manrope (never the serif); units are smaller and muted.
- Sub-views (food detail, create forms, exercise editors, libraries) get a
  proper view header: back control, serif title, and no search chrome above
  them where tests allow.
- Errors sit next to the field they describe, with a red border on the field.

### Home

- Greeting header in the content: serif "Good morning/afternoon/evening,
  {name}" with a one-line status ("1,224 kcal left today"), and a small Kine
  (about 96px) to the right instead of a half-width mascot column.
- **Energy card** (replaces the separate macro card and calorie bar): a
  calorie ring with the remaining (or over) figure in the center, the three
  macro progress rows beside it, and the existing segmented calorie track
  kept for its test IDs and accessibility.
- **Water and Steps** two-up tiles with overline labels, a Manrope figure,
  unit, and the cup or icon; the water tile keeps its tap-to-edit button.
- **Workout card**: overline "WORKOUT", name, three key stats in one row.
  Empty state is a quiet card with a single "Add workout" action.
- Water modal: bottom-sheet styling, large figure, ±250 as round steppers.

### Food

- Search field with the three actions as compact tiles (icon above label)
  styled as quiet sunken tiles rather than white cards.
- The day log becomes **one card per meal**: icon well, meal name, kcal on
  the right, entries separated by hairlines, with muted edit/remove icons.
  Day total with goal in an overline summary above the meals.
- Food detail: serif food name, a large kcal figure, macro chips colored by
  macro, amount input with unit, serving chips in a wrapping row, meal
  segmented choice, primary "Log food" button.
- Create food/meal, barcode, daily macros: grouped form cards with section
  overlines.

### Exercise

- Same search and action tiles pattern as Food.
- Active workout: a dark "live" header card (workout name, big Manrope
  timer), exercise chips as pills with a clear selected fill, set table as a
  clean grid with numbered set badges and ghosted placeholder values.
- Completed workout summary: hero total lifted, stat row, exercises as
  hairline-separated rows.
- Saved workouts library and forms: list rows with titles, muted metadata,
  and small action pills; destructive actions visually quiet.

### Profile

- Identity hero: large avatar with camera badge, serif name, goal line.
- Overview / Goals / Photos as a segmented control (sunken track, white
  selected segment).
- Streak, workout chart, weight journal, goals and photos as consistent cards
  with overline titles; charts use ink/brand lines with soft fills.
- Profile menu: elevated popover with hairline border, quiet "Upcoming"
  badges.

### Settings

- iOS-style grouped list: overline group titles (ACCOUNT, PROFILE, WATER,
  REMINDERS, APPEARANCE, DATA), rows with icon wells, values right-aligned.
- Account card: avatar, email, plan badge, sync status line.
- Appearance as a three-segment control (still a radio group).
- Destructive "Delete account" separated at the bottom in red text.

### Onboarding and account

- Kine on a soft circular "stage" (brand-tinted disc), serif question as the
  headline, choice cards with a checked ring, a slim progress bar, and an
  ink Continue button pinned at the bottom.
- Account and auth screens share the onboarding look: serif headline, the
  segmented Sign up / Log in control, fields with inline errors, and the
  Kine stage at the top. Recovery, not-found and error screens get the same
  calm treatment.

## 4. Implementation notes

Shipped on branch `redesign/premium`.

- Foundation: `src/theme/tokens.ts` (palette, radii, spacing, fonts,
  `cardShadow`), `src/components/ui.tsx` (`display`/`overline` text variants,
  `Overline`, restyled `Panel` and `Screen`), `src/components/text-field.tsx`
  (`inputSurface`), `src/components/button.tsx`, `src/components/icon.tsx` (Ionicons outline
  mapping behind the existing `IconName` API), header and calendar popover,
  floating tab bar, and the shared onboarding controls.
- Area helpers: `src/food/food-ui.tsx`, `src/exercise/controls.tsx`,
  `src/account/settings-list.tsx` and `src/onboarding/status-screen.tsx`.
- `KineSplitRow` was removed; Home places a small Kine beside its greeting.
- Accessible names, roles, test IDs and test-asserted copy are unchanged.
  Some visible labels were shortened where the accessible name stays the same
  (for example "Add to day" for "Add {workout} to selected day").

Test changes, all for visual details of the old design:

- `tests/onboarding.browser.mjs`: the daily-layout test checks the new Home
  structure (greeting with Kine, calorie ring beside macros, 14px card gaps,
  20px gutters) and the new fonts. The onboarding column check uses 20px side
  margins.
- `tests/profile.browser.mjs`: tab icon detection matches Ionicons; the photo
  fixture draws with Manrope.
- `tests/profile-menu.browser.mjs`: the formats check reads the Settings footer
  line, which replaced the "App format" group in the previous commit.
- `tests/weight-history.browser.mjs`: opens Profile through the profile menu.
- `tests/helpers/account-fixture.mjs` with the water, water-goal and
  drink-hydration tests: tests that hold a water read can now also hold later
  document downloads. Before, a reconnect download could take the held read
  and stall other reads, which made those tests flaky.

Result: unit tests 1121/1121; browser tests 203 passed, 0 failed, 1 skipped
(visual capture, runs only with `KINE_PROFILE_VISUAL_DIR`). Before the
redesign the browser suite had 9 failures.

## 5. Revision after review (October 16, 2026)

Changes requested after the first review, replacing parts of sections 2–3:

- **Color:** the blue palette is back. Surfaces are cool blue-gray
  (`#eef2f6` light, `#10161c` dark), primary actions are slate blue
  (`#2c5070`; light blue `#94bdd7` in dark mode), and icon wells, the active
  tab and the live workout header (now its timer pill, section 8) use the
  primary blue instead of ink.
- **Type:** rounded Comfortaa (600) replaces Instrument Serif for display and
  title text, at smaller sizes (display 32, title 24) because it sets wider.
  Manrope stays for text and figures.
- **Food:** the "N OF M KCAL" and "N LEFT" overlines are gone. "Daily food
  log" is now the screen title above the search field, with today's
  "eaten / goal kcal" on its right.
- **Exercise:** the same title row: "Daily workout log" with today's weight
  lifted and minutes (or "No workouts yet").
- **Home:** the status line under the greeting and the stacked calorie bar
  are removed. The ring now fills with each macro's share of the calories
  eaten (carbs, protein, fat; energy without macro data in the foreground
  color) and carries the accessible calorie progress and the
  `home-calorie-*` test IDs that the bar used to.

## 6. Second revision (October 16, 2026)

- **Sheets:** flows that leave the day view open as a page that slides up
  over the tab (`src/components/sheet-page.tsx`; iOS uses a page sheet). The
  header has a back button that keeps the old back link's accessible name.
  Food: item details, edit logged entry, create/edit food or meal, resume
  draft, daily macros, barcode scan and import review. Exercise: saved
  workouts, create/edit workout and exercise, workout import, manual logging
  and completed workouts. A flow's steps replace each other on one page
  instead of stacking sheets. Search results and the planned-workout card
  stay on the tab; the live workout became a page in section 8.
- **Live workout:** the timer has no "elapsed" label (section 8 moved it
  from the header's right to the center of the page's top bar). Exercise
  chips show short names
  (`src/exercise/short-name.ts`: initials for long names, ignoring any
  parenthetical; full names stay in accessible labels).
- **Buttons:** destructive actions are red text on a soft red fill
  (`colors.dangerSoft`), never bare text; other text-only actions became
  quiet filled or compact pill buttons.
- **Tab bar:** floats over the page on a transparent wrapper; `Screen` pads
  its end by the bar's measured height.
- **Home:** the greeting is two lines, "Good morning," then the first name
  in a larger size.
- Food and Exercise pages hide while their tab is not focused, including when
  the app switches tab on its own (a reminder tap), and return with their
  state when the tab is shown again.

## 7. Motion (October 16, 2026)

Built with Reanimated on the UI thread, following the animate-expo rules: a
purpose for every animation, transform/opacity or absolute childless fills,
ease-out curves (no ease-in), at most 300ms for UI and 650ms for value fills.
Reduced motion turns all of it off. Shared helpers live in
`src/components/motion.tsx` (`useLayoutMotion`, `useProgressValue`,
`ProgressFill`, `useAppear`, `useStateTransition`, `StepFade`, the shared
curves). Press feedback belongs to `Tappable`, the segment fill to
`SegmentedControl`, popover entrances to `PopoverSurface` and sheet motion to
`ModalSheet`.

- **Home:** the calorie ring's macro arcs sweep in and glide between values,
  macro bars and the water cup fill up, cards rise in once on first load,
  and the water sheet slides up over a fading backdrop and slides back down.
- **Chrome:** the calendar and profile menu scale in from their trigger,
  and presses ease to 0.97 over 120ms. Tab switches are instant.
- **Food:** a newly logged food rises into its meal; a removed one fades out
  and the cards below glide up. Other entries stay disabled until the fade
  ends. Segmented controls slide their selection.
  Steps inside a sheet crossfade.
- **Exercise:** chips and set badges ease their fill,
  new sets and exercises rise in, and the day's card fades in after a
  workout ends.
- **Profile, Settings, Onboarding:** sliding segment indicators, a section
  crossfade, streak days pop, charts draw in and crossfade on change,
  dialogs rise as sheets, reminder switches slide, reveals fade, and choice
  cards ease their selection.
- **Not animated, on purpose:** search results (they change per keystroke),
  calorie and total figures (no count-ups), tab switches, and closing
  popovers.
- **Tests:** browser contexts default to reduced motion
  (`tests/helpers/browser.mjs`), so assertions read settled UI; tests that
  check motion opt in.
- **Layout fix:** the workout chart now keeps its aspect ratio from the first
  frame instead of resizing once its width is measured.

## 8. Live workout page and steps (October 17, 2026)

- **Live workout page:** the Active workout opens as a page like the other
  Exercise flows (a full screen on Android and web, a page sheet on iOS)
  instead of expanding on the tab. Its elapsed time sits on a primary-blue
  pill (a deep Kine blue in dark mode) with a stopwatch, centered in the
  page's top bar. The ink "live"
  header card, its "Live workout" overline and the pulsing dot are gone; the
  workout name is the card's first heading, as on the manual and completed
  pages. Back to Exercise leaves the workout running.
- **Header timer:** while a workout runs, the app header centers the same
  pill on every tab, and tapping it opens the workout. To make room, the date
  shortens to month and day ("Oct 4") and the calendar chip drops its
  chevron. Under 360pt the pill drops the stopwatch so "Profile" and the date
  still fit at 320pt. The stopwatch keeps the elapsed time from reading as a
  clock.
- **Exercise tab while live:** a card with Kine's side stretch (the
  `exercise` pose) on a brand-tinted disc, an "In progress" overline, the
  workout name and a primary Open workout button replaces the day's cards and
  Import workouts. Search and the three action tiles stay.
- **Home:** the "Live" badge on the workout card lost its pulsing dot too; the
  app has no pulsing dot left.
- **Steps tile:** it is now a button like the Water tile. It shows the
  phone's steps plus logged steps for the selected day, and opens a Log steps
  bottom sheet: the phone's count or its connect state, and a hero field for
  logged steps between round -500 and +500 steppers (the water entry's
  stepper, now a shared control).

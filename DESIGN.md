# KineVault design guide

> **Track redesign, October 2026.** KineVault Track's colors, type, icons and
> screen layouts now follow [the redesign notes](docs/redesign-2026-10.md).
> Where this guide's Track sections disagree with them, the redesign notes win.

Design reference for KineVault Track, the Expo app in `Application/`, and its
separate [KineVault studio](https://github.com/arielhagay10-ui/KineVault).
The supplied studio reference below describes its working source on
**30 September 2026**; its measurements assume a 16px root font size.
The Application summary records the implementation on **18 October 2026**.
Preserve scalable text in both products.

Outside the Application summary and explicitly labeled companion notes,
**Current** means the studio reference, not this Expo app. **Companion guidance**
means a proposed extension where the studio has no established pattern.
Studio source links point to its GitHub repository; Application links point to
local files. Studio browsing, authentication, and editing recipes describe
reference patterns, not implemented companion features.

## Current Application implementation

- Use the shared light/dark palette, radii and spacing from
  [theme tokens](src/theme/tokens.ts): cool blue-gray pages (`#eef2f6` light, `#10161c`
  dark), white or `#18212a` cards, and a slate-blue primary (`#2c5070`; pale `#94bdd7`
  with dark text in dark mode). Color is reserved for meaning: honey carbs, Kine-blue
  protein, rose fat, and blue water. Comfortaa 600 sets display and title text only;
  Manrope 400–800 sets headings, body text, labels, inputs, navigation and every figure,
  and figures use tabular digits so numbers line up. The scale in
  [ui.tsx](src/components/ui.tsx) is display 32 and title 24 (Comfortaa), a 40 hero figure
  (Manrope 800), heading 18, body 16, label 14, caption 13, and an uppercase 11 overline
  that names cards and groups. The shared [Icon](src/components/icon.tsx) keeps Font
  Awesome 6 names at call sites and draws the lighter Ionicons outline set, falling back
  to Font Awesome where no outline glyph is mapped. Decorative icons are hidden and
  icon-only controls are named.
- Cards ([Panel](src/components/ui.tsx)) are white on the page tone with a hairline
  border, a 24pt radius and 18pt padding, plus a soft two-layer shadow in light mode;
  dark mode uses the hairline alone. Cards are not nested inside cards, and lists inside
  a card are rows separated by hairlines. Controls use a 16pt radius, small tiles and
  [icon wells](src/components/icon-well.tsx) 12pt, and chips and pills are fully round.
  A [TextField](src/components/text-field.tsx) is a sunken well with a 1px border that
  lifts to the card color with a 2pt ring while focused and turns red while invalid.
  Focus rings follow keyboard focus only.
- [Tappable](src/components/tappable.tsx) is the one pressable. It owns the accessible
  role, name and state, the keyboard focus ring, press feedback (a 0.97 scale over 120 ms,
  or a pressed fill for rows and links), the 0.45 disabled fade and the 44pt minimum
  target. One button hierarchy ([AppButton](src/components/button.tsx)): primary is
  filled slate blue; secondary is a quiet sunken fill; a destructive action is red text
  on a soft red fill, and [DeleteButton](src/components/delete-button.tsx) turns into a
  filled red "Are you sure?" on the first tap and deletes on the second; Back, Cancel and
  similar navigation are text links. Buttons are 50pt regular, 44pt compact pills, or
  32pt small pills inside a 44pt hit area; IconButton is a round 48pt icon action.
  [Chip](src/components/chip.tsx) and [SegmentedControl](src/components/segmented-control.tsx)
  cover choices: sunken when idle, with a primary fill or a raised segment that slides to
  the chosen option.
- Screens use a 20pt gutter, 18pt card padding and 14pt gaps between cards. Local
  label/caption gaps remain 4–8pt. Content is centered at a maximum 768pt, including
  screen padding; touch targets are at least 44pt.
- The compact top bar sits on the page color and omits the app name. Home, Food, and
  Exercise show the selected date followed by a calendar chip (calendar icon and chevron)
  that opens a floating [popover](src/components/popover.tsx) calendar: seven columns,
  five weeks with the current week tinted in the middle row, round day cells, and
  previous-day, Today and next-day controls. These three tabs share the selected local
  date. Settings and Profile have no picker and show their name as the only title. The
  right slot uses the saved avatar or initials on Kine blue and opens the profile menu.
  Profile has a back control. While a workout runs, the bar centers its elapsed time on a
  stopwatch pill that opens the workout; the date shortens to month and day and the
  calendar chip drops its chevron. The floating tab bar (`src/app/(tabs)/_layout.tsx`,
  tabs listed in `src/navigation/track-tabs.ts`) is a
  rounded, elevated bar inset 16pt from the screen edges and at most 560pt wide, with
  the four labeled tabs, outline icons, a soft blue pill behind the active icon, and
  primary active and muted inactive colors. Screens pad their end by its measured height.
- Small modal tasks use [ModalSheet](src/components/modal-sheet.tsx): a bottom sheet on
  phones and a centered dialog on windows 600pt and wider. Flows that leave the day view
  (food details, create and edit forms, barcode scan, imports, saved workouts, the live
  workout) open as a
  [SheetPage](src/components/sheet-page.tsx) that slides up over the tab (a page sheet on
  iOS) with a round back button; a flow's steps replace each other on that one page.
  Sub-views start with a [ViewHeader](src/components/view-header.tsx). Feedback sits under
  what it describes as an [InlineMessage](src/components/inline-message.tsx); a source that
  can't be read shows a [LoadFailure](src/components/load-failure.tsx) with its retry.
- Profile uses version 3, Personal journal, in
  [the layout reference](design/profile-prototype.html): centered avatar/name,
  goal/activity summary, and an Overview, Goals, and Photos segmented control.
  Overview groups the Sunday–Saturday streak week, workout graph, today's nutrition
  link, and automatic earliest/latest Progress comparison with dates below each
  image. Goals shows real intake/targets and focused editors. Photos is an optional
  horizontal carousel with dates, separators and notes. Comparison contains images
  without stretching or forcing matching crops. The name pencil opens a centered,
  underlined field with Cancel on the left and Save on the right.
  Charts use the existing theme, distinct labeled Left/Right series, honest
  missing-data gaps, and equivalent readable values. Empty state has an optional
  add action; it never fills the gallery or chart with illustrative records.
- On the tabs Home shows Kine: the `today` pose at 96pt (84pt on narrow phones)
  beside the greeting. While a workout runs, Exercise shows the `exercise` pose at 132pt
  on a brand disc in the live workout card. Otherwise Food, Exercise and Settings start
  with their content. Onboarding,
  account and status screens stand Kine on a soft brand-tinted disc.
- The [loading pose](src/components/kine-loading.tsx) holds a large hourglass
  with both hands, on a soft brand disc. Home and Food show a compact instance in a card
  while the food log loads; compact instances also cover saved foods, water and steps
  entry, barcode lookup, and workout import. Startup and account loading fill the screen with
  it. Kine bobs slowly while loading, with no movement under reduced motion, an
  accessible loading label and no minimum display time; errors retain their
  explanatory text and retry actions.
- Home starts with a two-line greeting ("Good morning," then the first name, larger;
  other days show the weekday) with Kine to its right. The Calories card follows: an
  overline with eaten / goal kcal, then a calorie ring beside the carbs, protein, and fat
  rows. The ring shows kcal left (or over) in its center and fills with each macro's
  share of the calories eaten; energy without macro data uses the foreground color, and
  an overage arc is red. Each macro row puts its label and grams / target on one line
  above a thin bar. Carbs, protein, and fat use their honey, blue, and rose theme tokens
  in labels, fills and ring arcs; the unconsumed track stays neutral. Steps and water
  follow side by side, and both tiles are buttons. Steps shows the phone's count (Core
  Motion on iOS, Health Connect on Android; none on web) plus steps logged by hand for the
  selected day, and opens a Log steps sheet: the phone's count or its connect state, then
  a hero field between round -500 and +500 [Stepper](src/components/stepper.tsx)
  controls, the same control as the water entry's ±250 ml. Water shows manual water plus
  saved Drinks volumes for the
  selected day. The tile says Includes Drinks; the manual entry form explains that
  Drinks count separately in the Home total. Loading or unreadable water storage hides
  the total. The workout card leads with total lifted, then duration, sets and reps. A workout still
  running shows a plain Live badge on the card.
- Food and Exercise start with a title row, "Daily food log" with the day's eaten /
  goal kcal or "Daily workout log" with the day's weight lifted and minutes, then search,
  then three equal quiet tiles with the icon above a sentence-case label: Scan barcode,
  Create food or meal and Daily macros on Food; Saved workouts, Create workout and Create
  exercise on Exercise. Food and Meal buttons inside Create food or meal switch creation
  forms. Create food or meal opens a sheet page for
  a food name, serving weight, and calories/macros per serving. Nutrition inputs
  form a wrapping two-column grid with the existing macro colors; Cancel and Save food
  share one row below them. Validation and failed saves appear inline and
  preserve the draft. Saving opens the serving screen with an inline
  Saved to your foods message. Custom foods join
  search results with a Custom food category and a small person-and-pen icon
  beside the name. Create exercise and Create workout
  open working exercise and workout forms.
  Daily macros opens calories and progress above the
  selected date's nutrient list; nutrients without data fold behind one control. The meal form adds foods through ingredient
  search, shows editable gram amounts and removal controls, and calculates whole-meal
  nutrition in the same input grid. Edited nutrition stays overridden until Use
  calculated nutrition is chosen. Saved meals show Saved to your meals inline, with the same custom-item icon. Food searches the offline USDA, custom-food and saved-meal catalog. Foods from the
  user's log come first, then [everyday foods](src/food/common-foods.ts), and animal
  by-products such as feet or skin rank last unless typed; Exercise
  search matches the exercise library by name, muscle group, equipment and notes.
- Custom food and meal details place Edit and Delete controls below the name and
  category. Edit opens the matching prefilled form with Save food/meal changes
  and Cancel. Delete turns into a filled red "Are you sure?" and deletes on the
  second tap; existing log entries and saved ingredients are kept. Failed
  writes show inline retry errors. USDA foods have no catalog edit/delete controls.
- Food shows one daily log with Breakfast, Lunch, Dinner, Snacks, and Drinks,
  below catalog search, as one card per meal: icon well, meal name and kcal, with
  entries separated by hairlines. Logged name filters never replace catalog results.
  Empty meals say "No food has been logged yet". Solid details place gram amount
  and serving choices before nutrition, with four meal destinations and a dated Log action.
  Long lists show 100 g and two source servings first. Selecting results dismisses
  the native keyboard. Saved entries show amounts, Edit, and a named removal control.
  Drink details have one Drink amount (ml) field before the nutrition preview,
  requiring whole milliliters from 1 to 10,000. No gram serving panel or meal chooser
  appears. Nutrition uses that volume, and Log drink to Drinks includes hydration.
  Unknown volume nutrition requests calories/macros per 100 ml from the label.
  Blank initial volume uses neutral guidance; entered invalid volume shows an inline error.
  Log remains disabled until required amounts are valid. Drink rows show ml.
  Edit restores known volume and preserves it through catalog edits; Cancel and
  failed saves retain the original entry. Unknown legacy volume is never inferred.
  Custom creation offers Solid food and Drink settings. Each nutrition basis has
  separate values, and switching units requests fresh label nutrition.
  The daily nutrient list has aligned label/value columns with units in labels;
  saturated fat and trans fat are indented under Fat. Missing values say
  Not available. Both themes preserve protein and fat category colors.
  Exercise adds completed exercises with sets, reps, and actual load ranges;
  planned sets do not count as completed activity. Only saved food contributes
  to nutrition totals.
- Settings is a grouped list: an overline title above one card of rows each, with icon
  wells and hairline dividers. It starts with the account summary and ends with Data &
  account (export and log out), with Delete account in its own red control below,
  apart from routine settings. Confirming deletion takes the current password and
  typed DELETE; an account that signs in only with Google gets Sign in with Google again
  in place of the password field, and deletion unlocks for 10 minutes after that sign-in.
  Reminders are hidden on web.
  Language, units and version share one caption at the bottom.
  Onboarding begins with welcome and goals before age confirmation, then profile
  questions and editable calorie/macro targets. Required account screens follow
  saving the final review. Automatic macros use 50% carbs,
  25% protein, and 25% fat, with editable gram overrides.
- Motion uses the shared [motion helpers](src/components/motion.tsx), runs on the UI
  thread and uses ease-out curves (ease-in-out for segment slides, list glides and the
  loading bob): 120 ms presses, 180 ms toggles, segment slides and
  popover entrances, 300 ms entrances, and 650 ms value fills (ring arcs, macro bars and
  the water cup). Kine greets with a short hop. Tab switches are instant; search results
  and figures do not animate. Under reduced motion nothing moves; only short fades
  remain. The artwork and its size limits are documented in
  [the mascot guide](assets/mascot/README.md).

[PRODUCT.md](PRODUCT.md) defines the current feature scope; [README.md](README.md)
records modules and verification. The studio recipes below describe the KineVault
studio. Demo integration in Track is documented in
[docs/exercise-demos.md](docs/exercise-demos.md); the wider KineVault catalog is not
part of the Application.

## 1. Design identity

KineVault is an exercise encyclopedia centered on movement, anatomy, equipment,
and biomechanics. Its visual character is calm, precise, educational, and spacious.

- Use slate blue for actions, soft gray for the canvas, and white or dark slate panels.
- Let demonstrations and useful information dominate the screen.
- Establish hierarchy through typography, spacing, and borders before decoration.
- Keep advanced information accessible through progressive disclosure.
- Use real content and real counts. Make reviewed, private, and submitted content distinguishable.
- Avoid excessive gradients, neon accents, decorative charts, enormous dashboard tiles,
  fake statistics, and generic promotional SaaS layouts.

A companion may have different features. Preserve the palette, typography,
component treatment, content hierarchy, and interaction language.

## 2. Color tokens

Studio source of truth: [globals.css](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/globals.css).
Use semantic names in components; switch their values with the theme.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#f6f7f9` | `#12171d` | Page canvas |
| `foreground` | `#192026` | `#e5eaf0` | Main text |
| `card` | `#ffffff` | `#1a222b` | Cards, forms, toolbars |
| `card-foreground` | `#192026` | `#e5eaf0` | Text on cards |
| `popover` | `#ffffff` | `#1a222b` | Floating menus |
| `popover-foreground` | `#192026` | `#e5eaf0` | Menu text |
| `primary` | `#314e65` | `#94bdd7` | Main actions, links, selections |
| `primary-foreground` | `#ffffff` | `#10181f` | Text/icons on primary fill |
| `secondary` | `#e9edf1` | `#25313d` | Secondary action fill |
| `secondary-foreground` | `#314e65` | `#d7e6f2` | Secondary action text |
| `muted` | `#e9edf1` | `#25313d` | Media wells, subdued surfaces, tags |
| `muted-foreground` | `#52606d` | `#b0bdca` | Descriptions, labels, helper text |
| `accent` | `#e3ebf1` | `#253747` | Active annotations and subtle emphasis |
| `accent-foreground` | `#243f55` | `#d7e6f2` | Text on accent surfaces |
| `border` | `#ced6de` | `#3b4a59` | Dividers and outlines |
| `input` | `#ced6de` | `#3b4a59` | Input borders |
| `ring` | `#638ba6` | `#94bdd7` | Keyboard focus |
| `destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Destructive button and invalid states |

### Color application

- Main text uses `foreground`; descriptions use `muted-foreground`.
- Filled primary actions always pair `primary` with `primary-foreground`.
  Dark mode primary buttons have dark text on a pale blue fill.
- Standard borders are 1px. Avoid using a dark text color as a border.
- Common translucent surfaces: header `card/80`, feature card `card/80`,
  empty state `card/70`, canvas credit `card/90`, canvas instruction `card/95`.
- Editor selections also use `primary/10` with primary text; contextual panels
  use `primary/5` with an optional `primary/30` border.
- Opacity applies to the surface or token, not to the whole content group.
- Red muscle highlighting has anatomical meaning; do not turn it into a general brand accent.

### Feedback and review colors

Current feedback mixes semantic tokens with Tailwind red and amber utilities.

| Pattern | Current treatment |
| --- | --- |
| Inline error | `text-red-700 dark:text-red-300` |
| Form error panel | `bg-red-50 text-red-800`, sometimes `border-red-200` |
| Changed review row | `bg-amber-50 dark:bg-amber-950/30` |
| Changed-field label | `text-amber-800 dark:text-amber-200` plus the word “Different” |
| Notice/success message | Muted panel with primary text; often `role="status"` |
| Unread notification | Primary border and explicit “Unread” label |

**Companion guidance:** define theme-aware error and warning tokens from these
roles. Some current pale-red form alerts lack a dark override; treat that as an
implementation gap. There is no established green success palette or complete
color mapping for moderation statuses. Use written statuses; introduce additional
semantic colors only when needed, with both themes specified.

### Auxiliary tokens

These are configured by the UI scaffold; the current main screens do not establish
a chart system or a global sidebar built from these tokens. Preserve the values
when copying the full theme, but use the main palette for new product components.

| Token | Light | Dark |
| --- | --- | --- |
| `chart-1` | `oklch(0.87 0 0)` | Same |
| `chart-2` | `oklch(0.556 0 0)` | Same |
| `chart-3` | `oklch(0.439 0 0)` | Same |
| `chart-4` | `oklch(0.371 0 0)` | Same |
| `chart-5` | `oklch(0.269 0 0)` | Same |
| `sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `sidebar-primary` | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` |
| `sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` |
| `sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` |
| `sidebar-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| `sidebar-ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |

## 3. Light, dark, and system appearance

Current behavior:

- Offer **System**, **Light**, and **Dark**. Default to System.
- Apply the theme to the root. Web uses the `.dark` class and matching `color-scheme`.
- Persist the explicit preference; the web cookie is `kv-theme`, valid for one year.
- System mode follows OS changes. Bootstrap appearance before first paint.
- A slim full-width appearance strip sits above page content: card background,
  bottom border, 24px horizontal / 8px vertical padding, 12px muted text.
- Its select uses a card fill, 8px radius, and 8px horizontal / 4px vertical padding.

**Companion guidance:** a native app can place Appearance in settings. Keep the
same three choices and persistence behavior. Theme all surfaces and controls;
switch semantic values rather than applying an inversion filter.

The 3D scene deliberately uses a fixed light studio background in both themes.
The surrounding controls follow the app theme.

## 4. Typography

Current studio font: **Geist**, loaded through `next/font/google`, Latin subset.
Headings and body share the same sans-serif family. There is no separate display font.

**Companion app:** as of 17 October 2026, bundled Comfortaa 600 sets display and
title text, and bundled Manrope 400–800 sets headings, text, inputs, navigation and figures.
Launcher and splash branding uses Comfortaa 700. The studio reference above retains Geist. Native platform
fonts are a fallback only if loading fails.
The companion draws Ionicons outline glyphs through its shared Icon component, which
keeps Font Awesome 6 names and falls back to Font Awesome for unmapped ones.
Decorative icons stay hidden from assistive technology; icon-only controls need labels.

| Role | Size / line height | Weight | Tracking |
| --- | --- | --- | --- |
| Wordmark | 20px / 28px | 700 | `-0.05em` |
| Home hero | 48px, 60px at `sm`, 72px at `xl`; line height `1.02` | 600 | `-0.065em` |
| Explore/detail/taxonomy title | 36px / 40px; 48px / 48px at `sm` | 600 | `-0.055em` |
| Library title | 36px / 40px | 600 | `-0.055em` |
| Auth title | 30px / 36px | 600 | `-0.05em` |
| Workshop title | 24px / 32px | 600 | Default |
| Panel title | 20px / 28px | 600 | Default |
| Card title | 18px / 28px | 600 | `-0.025em` (`tracking-tight`) |
| Intro paragraph | 18px / 32px | 400 | Default |
| Main body | 16px / 24px; instruction prose 28px line height | 400 | Default |
| UI label / button | 14px / 20px | 500–600 | Default |
| Card description | 14px / 24px | 400 | Default |
| Helper text | 12px / 16px or 20px | 400 | Default |
| Page eyebrow | 12px / 16px, uppercase | 700 | `0.18em`; home `0.2em` |
| Filter group heading | 12px / 16px, uppercase | 700 | `0.16em` |
| Card category | 12px / 16px, uppercase | 600 | `0.12em` |
| Detail taxonomy heading | 14px / 20px, uppercase | 600 | `0.1em` |

- Use sentence case for titles, labels, buttons, and descriptions.
- Reserve uppercase for short eyebrows, categories, and metadata group headings.
- Keep large titles tightly tracked; keep paragraph text normally tracked.
- Use tabular numerals for changing measurements, sensitivity, and timelines.
- Card descriptions truncate to two lines. Detail text and exercise names should wrap.
- Intro text generally stays within 512–768px; avoid edge-to-edge prose on wide screens.
- **Companion guidance:** start compact/mobile page titles around 28–36px and
  retain the hierarchy. Support text scaling without clipped controls or headings.

## 5. Spacing, dimensions, and shape

### Spacing

The underlying spacing step is 4px, with 2px intermediate values used for small controls.
Common values: **4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 64, 80px**.

| Relationship | Typical current spacing |
| --- | --- |
| Icon to label | 6–8px |
| Label to field | 8px |
| Eyebrow to title | 12px |
| Title to description | 12–20px |
| Compact control padding | 8–12px |
| Small contextual panel padding | 12–16px |
| Filter/card padding | 20px |
| Detail/form panel padding | 24px |
| Auth panel padding | 28px; 36px at `sm` |
| Grid/card gap | 16–20px |
| Form field grid gap | 20px |
| Content section separation | 24–40px |
| Filter sidebar to results | 32px |
| Detail column gap | 40px |
| Home hero column gap | 48px; 64px at `lg` |
| Page bottom padding | Usually 80px |

### Radius tokens — use these values, not Tailwind defaults

`globals.css` overrides Tailwind's named radius scale. Base `--radius` is
`0.625rem` (10px); the component classes resolve as follows:

| Token / class | Formula | At 16px root | Typical use |
| --- | --- | --- | --- |
| `radius-sm` / `rounded-sm` | Base × 0.6 | 6px | Small detail |
| `radius-md` / `rounded-md` | Base × 0.8 | 8px | Small selects |
| `radius-lg` / `rounded-lg` | Base | 10px | Toolbar buttons, notices |
| `radius-xl` / `rounded-xl` | Base × 1.4 | 14px | Fields, standalone actions |
| `radius-2xl` / `rounded-2xl` | Base × 1.8 | 18px | Cards, panels, media |
| `radius-3xl` / `rounded-3xl` | Base × 2.2 | 22px | Auth and large empty states |
| `radius-4xl` / `rounded-4xl` | Base × 2.6 | 26px | Available; no central pattern |
| `rounded-full` | Full pill | Pill/circle | Tags, family badge, home nav action |

Media clips to the parent radius. Avoid sharp inner images inside rounded cards.

### Depth

- Default panels are flat: fill + 1px border.
- Auth uses `shadow-sm`; floating equipment menu uses `shadow-lg`.
- Exercise-card hover adds `shadow-lg shadow-black/5` and a 2px upward translation.
- Private-card hover uses `shadow-md`.
- Use shadows to clarify hover or elevation, not on every nested panel.
- No established blur/glass treatment or background gradient is required.

## 6. Responsive layout and app shell

Current Tailwind viewport breakpoints: `sm` 640px, `md` 768px, `lg` 1024px,
`xl` 1280px, `2xl` 1536px. Main layout changes use `sm`, `lg`, and `xl`.

| Screen/container | Current maximum width | Gutters |
| --- | --- | --- |
| Home, Explore, detail, taxonomy, admin | 1280px (`max-w-7xl`) | Usually 24px; public pages 40px at `lg` |
| Account/library | 1024px (`max-w-5xl`) | 24px |
| Notices and simple error content | 768px (`max-w-3xl`) | 24px |
| Auth | 448px (`max-w-md`) | 24px page padding |
| New workshop | 1600px | 16px; 24px at `sm` |
| Existing workshop | 1700px | 16px; 24px at `sm` |

Maximum width includes container padding. Use centered containers and
`minmax(0, 1fr)` / `min-width: 0` where columns contain text, media, or controls.

### Navigation

- Public content header: wordmark left, contextual navigation right,
  card/80 fill, bottom border, 20px vertical padding.
- Home header: no enclosing panel; 28px vertical padding, logo tile + wordmark,
  “My library” link and outlined pill “Explore exercises”.
- Account header: wordmark left, sign-out right, bottom divider.
- Detail pages offer a back link with a 16px left-arrow icon.
- Admin header wraps its text navigation and labels the area “Review”.
- Headers are not globally sticky. Sticky behavior is used for filters and the workshop preview.
- The repository has no established persistent bottom navigation, app-wide sidebar,
  generic modal system, or tab bar.

**Companion app:** use a compact top bar with the selected date, a calendar chip,
and saved avatar or initials. Omit the app name. The chip opens a floating seven-column,
five-week calendar with the current week centered; share the selected day across
Home, Food, and Exercise. Settings omits the picker; Profile shows a back control
and title. Use a floating, rounded bottom bar with the four labeled tabs, outline
icons, a soft pill behind the active icon, primary active color, and muted inactive
text. Respect safe areas.

## 7. Brand and icons

Current home mark is the **Lucide Orbit** icon, not a custom image logo:

- Tile: 40 × 40px, 14px radius, primary fill, primary-foreground icon.
- Orbit: 23px, stroke width 1.7.
- Gap to wordmark: 12px. Wordmark text: **KineVault**.
- Most interior pages use the wordmark alone.

Icon family: **Lucide** (`lucide-react` on web). Use consistent outlined icons.
Typical sizes: 14–18px in controls, 20–22px in feature panels, 30–42px in empty/media states.
Use the library's normal stroke unless a specific existing element overrides it.
The missing-poster Dumbbell icon is 42px with a thin 1.2 stroke.

Useful existing meanings: Search = search, SlidersHorizontal = filters,
Heart = favorite, Plus = add, ArrowLeft = back, ArrowRight = continue,
ArrowUpRight = explore, ShieldCheck = reviewed knowledge, Play/Pause = playback.

Decorative icons should be hidden from assistive technology. Icon-only controls
need an accessible name. Do not rely on tooltips to convey essential actions.
The companion uses Ionicons outline glyphs (Font Awesome 6 as a fallback) rather
than Lucide. Its app name belongs in
launcher/splash branding; the compact in-app top bar has no wordmark.

## 8. Buttons and action hierarchy

Current shared [Button](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/ui/button.tsx) and page-specific buttons
have two densities. Do not assume every current button uses the shared primitive.

| Kind | Surface/text | Shape and treatment |
| --- | --- | --- |
| Primary | Primary / primary-foreground | Filled; one clear main action per action group |
| Outline | Background + border / foreground | Muted hover; shared dark variant uses input/30 fill |
| Secondary | Secondary / secondary-foreground | Soft fill; subtle color-mix hover |
| Ghost | Transparent / inherited text | Muted hover; useful for low-priority tools |
| Destructive | Destructive/10 + destructive text | Destructive/20 hover; dark fill 20% / hover 30% |
| Text link | Primary | Underline on hover; 4px underline offset in primitive |

Shared primitive: 14px medium text, 10px radius, 32px default height,
10px horizontal padding, 6px icon gap, 16px default SVG.
Sizes: `xs` 24px, `sm` 28px, default 32px, `lg` 36px; square icon versions match.
`xs` text/icons are 12px; `sm` text is 12.8px with 14px icons.

Standalone page actions usually use 14px semibold text, 14px radius,
16–24px horizontal and 10–12px vertical padding. Use this roomier treatment for
form submission and major navigation.

States:

- Shared primary hover uses `primary/80`; some page buttons retain their fill.
- Shared buttons transition and move down 1px when pressed, except popup triggers.
- Disabled primitive: 50% opacity and no pointer events. Page form buttons often use 60%.
- Pending actions display a verb: “Saving…”, “Creating…”, or “Working…”.
- Toggles use `aria-pressed`; disclosure triggers use `aria-expanded`.
- Saved favorite fills the Heart and changes text to “Saved”.
- Selected camera view uses primary fill; selected editor tools often use primary/10.

**Companion guidance:** touch hit areas should be at least 44 × 44px even when the
visible compact button is smaller. Keep desktop density out of primary mobile actions.
Separate destructive actions spatially and state their consequence before confirmation.

## 9. Fields, selectors, and disclosures

- Labels above controls: 14px semibold, typically 8px gap.
- Main inputs/textareas: full width, 1px border, 14px radius,
  16px horizontal / 12px vertical padding; foreground text on a themed surface.
- Filter controls: background fill, 12px horizontal / 10px vertical padding, 14px text.
- Search field: leading 17px Search icon at 12px inset, 40px left padding;
  placeholder “Name or alias”.
- Input focus: primary border and 2px ring in addition to the global visible outline.
- Checkboxes/range controls use primary accent; checkbox + label has an 8px gap.
- Role selects beside taxonomy choices are compact, 112px wide, 12px text.
- Helpers sit under the field, use muted 12px text, and explain uncertainty or requirements.
- Use actual labels, not placeholder-only labeling. Required/optional fields must be understandable.
- Forms use 20px gaps in two-column groups; collapse to one column on narrower screens.
- Multi-choice taxonomy fields use bordered scroll areas, usually max-height 192px.
- Use native selects and `details`/`summary` where sufficient; custom UI is not required to match.
- Advanced classifications, timeline settings, and editor numeric controls start collapsed.
- Preserve entered values on validation failures. Keep error text near its relevant action/field.

## 10. Cards, tags, and structured data

### Exercise card

```text
┌──────────────────────────────┐
│ Demonstration poster (4:3)    │
├──────────────────────────────┤
│ FAMILY                       │
│ Exercise name                │
│ Short description, two lines │
└──────────────────────────────┘
```

- Entire card is one link: card fill, 1px border, 18px radius, clipped media.
- Media: 4:3 well, muted fill, `object-contain` to preserve full figure/equipment.
- Body: 20px padding; category → title → description gaps are 8px.
- Hover: 2px lift, restrained shadow, title turns primary.
- Grid: one column → two at `sm` → three at `xl`; 16px gaps.
- First three poster images load eagerly; remaining posters load lazily.
- Missing poster uses the thin Dumbbell glyph, not a broken image or invented demo.

### Panels and tags

- Information/form panels: card fill, 1px border, 18px radius, 24px padding.
- Tags: full pill, muted fill, primary text, 14px type,
  12px horizontal / 6px vertical padding; wrap with 8px gaps.
- Taxonomy links look like tags; non-link tags may look similar, but only real links navigate.
- Family badge is semibold; ordinary taxonomy tags are regular or medium.
- Biomechanics use a definition list: muted label above semibold primary value,
  4px label/value gap, two columns, 20px grid gaps.
- Unknown values read “Not classified” or “Unknown”; do not display raw enum strings.
- Instruction sections use a compact uppercase subheading and readable multiline prose.

## 11. Studio page composition recipes

### Home

Header → two-column hero at `lg` → explanatory copy left, motion study right.
Column proportions are **0.83 : 1.17**. Intro uses a primary eyebrow with an 8px dot,
large tight heading, muted 18px paragraph, two small feature panels, and a text CTA.
Stack the hero on smaller screens. Demonstration remains the main visual asset.

### Explore

```text
Appearance strip
Brand header                         My library
Eyebrow / title / short explanation
┌── 285px filters ──┐  ┌── result count / active count ───┐
│ Search            │  │ Exercise cards                  │
│ Anatomy           │  │ 1 / 2 / 3 columns by viewport   │
│ Movement          │  │                                 │
│ Equipment         │  │ Next page                       │
│ Biomechanics      │  └─────────────────────────────────┘
│ Other / sort      │
│ Apply filters     │
└───────────────────┘
```

- Content starts 48px below its header; intro has 40px bottom separation.
- Desktop grid: `285px minmax(0,1fr)`, 32px gap; filter panel sticks 24px from top.
- Filter panel: 18px radius, 20px padding, group dividers, uppercase group headings.
- Disclosure sections have 16px vertical padding; selected groups open by default.
  Joint actions start open; their list max-height is 256px versus 192px for other groups.
- Sort choices: Alphabetical, Newest, Most favorited. End with full-width Apply filters.
- Every selected value must match, including values inside the same group.
- Filters are applied explicitly; query parameters preserve and share the search.
- Show the actual current-page count, not an unqueried total. Current page size is 24.
- On mobile the sidebar becomes an **inline collapsible panel**, initially hidden,
  with full-width “Show filters” / “Hide filters” and active count. It is not a modal drawer.
- Clear all and Reset search return to unfiltered Explore; pagination preserves applied filters.

### Exercise detail

Desktop: back link → columns **1.15 : 0.85** with 40px gap.
Left: large demonstration, optional 3D inspector, instructions.
Right: eyebrow, exercise title, description, family, aliases, save/copy actions,
anatomy/equipment panel, biomechanics panel, and related exercise links.

Metadata stays grouped: primary muscles, secondary muscles, stabilizers, joints,
joint actions, equipment, attachments, movement patterns. Do not merge these categories.
Clickable muscles, joints, actions, equipment, and family link to exploration pages.
Relationship labels explain whether a movement is a parent, variation, easier, or harder.

Current mobile DOM order places media/instructions before the right-column title.
**Companion guidance:** put identity and back navigation before the demonstration
on a native detail screen, then actions and grouped information. Preserve the content hierarchy.

### Taxonomy and joint-action pages

Use the public width and title treatment, a short educational definition, and
exercise cards. Link to full Explore with the category already selected.
Joint-action pages add a 285px filter panel for equipment, muscles, resistance
profile, body position, and difficulty. Current joint-action filters stack inline
on small screens without Explore's hide/show wrapper.

### Account and private library

Use 1024px width and simple navigation. Show two medium panels for private exercises
and favorites, real counts, then saved exercise links. Private drafts use a two-column
grid from `sm`, textual cards, explicit “Private draft”, and “Open workshop”.
Use role-specific review navigation only where available.

### Authentication

Centered 448px container, wordmark above a 22px-radius bordered card with a subtle
shadow. Compact eyebrow, 30px heading, vertically stacked fields, full-width
primary submit action, and small account/password links below. Pending and error
feedback stay inside the form. No decorative illustration is required.

### Exercise creation and sharing

Current flow starts with the movement workshop. “Save & add details” opens metadata
after the private draft is created. Details group exercise basics, anatomy,
optional detailed classifications/instructions, and equipment/resistance.
Use “Save privately” for the metadata action.

Sharing gets its own panel: explain view access, display active-link state,
offer create/replace/revoke, then a copyable link after creation. Confirmation
for revocation explains loss of access. Private content does not become reviewed
public catalog content through sharing.

### Moderation and notifications

Review uses the same visual language with denser controls. Comparisons are
bordered panels with a muted table header, 16px cells, and 1px row dividers.
Changed rows use amber plus “Different”; comparison columns remain readable.
The current comparison table has a 540px minimum width in its own horizontal scroller.

Decisions use explicit labels: begin review, approve, request changes, reject,
merge, and retry failed render. Reasons and comments are visible in the decision form.
Notifications are compact bordered cards; unread items use a primary border and text label.
**Companion guidance:** on narrow screens, stack comparisons by field when practical.
Keep any table overflow inside its panel rather than making the page scroll sideways.

## 12. Demonstrations, anatomy, and 3D style

### Video gallery

- 4:3 container, 18px radius, muted well, full-size `object-contain` video.
- WebM first, MP4 fallback, poster while loading; preload metadata.
- Playback is muted, looping, inline, with controls. Autoplay is allowed when
  reduced motion is not requested; reduced motion pauses autoplay.
- Show Character / Camera angle selectors only when multiple choices exist.
- Keep the current presentation and angle readable, with source credit underneath.
- Movement notes list label, time interval, optional explanation and joint-action link.
  Active notes use accent fill; choosing a note seeks to its time.
- Show an explicit unavailable/failed state when media cannot load.
- Do not use GIF as the primary exercise demonstration format.

### Anatomy palette

These are fixed model/studio colors, separate from app theme tokens.

| Element | Current color |
| --- | --- |
| Studio background | `#f7f8f8` |
| Unselected muscles | `#8e9994` |
| Skeleton | `#ddd8cb` |
| Highlighted muscles | `#c33d36` |
| Dark equipment/plates/pads | `#263b3b` |
| Equipment metal | `#778b8b`, `#627479`, `#516768` |
| Cable details | `#43565a`, `#34484b`, `#879994` |
| Adjustable bench steel / hardware | `#d1d7d7` / `#718082` |
| Adjustable bench pad / rubber | `#202526` / `#101718` |
| Joint markers | `#2b9891`, 85% opacity |
| Selected joint marker | `#f59e0b`, 85% opacity |
| Editor grid major/minor | `#adbfc0` / `#dce5e5` |

Anatomy material roughness is 0.8: matte, subdued, with red selection clearly visible.
Lighting combines white/gray-green hemisphere light, warm key `#fff4e7`, and
cool fill `#dce9f8`. Perspective field of view is 34°. Frame the whole exercise,
including equipment and limbs at movement extremes; avoid cropping the demonstration.

Viewer controls: Front, Three-quarter, Side, Back; searchable muscle/group
selection; optional “Show selected only”; count/status text. Camera choices wrap.
Selected anatomy must also be named in text so red is not its only indicator.
Shared 3D studies begin paused, have Play/Pause and a scrubber, and pause when scrubbing.
Current shared viewer canvas is 400px tall, 500px at `sm`; default canvas is 430px.

Z-Anatomy and BodyParts3D attribution appears on the canvas and in supporting text;
rendered media includes its own credit overlay. If reusing those assets, carry over
the original attribution and source license files. The supplied reference names
`public/models/z-anatomy/ATTRIBUTION.md`; that file is absent from the current
studio checkout, so it is not linked as an available source.
The UI style itself does not require copying those models. Pose studies should be
described as illustrations, not measured joint angles or motion-capture recordings.

## 13. Workshop layout and interaction

The workshop is a tool surface, with compact typography and progressive disclosure.

```text
Back link / exercise name / one-line instruction
┌── wrapping toolbar: Add, pose, undo/redo, sensitivity, save ─┐
│ Large preview                    │ 280px controls          │
│ Camera + highlight controls      │ Scene objects           │
│ Optional animation/timeline       │ Selected object/joint   │
│                                  │ Optional advanced tools │
├── save/interaction status ────────┴── camera hint ──────────┤
└────────────────────────────────────────────────────────────┘
```

- Shell: card fill, 18px radius, 1px border; toolbar padding 12px, 8px gaps.
- Tool buttons: 10px radius, 1px border, 12px semibold text, 8px icon gap,
  12px horizontal / 8px vertical padding; disabled opacity 40%.
- Compact editor fields: 10px radius, 8px padding, 14px regular text,
  background fill; numeric joint fields are 64px wide.
- Desktop: flexible preview + 280px control column; preview padding 12px;
  control column padding 16px and left divider.
- Preview is sticky at 12px on desktop, 0px on mobile; controls scroll independently.
- Canvas height: mobile `clamp(220px,35dvh,360px)`;
  desktop `clamp(260px,calc(100dvh - 460px),620px)`.
- Controls max-height: mobile `55dvh`; desktop `calc(100dvh - 240px)`.
- Mobile stacks preview above controls with a top divider.
- Preview instruction overlay uses card/95, 12px type, and ignores pointer events.
- Footer: minimum 40px height, top border, 12px muted text, live status and camera hint.
- Preview layer is `z-10`; floating equipment menu is `z-20`.

Make direct manipulation understandable: select an object, drag to move, use labeled
Move/Rotate/Up/Down controls, or choose a body joint. Provide sliders and numeric
alternatives for precision. Keep selected object and joint names visible.

Current sensitivity defaults to 35%, is adjustable, and persists in the browser.
Undo/redo are available; incompatible controls disable during dragging or saving.
Held equipment explains why arm posing is paused and offers a release action.
Grip choices use plain language: Palm up, Neutral, Palm down.

Animation is optional. Show start/end/intermediate keyframes and readable seconds;
selected keyframe uses primary/10. Equipment animation has its own explicit toggle.
Keep numeric transforms, snapping, resizing, and detailed settings under Advanced settings.

**Companion guidance:** preserve a useful preview when the keyboard opens; account
for small screens and safe areas. A complex editor may need a dedicated screen.
Keep common interactions visible and advanced ones expandable.

## 14. Motion and interaction feedback

Current motion is restrained: button transitions, a 1px press displacement,
2px card hover lift, video loops, and user-controlled 3D playback.

- Global keyboard focus: **2px ring-colored outline, 3px offset**.
- Shared button focus additionally uses a 3px ring at 50% ring color.
- Reduced-motion CSS sets transition/animation duration to 0.01ms and disables
  smooth scrolling. Video respects reduced motion; 3D viewers start paused.
- Do not add automatic camera spins, bouncing panels, or decorative movement.
- **Companion app:** Track's motion durations are 120ms presses, 180ms toggles,
  300ms entrances and 650ms value fills, ease-out except for ease-in-out slides, in
  [motion.tsx](src/components/motion.tsx).
- Show completion near the initiating action; avoid silent save/copy operations.

## 15. Loading, empty, error, and confirmation states

| State | Design |
| --- | --- |
| Loading | Concise muted text in the relevant region: “Loading motion study…” / “Loading body…” |
| Saving | Disable the affected action, show “Saving…”, announce busy/status where appropriate |
| No search matches | Large dashed bordered panel; icon, short title, muted explanation, Reset search |
| Catalog awaiting demos | Same quiet empty panel; “Demonstrations are being prepared” |
| Empty private library | Dashed card, explanation, Create one action |
| Missing demonstration | Muted rounded panel with “Demonstration unavailable.” |
| Model load failure | Clear message and Retry model button |
| WebGL unavailable | Text fallback explaining the browser requirement |
| Request failure | Local alert with a useful next action; preserve context and input |
| Irreversible/revocation action | Confirm the specific consequence; current sharing uses browser confirmation |

Explore's main empty state has a 320px minimum height, 22px radius, centered
content, 30px icon, 20px heading, and 14px explanation with a roughly 384px max width.
Do not replace missing information with fabricated illustrations, counts, or classifications.

**Companion guidance:** the studio has no established skeleton, toast, dialog, or offline
component. Track has a bottom sheet / dialog, an offline notice, inline messages and
the Kine loading pose; reuse those. If adding another, use the same surfaces, borders,
type, and radius scale.
Skeletons should mirror content without shimmer under reduced motion. Offline states
should distinguish cached content from an action that has not been saved/sent.

## 16. Accessibility and small details

Current foundations include semantic forms, fieldsets, labels, focus-visible
outlines, a skip-to-content link, expanded/pressed states, live status text,
reduced-motion support, and responsive layouts.

**Companion guidance / acceptance targets:**

- Aim for WCAG AA text contrast: 4.5:1 normal text and 3:1 large text;
  assess meaningful controls and focus indicators against adjacent surfaces.
- Do not claim compliance from the palette alone. Test actual text, opacity,
  imagery, field states, and both themes.
- Preserve a visible keyboard focus indicator and a logical reading/tab order.
- Expand small touch targets to at least 44px. Hover must not be needed to discover an action.
- Pair status colors with text, icons, or explicit selection state.
- Use heading levels in order, one main page title, and named navigation regions.
- Use alerts for failures and polite status announcements for saves, copies, counts,
  and selected anatomy. Avoid announcing every playback frame.
- If adding a modal/sheet, label it, manage focus, support dismissal, and restore focus.
- Wrap long names and tags. Let secondary descriptions truncate only where intentional.
- Keep page-wide horizontal scrolling absent; scope necessary table scrolling locally.
- Respect text scaling, keyboard visibility, device safe areas, and reduced motion.
- Current language is English and LTR; no RTL design is established. If localizing,
  use logical spacing and mirror directional navigation icons appropriately.
- Dates and numbers should be readable and localized; do not expose database enum syntax.

## 17. Copy and information rules

- Use short, concrete verbs: Explore, Apply filters, Save privately, Copy link,
  Inspect motion in 3D, Save & add details.
- Explain the purpose of a control beside it, especially grip, uncertainty,
  resistance profile, publication, and access permissions.
- Keep muscles, joints, joint actions, movement patterns, families, and equipment
  distinct in labels and UI groups.
- “Reviewed” describes catalog approval. “Private draft” describes owner content.
  A share link grants viewing, and a submission enters review; neither implies publication.
- “Unknown” is valid information. Do not imply that classification is certain by default.
- Avoid medical or rehabilitation claims. Demonstrations and explanations are educational.
- Explain failures in user terms. Keep storage buckets, schema keys, render-worker
  internals, and other implementation details out of ordinary user flows.

## 18. Companion extension guidance

The Application already has theme persistence, Comfortaa and Manrope, Ionicons
outline icons, shared primitives, and its daily/onboarding screens. For future catalog features, the
original handoff sequence remains a reference; it is not a list of current features:

1. Copy the semantic palette into light/dark theme objects and add System preference.
2. Bundle Comfortaa, Manrope and the Ionicons outline set for the companion app.
3. Retain the Application's spacing (20pt gutter, 18pt card padding, 14pt gaps) and
   shared radius scale.
4. Build primitives: text, panel, button, field, tag, divider, disclosure, feedback.
5. Build exercise cards and a 4:3 demonstration component.
6. Build page shells for browsing, detail, forms, and account screens.
7. Adapt navigation and hit targets to the platform while preserving visual hierarchy.
8. Verify real screens in both themes, with long content, empty data, failures, and large text.

Suggested portable names for studio features, mapped to studio values. These
are not the Application's actual token export:

```ts
// Companion guidance: names for a portable design-token layer.
const geometry = {
  spacingUnit: 4,
  radius: { sm: 6, md: 8, lg: 10, xl: 14, panel: 18, largePanel: 22 },
  borderWidth: 1,
  focus: { width: 2, offset: 3 },
  mediaAspectRatio: 4 / 3,
  contentMaxWidth: 1280,
  accountMaxWidth: 1024,
  filterWidth: 285,
  workshopControlsWidth: 280,
};
```

These names are proposed; the palette table contains the exact current color values.
Native dimension units should preserve the same proportions, not literal device pixels.
Do not depend on Next.js, Supabase, or Tailwind to reproduce the visual design.

### Quick visual acceptance checklist

- [ ] Slate blue primary actions; correct light and dark foreground pairings.
- [ ] Comfortaa titles and Manrope text in the companion; Geist in the studio;
  restrained uppercase labels.
- [ ] Correct 14px field / 18px panel radius, rather than default Tailwind radii.
- [ ] Flat bordered panels with selective shadows and consistent spacing.
- [ ] Large, contained demonstrations; figure and equipment remain in frame.
- [ ] Clear page title, one main action per action group, grouped metadata.
- [ ] Responsive cards and filters; no accidental page overflow.
- [ ] Explicit private/reviewed/unknown states; accurate counts and working feedback.
- [ ] Keyboard focus, adequate touch areas, readable scaled text, reduced motion.
- [ ] Credits accompany any reused anatomy/media assets.

For side-by-side review, use Home, Explore, a populated exercise detail, authentication,
and the workshop. Check mobile around **390 × 844** (the existing appearance-test
viewport), desktop around 1440px, and widths immediately around layout breakpoints.

## 19. Source map and maintenance

The table links to the separate studio source. Application sources are linked
in the implementation summary above.

| Design area | Reference |
| --- | --- |
| Colors, radius, base focus/reduced motion | [globals.css](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/globals.css) |
| Font and initial theme | [layout.tsx](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/layout.tsx) |
| Appearance strip and persistence | [theme-control.tsx](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/theme-control.tsx) |
| Shared button variants and sizes | [button.tsx](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/ui/button.tsx) |
| Brand and hero | [Home](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/page.tsx) |
| Search layout and filters | [Explore](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/exercises/page.tsx), [FilterSection](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/catalog/filter-section.tsx), [MobileFilters](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/catalog/mobile-filters.tsx) |
| Card layout | [ExerciseCards](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/catalog/exercise-cards.tsx) |
| Detail structure and tags | [Exercise detail](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/exercises/%5Bslug%5D/page.tsx) |
| Video, selectors, and timed notes | [MediaGallery](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/catalog/media-gallery.tsx) |
| Taxonomy layouts | [TaxonomyLanding](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/catalog/taxonomy-landing.tsx), [Joint action](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/joint-actions/%5Bslug%5D/page.tsx) |
| Authentication | [AuthForm](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/auth/auth-form.tsx) |
| Private form and advanced fields | [PrivateExerciseForm](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/private-exercises/private-exercise-form.tsx), [AdvancedPrivateFields](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/private-exercises/advanced-fields.tsx) |
| Share controls | [SharePanel](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/private-exercises/share-panel.tsx) |
| 3D viewer and playback | [MotionCanvas](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/character/motion-canvas.tsx), [SharedMotion](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/character/shared-motion.tsx) |
| Anatomy colors and highlighting | Supplied reference: `src/lib/motion/anatomy.ts` and `src/components/character/anatomy-controls.tsx`; absent from the current studio checkout |
| Workshop structure and direct manipulation | [MotionWorkshop](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/character/motion-workshop.tsx), supplied reference `src/components/character/studio-controls.tsx` (absent from the current studio checkout) |
| Review comparisons and actions | [ReviewComparison](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/moderation/review-comparison.tsx), [ReviewDecisions](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/moderation/review-decisions.tsx) |
| UI scaffold configuration | [components.json](https://github.com/arielhagay10-ui/KineVault/blob/main/components.json) — Radix Nova, neutral base, CSS variables, Lucide |
| Existing theme/mobile verification | [appearance.spec.ts](https://github.com/arielhagay10-ui/KineVault/blob/main/tests/e2e/appearance.spec.ts) |
| Product intent | [SPEC.md](https://github.com/arielhagay10-ui/KineVault/blob/main/SPEC.md), DESIGN and FILTER UI sections |

When shared tokens or major components change, update this guide in the same change.
For exact current implementation, source files take precedence over an outdated guide.
Keep companion additions explicitly labeled until adopted as shared product rules.

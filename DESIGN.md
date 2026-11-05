# KineVault design guide

> **Track redesign, October 2026.** KineVault Track's colors, type, icons and screen layouts now follow [the redesign notes](docs/redesign-2026-10.md). Where this guide's Track sections disagree with them, the redesign notes win.

This guide covers KineVault Track, the Expo app in this folder, and summarizes the separate [KineVault studio](https://github.com/arielhagay10-ui/KineVault) web app. Track screen layouts are in the redesign notes and feature scope is in [PRODUCT.md](PRODUCT.md). When this guide and the source disagree, the source wins. Update this guide in the same change as a shared token or component.

## Track

### Colors

Tokens live in [tokens.ts](src/theme/tokens.ts). Components use the token names and the values switch with the theme. Color is for meaning only: macros, water, progress and danger.

| Token                   | Light     | Dark      | Use                                   |
| ----------------------- | --------- | --------- | ------------------------------------- |
| `background`            | `#eef2f6` | `#10161c` | Page                                  |
| `card`                  | `#ffffff` | `#18212a` | Cards                                 |
| `elevated`              | `#ffffff` | `#1f2a35` | Menus, popovers, tab bar              |
| `foreground`            | `#172029` | `#e8edf2` | Text                                  |
| `mutedForeground`       | `#52606d` | `#aab8c6` | Secondary text                        |
| `primary`               | `#2c5070` | `#94bdd7` | Filled buttons, selection, active tab |
| `primaryForeground`     | `#ffffff` | `#0f1820` | Text on primary                       |
| `brand`                 | `#3a6a96` | `#94bdd7` | Kine blue: links, avatar, highlights  |
| `brandSoft`             | `#e2ecf5` | `#1e2e3d` | Soft brand tints                      |
| `carbs`                 | `#a4661a` | `#e8ae55` | Honey                                 |
| `protein`               | `#3a6a96` | `#8db3dc` | Kine blue                             |
| `fat`                   | `#b04e72` | `#e58aaa` | Rose                                  |
| `water`                 | `#1f78a6` | `#62c0ea` | Hydration                             |
| `success`               | `#2f7d5b` | `#6fc59c` | Personal records                      |
| `secondary`             | `#e3e9ef` | `#232f3b` | Secondary button fill                 |
| `secondaryForeground`   | `#2c5070` | `#d7e6f2` | Secondary button text                 |
| `muted`                 | `#e6ecf1` | `#232f3b` | Sunken fills: tracks, chips, segments |
| `accent`                | `#d6e0e8` | `#2b3a48` | Subtle emphasis                       |
| `border`                | `#dde4ea` | `#2a3744` | Hairlines                             |
| `input`                 | `#c9d3dc` | `#3b4a59` | Field borders                         |
| `ring`                  | `#4f7fa6` | `#94bdd7` | Focus ring                            |
| `destructive`           | `#b42318` | `#f08a80` | Red buttons                           |
| `destructiveForeground` | `#ffffff` | `#10181f` | Text on red fill                      |
| `danger`                | `#b42318` | `#fca5a5` | Red text and borders                  |
| `dangerSoft`            | `#fbe8e6` | `#3a2224` | Fill behind red actions               |
| `error`                 | `#991b1b` | `#fca5a5` | Error text                            |

Macro colors stay the same in labels, bars and ring arcs. Unfilled tracks are neutral. `LightTheme` ([provider.tsx](src/theme/provider.tsx)) draws its children in the light palette whatever the theme, for the workout share image.

### Type

Comfortaa 600 sets display and title text only. Manrope 400 to 800 sets everything else, including every number, with tabular figures. The launcher and splash wordmark is Comfortaa 700. Native platform fonts are only a fallback if loading fails.

Text variants live in [ui.tsx](src/components/ui.tsx):

| Variant     | Font          | Size / line height | Tracking |
| ----------- | ------------- | ------------------ | -------- |
| `display`   | Comfortaa 600 | 32 / 40            | -0.8     |
| `title`     | Comfortaa 600 | 24 / 32            | -0.6     |
| Hero figure | Manrope 800   | 40 / 46            | -1.4     |
| `heading`   | Manrope 700   | 18 / 24            | -0.2     |
| `body`      | Manrope 400   | 16 / 24            |          |
| `label`     | Manrope 600   | 14 / 20            |          |
| `caption`   | Manrope 500   | 13 / 18            |          |
| `overline`  | Manrope 700   | 11 / 14, uppercase | 1.3      |

- Use sentence case for titles, labels and buttons. Uppercase is only for overlines, which name cards and groups.
- Units sit next to their figure, smaller and muted.
- Text scales with the system setting. Controls and headings must not clip.

### Icons

[Icon](src/components/icon.tsx) takes Font Awesome 6 names and draws the Ionicons outline glyph, falling back to Font Awesome where no outline glyph is mapped. Icons are 18 to 20pt. An icon that leads a row sits in an [icon well](src/components/icon-well.tsx). Decorative icons are hidden from screen readers and icon-only controls have a name.

### Spacing, radius and cards

| Value                                | pt     |
| ------------------------------------ | ------ |
| Screen gutter                        | 20     |
| Card padding                         | 18     |
| Gap between cards                    | 14     |
| Label and caption gaps               | 4 to 8 |
| Max content width, including padding | 768    |
| Minimum touch target                 | 44     |

The spacing scale is `xs` 4, `sm` 8, `md` 12, `lg` 20, `xl` 28.

| Radius    | pt  | Use                     |
| --------- | --- | ----------------------- |
| `panel`   | 24  | Cards                   |
| `control` | 16  | Buttons, inputs         |
| `tile`    | 12  | Small tiles, icon wells |
| `pill`    | 999 | Chips and pills         |

Cards ([Panel](src/components/ui.tsx)) are white on the page tone with a hairline border. Light mode adds a soft two-layer shadow (`cardShadow`); dark mode uses the hairline alone. Don't nest cards. A list inside a card is rows split by hairlines.

### Navigation

- The top bar sits on the page color and has no app name. Home, Food and Exercise show the selected date and a calendar chip. The chip opens a [popover](src/components/popover.tsx) calendar: seven columns, five weeks with the current week tinted in the middle row, round day cells, and previous day, Today and next day controls. These three tabs share the selected date.
- Settings and Profile show their name instead of the date. Profile has a back control. The right slot shows the saved avatar or initials on Kine blue and opens the profile menu.
- While a workout runs, the bar centers its elapsed time on a stopwatch pill that opens the workout. The date shortens to month and day ("Oct 4") and the chip drops its chevron. Below 360pt wide the pill drops the stopwatch so everything fits at 320pt.
- The tab bar (`src/app/(tabs)/_layout.tsx`, tabs in `src/navigation/track-tabs.ts`) floats 16pt from the screen edges, at most 560pt wide. It has four labeled tabs with outline icons, primary for active and muted for inactive, and a soft blue pill that slides behind the active icon. No pill shows on Profile. Screens pad their end by the bar's measured height.
- Tab switches are instant and a tab opens at the top. Food and Exercise keep their state while hidden.
- [ModalSheet](src/components/modal-sheet.tsx) holds small tasks: a bottom sheet below 600pt wide, a centered dialog at 600pt and up.
- Flows that leave the day view open as a [SheetPage](src/components/sheet-page.tsx) that slides up over the tab, a page sheet on iOS, with a round back button. A flow's steps replace each other on that one page. Sub-views start with a [ViewHeader](src/components/view-header.tsx).

### Controls

[Tappable](src/components/tappable.tsx) is the only pressable. It owns the role, name and state, the keyboard focus ring, press feedback, the 0.45 disabled fade and the 44pt minimum target. Press feedback is a 0.97 scale over 120 ms, or a pressed fill for rows and links.

[AppButton](src/components/button.tsx):

| Kind        | Look                                          |
| ----------- | --------------------------------------------- |
| Primary     | Filled slate blue. One per view.              |
| Secondary   | Quiet sunken fill                             |
| Destructive | Red text on a soft red fill, never bare text  |
| Link        | Text only. Back, Cancel and other navigation. |

| Size       | Height                       |
| ---------- | ---------------------------- |
| Regular    | 50pt                         |
| Compact    | 44pt pill                    |
| Small      | 32pt pill in a 44pt hit area |
| IconButton | 48pt round                   |

- [DeleteButton](src/components/delete-button.tsx) turns into a filled red "Are you sure?" on the first tap and deletes on the second.
- [Chip](src/components/chip.tsx) and [SegmentedControl](src/components/segmented-control.tsx) are sunken when idle. A chosen chip gets the primary fill and a raised segment slides to the chosen option. A chip can carry a small caption above its label.
- [Stepper](src/components/stepper.tsx) is a round minus and plus pair around a value.

### Fields and messages

- A [TextField](src/components/text-field.tsx) is a sunken well with a 1px border. Focused, it lifts to the card color with a 2pt ring. Invalid, its border turns red.
- Focus rings follow keyboard focus only.
- Labels sit above fields. Validation and failed saves show inline and keep the draft.
- Feedback sits under what it describes as an [InlineMessage](src/components/inline-message.tsx). A source that can't be read shows a [LoadFailure](src/components/load-failure.tsx) with its retry.

### Loading and empty states

- The [Kine loading pose](src/components/kine-loading.tsx) holds an hourglass on a soft brand disc. Compact instances sit in cards; startup and account loading fill the screen. Kine bobs slowly, has an accessible loading label and no minimum display time. Under reduced motion it stays still.
- Errors keep their explanation and retry action.
- Empty screens show the empty layout with an optional add action. Never fill them with sample records, counts or illustrations.
- Before adding a new state component, reuse ModalSheet, the offline notice, InlineMessage and the loading pose. Skeletons don't shimmer under reduced motion. Offline states tell cached content apart from changes not yet saved.
- Kine artwork, poses and size limits: [mascot guide](assets/mascot/README.md).

### Motion

[motion.tsx](src/components/motion.tsx) holds the shared helpers. Everything runs on the UI thread.

| What                                          | Duration | Curve       |
| --------------------------------------------- | -------- | ----------- |
| Press                                         | 120 ms   | Ease-out    |
| Toggle, popover entrance, tab highlight slide | 180 ms   | Ease-out    |
| Segment slide                                 | 180 ms   | Ease-in-out |
| Entrance                                      | 300 ms   | Ease-out    |
| Value fill: ring arcs, macro bars, water cup  | 650 ms   | Ease-out    |

- List glides and the loading bob use ease-in-out. Kine greets with a short hop.
- Tab switches, search results, figures and closing popovers don't animate. No count-ups.
- Under reduced motion nothing moves; short fades remain. Browser tests default to reduced motion.

### Accessibility

- Aim for WCAG AA: 4.5:1 for normal text, 3:1 for large text. Check real screens in both themes, including opacity, images and field states.
- Keep a visible keyboard focus ring and a logical reading and tab order.
- Touch targets are at least 44pt. No action needs hover to be found.
- Pair status colors with text, an icon or a selected state.
- Use headings in order with one main title per screen.
- Announce failures as alerts and saves, copies and counts as polite status.
- A sheet or dialog has a label, takes focus, can be dismissed and gives focus back.
- Long names and tags wrap. Only intentional secondary text truncates.
- No page-wide horizontal scroll. Scroll wide tables inside their own panel.
- Respect text scaling, the keyboard, safe areas and reduced motion.
- Copy is English and left-to-right. If localizing, use logical spacing, mirror directional icons and localize dates and numbers.

### Copy

- Short, concrete verbs on buttons.
- Copy is short and conversational, with no repeated introductions.
- Explain a control's purpose next to it.
- "Unknown" and "Not available" are valid answers. Don't imply certainty.
- No medical or rehabilitation claims.
- Explain failures in user terms. Keep storage keys, schema names and other internals out of user flows. Never show raw enum values.

## KineVault studio

A summary of the studio web app's design, from its source on 30 September 2026 at a 16px root font size. None of it is built in Track. Track's exercise demo integration is in [docs/exercise-demos.md](docs/exercise-demos.md).

### Identity

An exercise encyclopedia about movement, anatomy, equipment and biomechanics. It looks calm and precise. Demonstrations and real content lead; hierarchy comes from type, spacing and borders. No neon, heavy gradients, fake statistics or decorative charts. Red muscle highlighting means anatomy and is never a brand accent.

### Colors

Source: [globals.css](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/globals.css).

| Token                                                 | Light                       | Dark                        |
| ----------------------------------------------------- | --------------------------- | --------------------------- |
| `background`                                          | `#f6f7f9`                   | `#12171d`                   |
| `foreground`, `card-foreground`, `popover-foreground` | `#192026`                   | `#e5eaf0`                   |
| `card`, `popover`                                     | `#ffffff`                   | `#1a222b`                   |
| `primary`                                             | `#314e65`                   | `#94bdd7`                   |
| `primary-foreground`                                  | `#ffffff`                   | `#10181f`                   |
| `secondary`, `muted`                                  | `#e9edf1`                   | `#25313d`                   |
| `secondary-foreground`                                | `#314e65`                   | `#d7e6f2`                   |
| `muted-foreground`                                    | `#52606d`                   | `#b0bdca`                   |
| `accent`                                              | `#e3ebf1`                   | `#253747`                   |
| `accent-foreground`                                   | `#243f55`                   | `#d7e6f2`                   |
| `border`, `input`                                     | `#ced6de`                   | `#3b4a59`                   |
| `ring`                                                | `#638ba6`                   | `#94bdd7`                   |
| `destructive`                                         | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |

- Translucent surfaces: header and feature cards `card/80`, empty states `card/70`, canvas credit `card/90`, canvas instructions `card/95`. Editor selections use `primary/10`; contextual panels use `primary/5` with an optional `primary/30` border.
- Feedback uses Tailwind colors: inline errors `text-red-700 dark:text-red-300`, form error panels `bg-red-50 text-red-800`, changed review rows `bg-amber-50 dark:bg-amber-950/30` with the word "Different". Notices are muted panels with primary text. Unread notifications get a primary border and an "Unread" label. There is no green success color.
- The scaffold's `chart-*` and `sidebar-*` tokens are unused. Don't build new components on them.

### Appearance and type

- System, Light and Dark, defaulting to System. Web sets the `.dark` class and `color-scheme` before first paint and stores the choice in the `kv-theme` cookie for a year. The 3D scene keeps a light background in both themes.
- One font, Geist, for headings and text.

| Role          | Size / line height                | Weight  | Tracking |
| ------------- | --------------------------------- | ------- | -------- |
| Wordmark      | 20 / 28                           | 700     | -0.05em  |
| Home hero     | 48, 60 at `sm`, 72 at `xl` / 1.02 | 600     | -0.065em |
| Page title    | 36 / 40, 48 / 48 at `sm`          | 600     | -0.055em |
| Auth title    | 30 / 36                           | 600     | -0.05em  |
| Card title    | 18 / 28                           | 600     | -0.025em |
| Body          | 16 / 24                           | 400     |          |
| Label, button | 14 / 20                           | 500–600 |          |
| Helper        | 12 / 16                           | 400     |          |
| Eyebrow       | 12 / 16, uppercase                | 700     | 0.18em   |

Card descriptions truncate at two lines. Intro text stays 512 to 768px wide.

### Layout and shape

- Spacing steps by 4px, with 2px steps in small controls. Card padding is 20px, form panels 24px, grid gaps 16 to 20px, sections 24 to 40px apart.
- `globals.css` overrides Tailwind radii from a 10px base: `sm` 6, `md` 8, `lg` 10, `xl` 14 for fields and actions, `2xl` 18 for cards and media, `3xl` 22 for auth and empty states, `4xl` 26.
- Panels are flat: fill and a 1px border. Shadows only for hover or elevation. Exercise cards lift 2px on hover.
- Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536. Max widths: public pages 1280, account and library 1024, notices 768, auth 448, workshop 1600 new and 1700 existing. Gutters are 24px, 40px at `lg` on public pages and 16px on the workshop.
- Headers don't stick; filters and the workshop preview do. There is no bottom navigation, sidebar or tab bar.
- Brand mark: a Lucide Orbit icon, 23px with a 1.7 stroke, on a 40px primary tile with a 14px radius, 12px from the wordmark "KineVault". Icons are Lucide: 14 to 18px in controls, 20 to 22px in panels, 30 to 42px in empty states. A missing poster shows a 42px Dumbbell with a 1.2 stroke.
- Check layouts at 390 × 844 and around 1440px wide.

### Components

- Button primitive: 14px medium text, 10px radius, heights `xs` 24, `sm` 28, default 32, `lg` 36. Variants are primary, outline, secondary, ghost, destructive and link. Page actions use 14px semibold text and a 14px radius. Pending buttons name the verb: "Saving…".
- Fields: a 14px semibold label 8px above, 1px border, 14px radius, 16px by 12px padding, primary border and a 2px ring on focus. Helpers are 12px muted text below.
- Exercise card: the whole card is one link, 18px radius, a 4:3 contained poster and a 20px body. The grid goes from one to two to three columns with 16px gaps.
- Tags: full pills, muted fill, primary text, 14px, wrapping with 8px gaps.
- Focus: a 2px ring outline with a 3px offset. Reduced motion cuts transitions to 0.01ms.

### Pages

| Page     | Layout                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| Home     | Two columns at `lg`, 0.83 : 1.17, with the motion study as the main visual                                     |
| Explore  | 285px filter panel, sticky 24px from the top, 32px gap. 24 results a page. Mobile filters collapse inline.     |
| Detail   | Columns 1.15 : 0.85, 40px gap. Muscles, joints, joint actions, equipment and patterns stay in separate groups. |
| Taxonomy | A short definition and cards. Joint actions add a 285px filter panel.                                          |
| Account  | 1024px wide with real counts. Drafts say "Private draft".                                                      |
| Auth     | 448px centered card, 22px radius, 30px heading, full-width submit                                              |
| Review   | Comparison table at least 540px wide in its own scroller. Changed rows are amber.                              |

"Reviewed" means catalog approval and "Private draft" means owner content. A share link grants viewing and a submission enters review; neither publishes.

Empty search results use a dashed panel at least 320px tall with a 22px radius, a 30px icon and a 20px heading. Missing media says "Demonstration unavailable."

### Demonstrations and 3D

- Video: 4:3, 18px radius, contained. WebM first, MP4 fallback, poster while loading. Muted, looping and inline. Reduced motion pauses autoplay. No GIFs.
- Anatomy colors are fixed: background `#f7f8f8`, muscles `#8e9994`, skeleton `#ddd8cb`, highlighted muscles `#c33d36`, dark equipment `#263b3b`, joint markers `#2b9891` and selected `#f59e0b` at 85% opacity.
- Equipment metal `#778b8b`, `#627479`, `#516768`; cable `#43565a`, `#34484b`, `#879994`; bench steel `#d1d7d7`, hardware `#718082`, pad `#202526`, rubber `#101718`; editor grid `#adbfc0` and `#dce5e5`.
- Materials have 0.8 roughness. Key light `#fff4e7`, fill `#dce9f8`, 34° field of view. Selected anatomy is also named in text.
- Reused Z-Anatomy and BodyParts3D assets keep their credit and license files.
- Workshop: a preview beside a 280px control column. Canvas height is `clamp(220px,35dvh,360px)` on mobile and `clamp(260px,calc(100dvh - 460px),620px)` on desktop. Sensitivity defaults to 35%. Advanced settings start collapsed.

### Sources

All links point to the studio repository.

| Area                   | Source                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors, radius, focus  | [globals.css](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/globals.css)                                                                                                                                                                                                                                                                   |
| Font and theme         | [layout.tsx](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/layout.tsx), [theme-control.tsx](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/theme-control.tsx)                                                                                                                                                       |
| Buttons                | [button.tsx](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/ui/button.tsx)                                                                                                                                                                                                                                                           |
| Home                   | [page.tsx](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/page.tsx)                                                                                                                                                                                                                                                                         |
| Explore and filters    | [Explore](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/exercises/page.tsx), [FilterSection](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/catalog/filter-section.tsx), [MobileFilters](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/catalog/mobile-filters.tsx)                          |
| Cards                  | [ExerciseCards](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/catalog/exercise-cards.tsx)                                                                                                                                                                                                                                           |
| Detail                 | [Exercise detail](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/exercises/%5Bslug%5D/page.tsx)                                                                                                                                                                                                                                             |
| Video                  | [MediaGallery](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/catalog/media-gallery.tsx)                                                                                                                                                                                                                                             |
| Taxonomy               | [TaxonomyLanding](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/catalog/taxonomy-landing.tsx), [Joint action](https://github.com/arielhagay10-ui/KineVault/blob/main/src/app/joint-actions/%5Bslug%5D/page.tsx)                                                                                                                     |
| Auth                   | [AuthForm](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/auth/auth-form.tsx)                                                                                                                                                                                                                                                        |
| Private exercises      | [PrivateExerciseForm](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/private-exercises/private-exercise-form.tsx), [SharePanel](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/private-exercises/share-panel.tsx)                                                                                             |
| 3D viewer and workshop | [MotionCanvas](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/character/motion-canvas.tsx), [SharedMotion](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/character/shared-motion.tsx), [MotionWorkshop](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/character/motion-workshop.tsx) |
| Review                 | [ReviewComparison](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/moderation/review-comparison.tsx), [ReviewDecisions](https://github.com/arielhagay10-ui/KineVault/blob/main/src/components/moderation/review-decisions.tsx)                                                                                                        |
| Scaffold               | [components.json](https://github.com/arielhagay10-ui/KineVault/blob/main/components.json): Radix Nova, neutral base, CSS variables, Lucide                                                                                                                                                                                                                  |
| Theme tests            | [appearance.spec.ts](https://github.com/arielhagay10-ui/KineVault/blob/main/tests/e2e/appearance.spec.ts)                                                                                                                                                                                                                                                   |
| Product intent         | [SPEC.md](https://github.com/arielhagay10-ui/KineVault/blob/main/SPEC.md), DESIGN and FILTER UI sections                                                                                                                                                                                                                                                    |

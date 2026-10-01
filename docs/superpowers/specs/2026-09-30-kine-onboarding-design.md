# Kine onboarding

Completed September 30 and updated through the October 1 refinements. This
document records the current onboarding contract and its original calculation
sources. [PRODUCT.md](../../../PRODUCT.md) owns current product scope;
[README.md](../../../README.md) owns run instructions and verification commands.

The Expo app uses the original creature Kine, semantic light/dark themes, metric
units, Comfortaa text, and Font Awesome 6 icons. The original mascot selection
remains part of the artwork provenance; screens use the optimized transparent
WebP poses in `assets/mascot/2d/`.

## Experience

Welcome → goal → age → name → body → activity → calories → review. The welcoming
introduction and goal question precede age confirmation; age is checked before
collecting personal details. Setup progress counts the seven steps after welcome,
with a back button and review edit links. Name is optional. Age is required and
must be at least 16. Set up later is available on the age step and enters Home
with the verified age, leaving the other profile details and targets unset.
Users can skip estimation, enter a target manually, or leave it unset.
Review provides edit links. Settings shows the profile and reopens editing.

Goals are lose, maintain, or gain weight. Automatic estimates require age,
height, weight, a female or male formula coefficient, activity, and confirmation
that the standard adult estimate applies. Pregnancy, breastfeeding, and a
prescribed nutrition plan use the manual path. No accounts or permissions.
Users aged 16–17 also use the manual/unset target path. Changing from adult
estimation to age 16–17 clears its previous target. Manual targets remain editable
and survive changes to other profile details, including age.

## Calculation

Mifflin–St Jeor resting energy: 10 × kg + 6.25 × cm − 5 × age + coefficient.
Female coefficient −161; male coefficient +5. Multiply by the chosen approximate
activity factor: 1.2, 1.375, 1.55, or 1.725. Round maintenance to 10 kcal.
Loss subtracts 250 kcal; gain adds 250 kcal; maintenance makes no adjustment.
The ±250 adjustment is an explicit product default, not a personalized medical
recommendation or a prediction of weight change. The final target is editable.
A custom target stays fixed when other answers change, except when an
estimate-enabled profile enters the age 16–17 manual path, which clears the
prior calorie target. Use the estimate also clears the override.
The calculation and a formula source link are available on the calorie screen.
Macro targets start at 50% carbs, 25% protein, and 25% fat of the calorie target.
Convert with 4, 4, and 9 kcal per gram respectively, then round each gram target
to a whole number. This split is an editable app default. Each macro accepts an
independent whole-gram override, including zero. Clearing an override resumes
automatic calculation; custom grams remain fixed when calories change and do
not change the calorie target. The calorie screen shows the macro calorie total
so differing totals are visible. No target weight, pace promise, or logging is
introduced.

## Data and navigation

A version-1 local record holds draft answers and the current step, or completed
answers. Save transitions so reopening resumes at the last saved step.
Finish or skip persists completion before opening Home. Edits stay in memory
until Save changes; Cancel preserves the saved profile.

`src/profile/model.ts` owns canonical record parsing and compatibility.
`src/profile/persistence.ts` owns loading, durable writes, reset, failure state,
and lifecycle cancellation. `provider.tsx` connects that store to React and
AsyncStorage through stable methods. `src/onboarding/flow.ts` owns validation,
step transitions, and staged edits. A successful durable write precedes
publication or navigation; writes exclude other writes synchronously, and stale
reads or callbacks cannot replace a later lifecycle's state. A restart waits for
an uncancelable write before reading the durable record again.

Storage failures keep the screen and answers for retry. Failed initial loads
block writes. Invalid or unsupported records show recovery rather than silently
resetting existing data. Start fresh requires an explicit in-app confirmation
before removing only the profile record. Appearance remains independent.
No network service is introduced; the external formula link opens on demand.

## Validation and accessibility

Names are trimmed and limited to 40 characters. Metric inputs accept decimal
commas or points. Estimated age is an integer 18–100; height 100–250 cm; weight
30–350 kg. These are supported input bounds, not health recommendations.
Age is an integer 16–100 on every path; other manual metrics can remain empty.
Older completed profiles without a supported age keep their answers and return
to the age question for verification. Version-1 records without the new macro
fields remain readable with blank overrides. Calories are integer
1,200–10,000 kcal. Custom carbs and protein are integer 0–2,500 g; fat is integer
0–1,111 g. Blank macro inputs select automatic targets.
Unsupported estimates return no result. These bounds do not establish whether
a target is appropriate for an individual.

Explicit labels, radio semantics, field errors, visible focus, step announcements,
safe areas, keyboard avoidance, scalable text, and scrolling support native and
web use. Kine is decorative on question screens. Keep copy short and humane.

Eight setup screens and four tabs share eleven distinct Kine poses; age reuses
the body pose. Question poses are 152 points; the welcome pose is 280 points. Kine greets
on arrival with a short lift and sway, then stays still while users read and type.
Setup questions move 16 points in the navigation direction over 220 ms;
the progress bar animates over 260 ms and the count fades. Tabs fade over 160 ms.
System reduced motion disables spatial movement and tab transitions; changing
the preference while the app is open stops Kine's greeting.

## Daily screens

The former Today destination is Home. Its full-width calorie count and
horizontal progress bar appear above a row split equally between macro progress
and Kine, excluding the 12px gap. Macro labels and consumed/goal gram counts stay
on one line above their bars, with icons at the right. Workout totals follow,
then steps and water cards side by side. Days remain empty until logging exists;
no activity is fabricated and repetitive empty captions are omitted.

Food and Exercise have a full-width search field, then disabled creation/view
actions beside Kine in the same equal-width split. Food has Breakfast, Lunch,
Dinner, and Snacks / Drinks sections. Exercise shows detailed session totals and
completed-exercise rows when records are supplied. Settings puts its title to
Kine's left using the same split and mascot size. Searches filter the selected
day's available records; they do not query an external catalog.

Screen margins, panel padding, and gaps between cards or form groups are 12px;
local label spacing remains compact. The compact daily header omits the app name
and places a calendar chevron left, selected date center, and profile-picture
placeholder right. Its Sunday-first calendar has seven columns and five week
rows, always centering the current week. Home, Food, and Exercise share the
selected day. Settings has no calendar. Today-following advances at local
midnight or wake; deliberately selected dates remain selected until the user
chooses Today again.

## Verification

Test the hand-calculated formula, all goal adjustments, invalid/ineligible inputs,
custom overrides, optional manual inputs, draft resume, completed record parsing,
and corrupt records. Exercise the real web flow, reload/resume, review editing,
cancel/save editing, skip, manual targets, themes, and storage failure recovery.
Export web, iOS, and Android bundles. Device verification requires an available
native simulator or device and is separate from successful bundle exports.

## Sources

- [Mifflin et al., 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/), original equation.
- [Original paper](https://www.carnotdiet.com/Files/BMRMifflin1990.pdf), rounded coefficients.
- [Activity coefficients research](https://pmc.ncbi.nlm.nih.gov/articles/PMC4383286/), activity-factor convention; not validation for every population.
- [NIDDK Body Weight Planner](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner), adult and pregnancy/breastfeeding scope limits.
- [NIDDK Diabetes Prevention Program](https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-type-2-diabetes/game-plan), advises against intake below 1,200 kcal in that program.

Sources reviewed September 30, 2026. This app uses a simple estimate, not NIDDK's
body-weight simulation model. The activity levels and goal adjustment remain
approximate product choices and are exposed to users as such.

## Delivery evidence

The September 30 delivery established profile setup and its formula. The
October 1 implementation and independent final review include the reordered flow,
macro editing, daily layouts, shared calendar, and storage/lifecycle refinements.

- TypeScript checks and all 84 unit tests pass, covering calculations, supported
  age boundaries, macros, record compatibility, flow failures, controlled storage
  ordering, calendar intent, midnight/wake refreshes, and stale callbacks.
- All 15 Chromium regressions pass, including setup/resume/editing, manual and
  teen paths, recovery, failed saves/resets, calendar sharing, empty daily layouts,
  supplied workout rendering, and responsive geometry at narrow and wide widths.
- Web export generates 11 static routes; iOS and Android bundle exports pass.
- Expo Doctor reports 21/21 checks. Implementation tasks and final cleanups
  received independent review.
- No native simulator or device was available. Keyboard behavior, safe areas,
  gestures, screen-reader announcements, and system text scaling need device testing.

# Kine onboarding

Build a first-run flow inside the Expo app. The selected original creature is
named Kine. Reuse `design/mascot-assets/original-v2.png` in `assets/mascot/kine.png`.
Keep Geist, semantic themes, metric units, and the wordmark-only header.

## Experience

Meet Kine, preferred name, weight goal, body details, usual activity, editable
calorie target, and review. A step count and back button make progress clear.
Name is optional. Set up later enters the app without a profile or target.
Users can skip estimation, enter a target manually, or leave it unset.
Review provides edit links. Settings shows the profile and reopens editing.

Goals are lose, maintain, or gain weight. Automatic estimates require age,
height, weight, a female or male formula coefficient, activity, and confirmation
that the standard adult estimate applies. Pregnancy, breastfeeding, and a
prescribed nutrition plan use the manual path. No accounts or permissions.

## Calculation

Mifflin–St Jeor resting energy: 10 × kg + 6.25 × cm − 5 × age + coefficient.
Female coefficient −161; male coefficient +5. Multiply by the chosen approximate
activity factor: 1.2, 1.375, 1.55, or 1.725. Round maintenance to 10 kcal.
Loss subtracts 250 kcal; gain adds 250 kcal; maintenance makes no adjustment.
The ±250 adjustment is an explicit product default, not a personalized medical
recommendation or a prediction of weight change. The final target is editable.
A custom target stays fixed when other answers change; Use the estimate clears it.
The calculation and a formula source link are available on the calorie screen.
No macro allocation, target weight, pace promise, or logging is introduced.

## Data and navigation

A version-1 local record holds draft answers and the current step, or completed
answers. Save transitions so reopening resumes at the last saved step.
Finish or skip persists completion before opening Today. Edits stay in memory
until Save changes; Cancel preserves the saved profile.

Storage failures keep the screen and answers for retry. Failed initial loads
block writes. Invalid or unsupported records show recovery rather than silently
resetting existing data. Start fresh requires an explicit in-app confirmation
before removing only the profile record. Appearance remains independent.
No network service is introduced; the external formula link opens on demand.

## Validation and accessibility

Names are trimmed and limited to 40 characters. Metric inputs accept decimal
commas or points. Estimated age is an integer 18–100; height 100–250 cm; weight
30–350 kg. These are supported input bounds, not health recommendations.
Manual metrics can remain empty. Calories are integer 1,200–10,000 kcal.
Unsupported estimates return no result. These bounds do not establish whether
a target is appropriate for an individual.

Explicit labels, radio semantics, field errors, visible focus, step announcements,
safe areas, keyboard avoidance, scalable text, and scrolling support native and
web use. Kine is decorative on question screens. Keep copy short and humane.

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

- TypeScript checks and nine unit tests pass.
- Three checked-in Chromium tests pass with `npm run test:browser`.
- Additional browser smoke verified skip/manual setup, edits, themes, failed
  writes, failed initial reads, corrupt-record recovery, and 320/390/1280 px layouts.
- The finish review scored both discovered navigation/validation fixes resolved.
- Web, iOS, and Android bundle exports pass; Expo Doctor reports 21/21 checks.
- No native simulator or device was available. Keyboard behavior, safe areas,
  gestures, screen-reader announcements, and system text scaling need device testing.

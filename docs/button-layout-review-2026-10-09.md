# Button layout review, 9 October 2026

Reviewed KineVault Track in `Application/`. The sibling KineVault exercise studio is a separate product and was outside this app review.

## Findings and fixes

- **Workout creation differed from editing and logging.** Creation now uses the same workout workspace, exercise selector and selected-exercise detail. Settings and close controls share the heading treatment in editing and logging. Creation opens its name/search/order settings immediately and keeps one Cancel action in the footer.
- **Button pairs had uneven widths and heights.** Food, exercise, water, profile and photo forms now use the same equal-column action row. Cancel is on the left and the primary save action is on the right. Labels can wrap; neighboring buttons stretch to the same height. Shared text buttons have a 48-point minimum height.
- **Exercise actions wrapped into irregular clusters.** Tracking choices, ordering controls and saved-workout actions have deliberate columns. Exercise deletion sits separately from Cancel/Save. Existing workout discard/delete confirmation behavior remains intact.
- **Food entries needed compact actions.** Following the requested redesign, names and amounts occupy a wrapping text column, with visible Edit and Remove icons on the right. Each icon has a 48-point touch target. Removal confirmation appears below the entry, so its text cannot squeeze the food name.
- **Food selectors and barcode actions differed from comparable forms.** Food/Meal and Solid food/Drink use matching columns. Serving sizes, meal choices and exercise selectors fill their row height. Barcode lookup uses the same Cancel/primary action order.
- **Photo editing had different action patterns and one missing exit.** Profile-photo and progress-photo forms use Cancel/Save followed by a separate removal action. The native progress-photo source chooser now includes Cancel. Weight editing displays a concise Cancel label while retaining its descriptive accessibility label.
- **Destructive actions had inconsistent colors.** Confirmed weight deletion, account deletion and profile reset now use the existing destructive palette.
- **Food action icons could collide with wrapped labels on small screens.** The shared Food/Exercise action buttons reserve space above their labels for the corner icons.

## Coverage

Source review covered Home, Food search/serving/logging/custom foods/custom meals/barcode/import, Exercise creation/editing/saved workouts/planned workouts/manual logging/active logging/completed editing, Profile Overview/Goals/Photos and dialogs, Settings, account and password recovery, onboarding, calendar/header/profile menu, and loading/error/recovery states.

Rendered checks covered the five main screens and the affected forms at 320, 390 and 768 CSS pixels, plus dark appearance on the main screens and workout editing. Existing browser tests also cover 1280-pixel layouts, both themes, long labels, keyboard behavior, saving, failed saves, confirmation, navigation and draft persistence. Workout creation and food-log geometry assertions were updated to verify the corrected layouts.

## Verification

- `npm run check`: lint, formatting, TypeScript and 874 unit tests pass.
- Browser coverage: 166 tests pass; one optional reference-screenshot test is skipped. Development-only fixture and hardware-Back tests were run against Metro; the remaining flows also ran against the production web export.
- Production web export succeeds.
- Layout detector reports no findings. Rendered checks confirm equal button widths/heights and readable food names during removal confirmation.

Native device access is disabled in this environment. Visual evidence comes from the web build; iOS/Android device layout, keyboard and system font-scaling checks remain unverified.

Screenshots and detailed command output are in ignored `.local-artifacts/button-audit/`.

## Food log redesign follow-up

The user selected compact entries with visible edit/delete icons. Persistent full-width action rows were replaced with icon controls. Tapping the trash icon opens a named confirmation with Cancel on the left and Remove on the right. Cancel and Escape restore keyboard focus to the trash control. Failed removals retain the entry and allow retry; pending writes block duplicate submission. Confirmation handlers follow the active Food screen, so a hidden confirmation does not intercept Android Back on another tab.

The food and exercise top action buttons also use balanced vertical padding, keeping their labels centered while reserving space for their corner icons.

Follow-up verification: `npm run check` passes, including 874 unit tests. All 95 tests in the food UX, drink hydration, onboarding and exercise browser suites pass against the final production export; the separate workout fixture uses Metro. Production web export succeeds. Rendered checks cover 320, 390 and 768 pixels, light/dark appearance, long names, confirmation and keyboard focus. The layout detector reports no findings. Native device checks remain unavailable.

Follow-up command output is in ignored `.local-artifacts/food-log-redesign/`; screenshots were captured through the collaborative browser.

# Home water and profile menu review

All three tasks passed independent reviews for specification compliance and code quality. The combined final review found no Critical or Important issues.

## Delivered behavior

- The Edit water popup opens with the selected day's manually logged amount. Save replaces that amount, and zero clears it. The popup explains that Drinks count separately in the Home total. Its -250 ml and +250 ml controls adjust the draft before saving; legacy daily totals above 10,000 ml remain valid.
- Settings has a required editable daily water goal, defaulting absent or previously unset goals to 1,500 ml while preserving custom goals. A visible confirmation follows a successful durable save. Home displays a compact filling cup beside the water amount using the selected day's manual water and Drinks total. The fill caps at the rim while the actual total can exceed the goal. Unreadable goal data offers recovery rather than an invented goal.
- The header avatar opens Profile, Friends, Messages, KineVault with a clapperboard icon, a separator, Support, and Feedback. All six entries open coming-soon panels, including Profile and KineVault as requested.

## Review corrections

- Water progress now appears in the whole widget's accessible name, so it remains available when screen readers group the button's children. Unknown totals announce unavailable progress.
- The dropdown sits directly below the header and scrolls on short screens.
- Clicking the noninteractive header area closes the profile dropdown.
- Coming-soon panels initially focus the visible Dismiss button. Their hidden click-away backdrop cannot enter the keyboard focus loop.

Each correction passed scoped independent re-review. The final reviewer accepted the small draft parsing duplication and reuse of the existing FoodButton without requiring unrelated refactoring.

## Initial verification

- `npm run check`: TypeScript passed; 333 unit tests passed, zero failures.
- `node --test tests/water.browser.mjs tests/water-goal.browser.mjs tests/drink-hydration.browser.mjs tests/profile-menu.browser.mjs`: 22 browser tests passed, zero failures.
- `node --test --test-name-pattern='35 calendar dates|daily screens fit narrow phones' tests/onboarding.browser.mjs`: 2 existing browser regressions passed, zero failures.
- `npm run export:web`: passed; 11 static routes exported.
- `git diff --check`: passed.
- Isolated phone screenshots confirmed a half-full cup and correctly anchored dropdown without horizontal overflow.

Native device interactions, hardware back, and device screen readers were not exercised. Native APIs and TypeScript were checked; browser interaction, focus, and accessible names were verified.

## Compact cup follow-up

The cup now measures 48 × 60 and sits to the right of Water's title, amount, and unit. Includes Drinks, the goal, and the percentage span the tile below. The tile is 192px tall at 320px screen width, and both activity tiles retain equal dimensions.

The implementation passed an independent review for specification compliance and code quality with no blocking findings. Fresh TypeScript and 11 water/goal browser regressions passed. Layout assertions cover 320/390/768px, both themes, long totals, and unavailable progress. The layout scan and whitespace check passed.

An Android Expo Go emulator screenshot confirmed the compact native layout with 1 litre against a 1,500 ml goal. The temporary test goal was removed afterward, restoring the emulator's previously unset goal. This visual check does not constitute device screen-reader or full native interaction coverage.

## Manual editing, required goal, and KineVault follow-up

Separate implementation agents completed manual water editing, the required goal and save confirmation, and the KineVault rename. Each implementation passed an independent specification and code-quality review with no actionable findings.

Manual-water regressions verify replacement, decreasing the amount, clearing with zero, preserving Drink records and other dates, legacy totals, loading and failure recovery, duplicate submissions, and selected-date changes. Goal regressions verify the default and legacy unset migration, custom-goal persistence, successful same-value saves, pending/failed writes, stale confirmation clearing, unavailable progress, selected-day totals, and responsive cup placement.

The existing responsive Home regression was updated to check its four nutrition bars and the required default cup separately. That test correction also passed independent review.

The final combined review passed with no actionable findings in integration, asynchronous lifecycle handling, data preservation, accessibility, or the manual-water explanation.

Fresh integrated verification:

- `npm run check`: TypeScript and 335 unit tests passed, zero failures.
- Water, water-goal, Drink hydration, and profile-menu browser suites: 27 tests passed, zero failures.
- Existing calendar and responsive browser regressions: 2 tests passed, zero failures, including light/dark at 320/390/1280px.
- `npm run export:web`: passed; 11 static routes exported.
- `git diff --check`: passed.

The collaborative browser also confirmed the empty Home total against its default 1,500 ml goal. This follow-up has browser and model/persistence coverage; it does not add full native interaction or device screen-reader coverage.

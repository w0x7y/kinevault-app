# Body weight history

Profile Overview → Body weight. Log, edit or delete weights in kilograms.

- Weights are 1 to 500 kg, with up to two decimals, using a point or a comma.
- Dates are `YYYY-MM-DD` and start at the day selected in the app header.
- Each date holds one weight. Saving or moving a weight onto a used date replaces it, and the editor warns first.
- The chart shows up to the 30 latest weights, spaced by date. The list shows ten, newest first, and **Show earlier measurements** adds thirty more.

Weights live in the optional `weightEntries` field of `kinevault-track.profile.v1`, so they sync per account. They're separate from `answers.weight`, and logging never changes calorie or macro goals. Starting fresh through profile recovery removes them.

A change shows only after the local save succeeds. A failed save keeps the editor values for a retry. A malformed history opens profile recovery instead of dropping entries. If the account fails to load, use **Retry weight history**.

## Body measurements

The Body measurements card, below Body weight, works the same way. An entry holds any of waist, chest, hips, arm and thigh, each 10 to 300 cm with up to one decimal. Blank fields aren't saved, and an entry needs one value. **Log** on a date that has measurements opens them for editing. The chart shows one measurement at a time, chosen from those with values.

They live in the optional `bodyMeasurements` field of the same Profile document, as `{ date, cm: { waist, ... } }`.

## Tests

`tests/weight-history.test.ts`, `tests/weight-editing.test.ts` and `tests/body-measurements.test.ts`. The browser test, `tests/weight-history.browser.mjs`, needs `KINE_PREVIEW_URL` pointing at a freshly built preview.

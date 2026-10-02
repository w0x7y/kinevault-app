# Food nutrients and barcode import

## Requested behavior

1. Daily macros lists calories, carbs, protein, fat, then the existing detailed nutrients. Carbs uses the existing color and grams.
2. Custom food and meal creation/editing has an optional expandable detailed-nutrients section. Reuse the existing nutrient names and g/mg/mcg units. Blank custom food values mean unknown; explicit zero means known zero. Meal values default to calculated ingredient totals, may be overridden individually for the whole meal, and can return to calculation. Collapsing the section preserves values.
3. A small accessible barcode-icon button on the right of Food search opens scanning. Support product barcodes only, not QR codes. Resolve known products into editable food-creation drafts. Require the user to save before adding a reusable custom food to local search. A small barcode badge marks search items created through scanning. Imported nutrition and brand remain editable; unknown product fields must remain blank rather than invented zero.
4. Barcode imports use Open Food Facts through a fixed product lookup endpoint. Review and edit before saving for offline reuse. Show attribution and useful loading, missing-product and failure/retry states. Keep the 15-second timeout, 15 lookups per minute and five-minute cache capped at 50 entries. Food has Search and Scan controls with a 75/25 split. Previously saved non-scanned imports retain their provenance and have no scan badge.

## Constraints

- Preserve existing uncommitted food-search improvements carried into the isolated worktree as baseline commit 0f941d4.
- React Native/Expo SDK 57, TypeScript, iOS/Android plus web preview.
- Keep version-1 food/meal storage backwards compatible; validate imported and persisted data at boundaries.
- Keep saved log snapshots and saved ingredient snapshots unchanged by catalog edits/deletions.
- Retain drafts on failed saves, prevent duplicate submissions, cancel stale network work and repeated camera detections.
- Request camera permission only when the scanner opens. Offer manual barcode entry for denied permission, unavailable cameras and web/native fallback.
- No arbitrary URL fetching or navigation from scan content; provider host and endpoints are fixed.
- User explicitly selected barcodes only, with a scan-origin badge, not QR sharing.
- Use current flat panels, Comfortaa typography, theme colors, and 12px layout gaps. Icon controls have accessible labels and at least 44px touch targets.
- Every implementation sub-agent receives an independent spec and code-quality review, followed by a final integration review.

## Implementation boundaries

Keep detailed nutrient drafts/validation/forms in the existing food model modules and a reusable detailed-nutrient input component. Keep online product parsing/networking in a separate provider module. Keep scanner camera/permission behavior in its own component, and compose it with the existing Food tab and custom food form. A product import draft is unsaved user-editable data, not a daily log entry.

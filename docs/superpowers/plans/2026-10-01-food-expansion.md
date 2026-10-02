# Food expansion implementation plan

> For agentic workers: use subagent-driven-development; each task gets an independent spec/code-quality review before completion.

**Goal:** Add carbs, optional detailed nutrients, editable barcode imports to Food.

**Architecture:** Preserve offline food search and versioned local storage. Add optional nutrient drafts to current food/meal models; use a separate validated online product adapter and compose scanner/import UI into current Food flows.

**Tech stack:** Expo SDK 57, React Native, TypeScript, AsyncStorage, Node tests, web browser regression tests.

**Spec:** docs/superpowers/specs/2026-10-01-food-expansion-design.md

## Global constraints

- Preserve baseline commit 0f941d4 and all existing uncommitted improvements.
- Support iOS, Android, and web preview; barcodes only, no QR scanning or QR sharing.
- Blank nutrients remain unknown; explicit zero is known; use existing g/mg/mcg units.
- Saved log and ingredient snapshots remain stable after catalog changes.
- Imported products enter an editable draft and are saved only by user action.
- Every implementation agent receives independent spec/code-quality review.

## Task 1: Daily carbs row

Files: src/food/daily-macros.tsx; exact nutrient-order assertions in tests/onboarding.browser.mjs.
Produces: daily-nutrient-carbs row.
- [x] Add carbs row after calories using summary.carbs and theme carbs color.
- [x] Update existing ordered-list regression expectation.
- [x] Run appropriate checks and report; independent review.

## Task 2: Detailed nutrients in food and meals

Files: custom-model.ts, meal-model.ts, create-form.tsx, create-meal-form.tsx, nutrients.ts as needed, new detailed-nutrient fields/validation module, food/meal tests.
Produces: CustomFoodDraft.details?: Partial<Record<DetailedNutrientKey, string>>; MealDraft.detailOverrides?: Partial<Record<DetailedNutrientKey, string>>; optional saved CustomMeal.detailOverrides with finite nonnegative values for whole-meal amounts.
- [x] Add meaningful tests for unknown/zero, unit scaling, editing, parsing old records and overridden meal nutrients.
- [x] Implement optional expandable forms and validation/persistence, retaining drafts when collapsed.
- [x] Run focused model tests and typecheck; independent review.

## Task 3: Online product adapter

Files: new product-model.ts/product-provider.ts; new provider tests. Research report in /tmp/kinevault-food-provider-research.md.
Consumes: Task 2 nutrient draft interface.
Produces: validated product-to-editable-food-draft conversion; barcode lookup with cancellation and request budgeting.
- [x] Verify official provider API details and real responses/CORS.
- [x] Test missing nutrition, unit conversions, barcode validation, provider errors, and abort handling.
- [x] Implement fixed-host requests, attribution, and draft conversion; independent review.

## Task 4: Scanner and import review integration

Files: Food tab, search-actions.tsx, food-result.tsx, create-item-form.tsx/create-form.tsx as needed, new scanner component, catalog metadata parsing, package/app config, new browser regression file.
Consumes: Tasks 2 and 3.
- [x] Add compatible expo-camera dependency and scan button, on-demand permission handling, repeated-scan guard and manual fallback.
- [x] Compose barcode lookup with editable import form. Preserve editing/cancel/save/day behavior.
- [x] Persist product metadata and show barcode badge only for scanned saved items.
- [x] Test provider UI with controlled HTTP fixtures and browser regression; verify typecheck, model tests, web/native export.
- [x] Independent review, fix findings, final integration review.

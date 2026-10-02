# Food module depth implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement all three accepted deepening candidates and fix eligible ingredient counts/paging while preserving the existing Food behavior.

**Architecture:** A Catalog draft owner concentrates retained input/destination rules, a pure Logged food preparation module unifies preview and write decisions, and a Food selection facade hides purpose-specific catalog knowledge. React supplies rendering/subscriptions; existing matching, nutrition calculations, durable persistence, external lookup and camera modules retain their tested seams.

**Tech stack:** Expo 57, React Native/React, TypeScript 6, Node domain tests, existing Playwright regression scripts. No new packages.

**Spec:** `docs/superpowers/specs/2026-10-02-food-module-depth-design.md`.

## Global Constraints

- Whole drink amounts are 1 through 10,000 ml. Drinks automatically log to Drinks and add hydration only after the food-log write succeeds. No gram mass is inferred.
- Unknown volume basis requires all four label values per 100 ml, keeping missing separate from known zero. Saved snapshots stay authoritative.
- A Catalog draft lives in memory for the Food draft owner's existing lifetime. Day changes continue to reset daily views but preserve reusable drafts; no permanent autosave is added.
- Cancel explicitly discards the matching draft. A successful save retires the matching session; a failed save retains all input. Successful deletion retires only that item's draft after durable success.
- Ingredient selection excludes Custom meals and volume-only Custom drinks but retains bundled drinks with real source gram nutrition. Eligible rows fill pages, and totals/pagers describe only those rows.
- Filtering before paging is an explicitly accepted behavior fix within this implementation. Other search ordering and user-visible behavior are preserved.
- No new dependencies, network search, accounts, sync, storage key/version changes, inferred density or Product import provenance changes.
- Preserve current camera/barcode work, keyboard dismissal, saved feedback, detailed nutrient zero/null semantics and selected-day lifecycle.
- Do not touch user profile/log/catalog/water data, stop the existing original Expo server, merge/push/create a PR, or commit the original dirty checkout.
- Helper `/home/idan/.codex/worktrees/kinevault-food-architecture` is the only implementation workspace. Root owns helper Metro8086, without CI watch suppression. Existing browser regressions use `KINE_PREVIEW_URL=http://localhost:8086`. Workers do not stop/start servers or spawn subagents.

## Task 1: Deepen Catalog draft ownership

**Files:** Create `src/food/catalog-drafts.ts` and `tests/catalog-drafts.test.ts`; modify `src/food/draft-provider.tsx`, `create-form.tsx`, `create-meal-form.tsx`, `create-item-form.tsx`, `custom-item-actions.tsx`, `product-import.tsx`, `nutrition-detail.tsx`, `src/app/(tabs)/food.tsx`, relevant `tests/food-ux.browser.mjs` and `tests/drink-hydration.browser.mjs`, and `CONTEXT.md` for Catalog draft vocabulary.

**Consumes:** Existing CustomFood/CustomFoodDraft and CustomMeal/MealDraft conversion, custom persistence actions and Product import metadata. No permanent catalog persistence changes.
**Produces:** `createCatalogDrafts` as an in-process owner with stable `getSnapshot`/`subscribe`, meaningful domain session operations for opening/adopting/resuming/editing/discarding/retiring and typed targets. React `FoodDraftProvider` supplies the owner and curated snapshot. Preserve `useFoodDrafts().mealIntent`, `setMealIntent(meal: Meal)`, `creationKind`, `setCreationKind(kind: CatalogKind)` as used by neighboring tasks. Hide raw `records`, string-key construction and manual restoration ordering from all rendering callers; remove retired `foodDraftId`/`mealDraftId` public interfaces after migrating callers.

Implement a coherent owner, not a bag of forwarding helpers. The module owns field retention and mode-basis values, and opening a session restores its own retained destination. Callers render the current session; resumable summaries expose opaque identity/display info. It is acceptable to choose precise domain operation names within this task; document the actual complete interface in its report. Stable handles protect a replacement session from completion of an older save. Keep validation display state local, but eliminate local-draft plus owner-record mirroring. Copies prevent editable input from mutating saved catalog/ingredient snapshots. Distinguish imported/manual barcode identities and existing item kinds.

- [ ] Write focused interface tests before source. Use real draft strings such as a Snacks import retained with carbs `42`, another Lunch creation, and a Dinner catalog edit resumed after switching views. Assert returned editable values/destination and successful/failed retirement through domain actions, not map keys.
- [ ] Run `node --experimental-strip-types --test tests/catalog-drafts.test.ts`; capture expected missing-owner failure.
- [ ] Implement owner and migrate all named callers. Preserve simultaneous independent food/meal creation drafts, reentry after catalog edit Cancel/Save, import retained-edit precedence, successful-save-only cleanup, and affected-item deletion. Add solid/drink basis retention across pause/resume without pretending gram labels are ml labels.
- [ ] Extend browser acceptance for food/drink label-mode pause/resume and independent draft retirement if existing journeys do not prove those. Keep all existing destination/save/failure/keyboard assertions; do not weaken or delete coverage to accommodate the refactor.
- [ ] Run typecheck, focused catalog/custom/food tests, `KINE_PREVIEW_URL=http://localhost:8086 node --test --test-concurrency=1 tests/food-ux.browser.mjs tests/drink-hydration.browser.mjs`, then one full unit suite before commit. Root owns final all-browser/export checks.
- [ ] Self-review and commit only Task1 files. Write task report with interface, changed paths, red/green evidence, exact commands/results and concerns. Review gate follows before Task2.

## Task 2: Deepen Logged food preparation

**Files:** Create `src/food/logging-preparation.ts`, `tests/logging-preparation.test.ts`; modify `src/food/nutrition-detail.tsx`, `logging-controls.tsx` and necessary `log-model.ts` plumbing, focused drink/food browser tests, and `CONTEXT.md` for Logging attempt vocabulary.

**Consumes:** Task1 `useFoodDrafts().setMealIntent(meal: Meal)`/mealIntent; existing `FoodSaveTarget`, `AddFoodInput`, `EditFoodInput`, source resolver `FindFood`, nutrition calculations and durable log persistence.
**Produces:** `prepareFoodLogging({ target, date, fields, findFood, catalogItem })` in the pure preparation module. `fields` contains entered gram/ml strings, chosen Meal and four label strings. `catalogItem` is optional current saved item/source information used for beverage recognition; `findFood` is the existing source adapter. The returned discriminated result supplies measurement/required-label guidance, invalid/incomplete reason or ready nutrition and add/edit write input. Ready input must be exactly the basis shown; invalid input carries no executable write. Named fields/variants may be sharpened without widening into independent flag bags, document actual complete contract.

Move recognition, amount parsing, label requirement/validity, nutrition choice and write construction out of detail/control callers. Detail keeps input/focus/servings rendering. Controls accept the preparation result plus UI callbacks and submit its ready write through existing log.add/edit, without choosing gram versus volume again. Keep selected-day capture, mounted/pending protections, failure retention and fixed meal overrides. Data parse/durable-write checks remain useful independent validation, not a parallel presentation policy. Preserve shared detailedNutrientsForEntry and saved snapshots; no new global catalog dependency.

- [ ] Write interface tests before source. Exercise solid source 100g/225g, known Cola 250ml, unknown basis blank versus explicit zero, legacy known-ml missing-detail source fallback, legacy missing ml requiring label, invalid/decimal/out-of-range ml, custom meal snapshot overrides and current catalog food-to-drink edits. Assert shown nutrition equals nutrition of the prepared write via existing entry construction; assert invalid results cannot expose writes.
- [ ] Run the new focused test and capture missing-preparation failure.
- [ ] Implement preparation and migrate preview/save rendering so coordinated flags and duplicate selection logic disappear. Keep actual source calculations and legacy interpretation authoritative.
- [ ] Run typecheck, focused preparation/beverage/log/legacy nutrient domain cases; browser drink-hydration and drinks plus the Food UX portion/focus case. Add a focused failure/retry or invalid-label browser scenario only if current coverage misses the new wiring.
- [ ] Run one full unit suite, self-review, commit only owned paths, and report red/green/results/contract/concerns. Review gate follows before Task3.

## Task 3: Deepen Food catalog selection and fix eligible paging

**Files:** Create `src/food/catalog-selection.ts`, `tests/catalog-selection.test.ts`; modify `src/food/catalog.ts` paging capability only as needed, `custom-provider.tsx`, `ingredient-search.tsx`, `search-results.tsx`, `nutrition-detail.tsx`, `src/app/(tabs)/food.tsx`, relevant existing tests and `CONTEXT.md`, `README.md` for active module descriptions.

**Consumes:** Existing CatalogFood/CustomFood/CustomMeal, createFoodCatalog and matching policy, Task1 draft owner and Task2 preparation. Do not alter matching implementation or rewrite draft/logging rules.
**Produces:** `createFoodSelection({ savedFoods, savedMeals, bundledFoods })` with `search({ purpose: "logging" | "ingredient", query, page })` and `savedItem(customId)`. Search rows carry food/kind/genericMatch; totals/paging and exclusions are coherent for their purpose. `CustomFoodProvider` exposes the selection module instead of requiring callers to pick raw catalogs and scan stored arrays. Current createFoodCatalog default search remains compatible with existing domain tests.

The module owns saved/bundled assembly, saved item resolution/classification and eligible-before-pagination rule. Keep current matching/ranking implementation and query tolerance, protected qualifiers, exact saved-brand precedence, generic drink attribution and imported provenance. Ingredient search excludes Custom meals and volume-only foods, uses source grams for usable drinks, counts only eligible rows and clamps stale page after catalog edits/deletions. Explain matching but unusable volume-only drinks even when no selectable results exist. Move row/selected-item kind knowledge out of storage-array caller scans. Deepen, do not merely move the same filtering or lookups behind unrelated thin helpers.

- [ ] Write interface tests before source: 25 matching volume-only drinks mixed with 25 selectable gram foods should yield eligible total25 and pages20/5 without duplicates; all-volume query should return eligible0 plus positive exclusions; logging retains all food/meal records. Verify saved food and meal identity after reconstruction/edit/delete, matching/generic metadata and stable ranking. Test page invalidation after shrinking saved catalog.
- [ ] Run new focused tests and capture expected missing-selection failure.
- [ ] Implement facade and catalog paging support; migrate provider, global search, ingredient search and saved-item resolution callers. Remove obsolete catalogs/array knowledge only after every caller migrates.
- [ ] Add browser proof with enough volume-only Custom drinks to occupy an old first page, eligible solids on multiple pages, displayed counts/controls aligned, and all-volume guidance. Preserve existing saved edit/delete and generic/exact ingredient scenarios.
- [ ] Run typecheck, focused catalog/dynamic/drink/custom/meal domain tests and relevant browser food-expansion/drinks. Run one full unit suite; self-review, commit and report. Root handles final full-browser/all-platform checks and broad independent review.

## Completion

- [ ] Independently review every task for spec and quality; fix important findings through the same worker and scoped re-review. Final whole-branch reviewer gets the entire range from bc68d09 including docs.
- [ ] Run final typecheck, all domain tests, all browser tests and clear Android/iOS/web export from final helper source.
- [ ] Copy approved changed files to original only after baseline collision check; verify unrelated hashes and original main HEAD remain unchanged. Run original typecheck/domain checks and non-writing live preview smoke.
- [ ] Archive this plan's review evidence, remove only its ignored scratch directory, stop only helper8086, retain helper branch as backup, and report actual verification outcomes.

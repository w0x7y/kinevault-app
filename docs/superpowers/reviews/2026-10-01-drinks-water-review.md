# Drink search and Home water entry review

Both implementation tasks received independent specification and code-quality reviews. The drink ingredient-search labeling finding was fixed and re-reviewed. The final combined review passed with no remaining findings.

## Verification

- TypeScript and all 183 unit tests passed.
- All 43 browser tests passed, including two drink-search and six water-entry regressions.
- Web, iOS, and Android exports passed.
- Collaborative browser confirmed the Home water widget opens the entry form and Cancel closes it.
- Android Expo Go confirmed the water widget, entry form, numeric keyboard, and visible Add/Cancel controls. The sample amount was cancelled; no user water record was saved.
- Existing USDA drink nutrition, identities, and serving weights remain unchanged. Generic aliases are labelled in food and ingredient search; exact product lookup remains available through Scan.
- Water totals are independent per date and persist separately from food logs. Failed saves retain entered amounts, unreadable storage is protected, and tests cover duplicate taps and delayed saves across date changes.

## Independent reviews

The records below include the initial drink finding and the follow-up verdict resolving it.


# Beverage search review

Reviewed the supplied four-file diff and current callers in `Application`. No application files changed and no tests rerun. Root owns final verification.

## Spec verdict: changes required

- **P2: Generic beverage guidance is missing in meal ingredient search.** `src/food/catalog.ts:50-62` exposes generic aliases through every catalog, but `src/food/search-results.tsx:49-54` renders the generic notice only in the main food search. `src/food/ingredient-search.tsx:15,22-23` also calls the shared search and discards `genericDrinkKeys`. Trigger: create or edit a meal, search ingredients for `Pepsi` or `drpeper`, and select a returned USDA drink. The row supplies generic USDA nutrition without the required per-row generic/exact-product guidance. Consume the metadata in IngredientSearch too, preferably through the shared FoodResult presentation, while retaining the USDA identity and nutrition.

Other requirements pass inspection: aliases attach only to the validated built-in USDA ID/name/category combinations; original objects, nutrition, weighed-gram portions, and IDs are preserved; multiword and hyphenated spellings use existing normalization; zero/diet/sugar-free queries select appropriate generic diet variants; Monster zero targets the existing sugar-free Monster record; exact saved/custom name or brand matches precede generic aliases; totals and generic metadata use the current result page; offline search and existing prefix matching remain intact. Both custom-food and custom-meal catalogs continue using the shared search implementation.

The new tests read and validate the bundled real dataset and cover variant selection, saved-product priority, identity preservation, bounded attachment, and pagination. They currently do not exercise generic guidance in the meal ingredient UI.

## Code-quality verdict: pass

No additional correctness or maintainability findings. The alias table keeps exceptional brand mappings separate from the tokenizer and returns search metadata without altering food records. No introduced casts, fabricated product nutrition, persistence changes, or extra network dependencies.

One P2 spec finding; zero additional code-quality findings. Recheck IngredientSearch labeling after the fix.

## Scoped follow-up verdict: pass

The prior P2 finding is resolved. `IngredientSearch` and `FoodSearchResults` now pass the current page's `genericDrinkKeys` into the shared `FoodResult.genericMatch` prop. `FoodResult` renders the notice inside the affected row and adds the same guidance to its accessibility hint. Its false default and the catalog's existing bounded metadata keep actual Monster records and saved/custom products free of generic labels.

The two added browser cases meaningfully exercise main-search notices, ingredient-row notices, exact saved-product priority without false labeling, existing Monster matches without false labeling, and preservation of USDA nutrition when logging a weighed portion or adding a meal ingredient. The ingredient test checks the notice inside the specific generic row, so it covers the original missing-guidance failure. Accessibility guidance is verified by source inspection; these browser assertions do not inspect the accessibility hint itself.

No new spec or code-quality findings. This follow-up reviewed the changed presentation and browser tests without changing source or repeating tests. Worker-reported test results remain subject to root's final integrated verification.


# Water entry review

PASS. No actionable spec or code-quality findings in the 11-file water diff.

Reviewed the complete `/tmp/kinevault-drinks-water-review/water-review.diff`, current source in `Application`, and `water-report.md`. This was an independent source and test review. I did not edit app files, rerun tests, create subagents, or make commits.

## Spec

- `src/daily/activity-widgets.tsx:35`: the complete Water tile is a pressable button with an accessible action label and focus feedback. Its dimensions, panel border/radius, and row spacing preserve the existing Steps/Water layout. Steps remains the original panel.
- `src/water/entry-modal.tsx:23`: validation accepts only whole millilitre amounts from 1 to 10,000; the labelled field, 250/500 presets, Add water, Cancel, visible date, read retry, and error feedback are present. Failed saves retain the draft. Both the local submission ref and store write guard prevent duplicate submissions before React updates the disabled button.
- `src/water/model.ts:14`: missing storage creates an empty version 1 document; malformed JSON, unsupported versions, invalid dates, negative/fractional/unsafe totals fail validation. Additions accumulate only at the requested date and reject overflow.
- `src/water/persistence.ts:26`: read failure and corruption produce an error state and block writes. Retrying invalidates stale reads; a later stale read cannot replace a successful save. A pending write prevents competing writes or reloads.
- `src/water/persistence.ts:61`: the input is serialized before awaiting storage, and the new total is published only after the durable write succeeds. Failure leaves the previous document intact. Stop/start on the same store waits for its uncancelable write, then reloads durable data before accepting another save.
- `src/app/(tabs)/index.tsx:41` and `src/water/entry-modal.tsx:19`: date mismatch immediately hides the old modal; date changes clear its draft. Saves retain the original form date. The unmounted form guard and scoped dismissal prevent an old save completion from closing a newly opened form.
- `src/app/(tabs)/_layout.tsx:25`: WaterLogProvider wraps every tab alongside the existing food providers and day provider. Food and Exercise still have the contexts required by `useDayActivity`.
- `src/daily/use-day.ts:13`: water comes solely from its own date-keyed document. Existing food selection and nutrition summarization are preserved. No cola/soda-to-water conversion exists. Loading/error water is rendered as an unknown total and does not block ready food content.

## Code quality and validation evidence

The model, persistence controller, provider, and form have clear boundaries and follow the existing repository storage/provider pattern. No unsafe casts or unrelated changes were introduced in this scope. No maintainability finding warrants a change for this feature.

The 9 unit tests inspect durable data and snapshots rather than just method return values. They cover exact retry, per-date accumulation, input capture, stale reads, rejected competing saves, corrupt data protection, and an uncancelable write across stop/start. The 6 browser tests exercise actual Home controls and storage with isolated contexts. Their injected delayed promises are meaningful: the installed AsyncStorage web adapter resolves the return value of localStorage calls, so the injected promises genuinely delay its completion. The pending-save browser case also verifies that the new-date form remains open after the original save finishes.

The worker reports 9 unit tests, 6 browser tests, typecheck, and diff check passing after the final source changes. Those results were inspected, not independently rerun. Native keyboard and screen-reader interaction were not exercised by this review; the root task is checking Android UI and running final suite/build validation.


# Final integration review

PASS. No actionable correctness, integration, or scope findings in the supplied drinks and water delta against the copied dirty baseline.

Reviewed `final-review.diff`, the task reports and follow-up reviews, current changed source, shared catalog/provider callers, and the added unit/browser tests. No application edits, test reruns, subagents, staging, or commits were performed.

- The tabs provider tree supplies water state to every `useDayActivity` caller. Home uses the selected date for display and entry, closes stale-date drafts, and protects a newly opened form from an older save completion. Food nutrition aggregation remains independent.
- The separate versioned water key preserves existing food and profile storage. Missing data starts empty; malformed or unavailable data blocks writes and displays an unknown total. Successful writes publish their durable totals; failed writes retain the previous total and draft. Store and form locks cover duplicate submissions, and read/lifecycle generations prevent stale publication.
- Drink aliases are bounded by built-in USDA ID, exact name, category, and absence of custom identity or brand. Both catalogs preserve original food objects and gram-based nutrition. Diet/zero qualifiers avoid regular sugary generic matches, actual Monster records retain their identity, and direct saved-product matches precede generic aliases.
- Both main food search and meal ingredient search consume current-page generic metadata through the shared FoodResult. The earlier ingredient guidance finding is resolved. Existing callers remain compatible with the additional search metadata.
- The tests exercise meaningful persisted outcomes, dated totals, failed-save retry, corrupt-read protection, duplicate and delayed operations, generic guidance in both entry paths, exact saved-product priority, and unchanged USDA nutrition. Browser fixtures use fresh isolated contexts. Documentation describes the implemented behavior accurately.

Validation evidence was supplied by the root agent: 183 unit tests, typecheck, 43 browser tests, and web/iOS/Android exports passed. The root also reports checking Android widget/modal visibility, numeric keyboard, and Cancel without saving sample data. This review inspected source and tests independently; it did not repeat those executions or native interactions.

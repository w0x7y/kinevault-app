# Food UX cleanup

Approved scope: user's 2026-10-02 choice prioritizes clearer search and all five review priorities. Review/design: docs/research/2026-10-02-food-tab-ux-design-assessment.md.

## Global Constraints

- Keep two Search/Scan controls at a 75/25 flex split, existing Scan color, Kine even split, Comfortaa, Font Awesome6, shared palette and >=44px touch targets.
- Barcode only; scan badges mark barcode imports only. Preserve product identity and diet/caffeine/preparation distinctions.
- No paid dependencies/services, no new online requests while typing. Saving catalog items must not log intake.
- Preserve existing dirty main workspace; implement/commit only isolated helper branch, then copy only approved task changes back with baseline comparisons. No push/merge/PR.
- Draft retention is in-memory during Food-tab use, not automatic permanent catalog saving. Explicit Cancel discards only that draft; successful save clears it. New food/meal, catalog edits and imported-food review must not silently lose entered values during global Food navigation. Hidden imports must abort pending requests and release cameras.
- Larger suggestions (Favorites, Recent foods, Undo, daily summary, volume model) are outside these five priorities.

### Task 1: Clearer search

Read relevant food components and simplify repeated guidance. In food-result.tsx use a concise Generic label while retaining an accessible generic hint. Main search-results.tsx should show one generic explanation per list, including mixed generic/result lists. Ingredient search should also have one generic explanation. Keep visible nutrition basis per100g unambiguous and all dietary variants unchanged. Preserve existing friendly barcode errors, local pagination and import attribution. Update existing browser assertions for changed copy; do not add mirror-the-copy unit tests. Commit and self-review.

### Task 2: Preserve unfinished drafts

Implement in-memory draft retention in the Food flow for new custom foods/meals, catalog edits and imported review. Returning to the appropriate create/edit/import task restores values, ingredient amounts, nutrition overrides and details. Explicit Cancel discards that draft, Save clears after confirmed success, failures retain draft. Expose an accessible Resume draft action when needed for an imported draft or editor whose route would otherwise be lost. Keep draft ownership/lifecycle clear using existing typed models; avoid permanent autosave or holding inactive cameras/requests. Cancel/back/date/tab changes must preserve proper request aborts. Tests must cover the reproduced create-name→global search→return loss, meal ingredients, explicit discard, successful-save reset, and imported review/edit resumption; use existing browser harness on isolated origin. No global app-storage clearing except isolated automated contexts. Commit and self-review.

### Task 3: Simpler logging and inline save feedback

Add compact Add food controls to all daily meal headers, with named accessible labels. Entering from a meal focuses existing search and carries meal destination through local search, barcode review, catalog creation and final logging; let user change destination. Avoid inferring from time for historical dates. Move serving choices into the amount section before nutrition and FoodLoggingControls; preserve per-portion calculations. Replace FoodCreatedNotice modal with a nonblocking inline Saved to your foods/meals status on the detail screen; successful catalog save stays distinct from intake. Keep day/date context explicit. Update existing browser tests that dismissed FoodCreatedNotice; meaningful scenarios cover Lunch Add→portion→Log to Lunch, Snacks/Drinks→import/save→correct destination, no dialog after save and no intake until Log. Update PRODUCT.md/DESIGN.md/README if behavior descriptions become stale. Commit and self-review.

## Validation

Baseline and final npm run typecheck, npm test. Existing browser suite against helper/original local isolated test origin; fix actual regressions and update only intentionally changed UI assertions. Inspect T3 preview first when available; Android live screenshot/manual smoke, clearly distinguish web from physical iPhone. Final broad review of task commits and safe transfer to original, final typecheck/smoke as appropriate. Keep original Cloudflare server running.

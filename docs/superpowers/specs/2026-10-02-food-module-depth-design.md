# Food module depth

The user authorized implementation and fixes for all three candidates in `/tmp/architecture-review-20261002-124856.html`: Custom food/meal draft ownership, Logged food preparation shared by preview and save, and Food catalog selection rules. The architecture walk is `/tmp/architecture-review-20261002-124856.walk.md`. This spec records the concrete scope for execution; the user already requested implementation.

## Goal and seams

Move domain rules out of rendering callers into three cohesive modules with small interfaces. Preserve existing deep search matching, meal calculation, nutrient fallback, Product lookup and durable persistence modules. Their tested seams and adapters stay useful. This is architectural work on the current Food flow, not a new persistence framework or a UI redesign.

## Catalog draft ownership

A Catalog draft is unfinished editing of a reusable Custom food or Custom meal, including a Product import under review and the retained meal destination. It lives in memory for the Food draft owner's existing lifetime. A domain module owns identity, fresh versus retained input precedence, destination restoration, switching creation kinds, import adoption, field changes, food/drink label basis switching, discard, and retirement after confirmed catalog save or deletion. The React provider subscribes and supplies this module; callers no longer inspect raw records or construct storage keys.

A typed session/target distinguishes new food, new meal, existing food/meal edit, and reviewed import. Resumable summaries expose opaque identity plus display information, not map layout. The module may expose purpose-specific session operations, but it must hide record keys and ordering obligations. Keep `mealIntent`, `setMealIntent`, `creationKind`, `setCreationKind` behavior available to rendering callers; these belong to the owner and restore retained destinations centrally. Nutrition display does not manually restore destination from a record.

Forms retain transient strings, validation and failed-save feedback. The owner stores editable state so forms do not mirror a separate local copy into raw records. Opening the same import prefers retained edits without a second request, and preserves provider/method/barcode/brand/volume metadata. Both creation drafts remain independent and selection changes restore each draft's destination. Food/drink basis values are separate; no gram values become ml values without a real basis, and temporarily switching or pausing a draft does not lose the other mode's values.

Cancel explicitly discards the matching draft. A successful save retires the matching session; a failed save retains all input. Successful deletion retires only that item's draft after durable success. Retiring an old session must not remove a newer replacement. Day changes continue to reset daily views but preserve reusable drafts; no permanent autosave is added.

## Logged food preparation

A Logging attempt combines an add/edit target, Selected day, entered amount/label strings, chosen meal, and source lookup into one coherent result for both preview and save. A pure in-process module owns gram versus volume decisions, required label values, allowed amount ranges, authoritative nutrition calculation, preview, and the exact add/edit write input. Callers render fields and feedback and submit this result; they do not assemble independent `beverage`, parsed grams/ml, label validity, and basis flags.

The preparation result discriminates ready from incomplete/invalid input and gram from volume measurement. Ready results carry the nutrition shown and an add/edit input for the existing log persistence module. Incomplete input has no write input. Validating stored data and publishing after durable write remain responsibilities of existing log model/persistence. Source lookup continues to use the real bundled catalog adapter and fixture lookup adapter, without hidden global lookup inside the pure module.

Whole drink amounts are 1 through 10,000 ml. Drinks automatically log to Drinks and add hydration only after the food-log write succeeds. No gram mass is inferred. Unknown volume basis requires all four label values per 100 ml, keeping missing separate from known zero. Saved snapshots stay authoritative; known legacy ml scales existing snapshots and recovered absent detailed snapshots using genuine stored grams. Legacy missing ml requires entered ml and label nutrition. Solid grams, source servings, source-gram ingredients, custom meal overrides and quantity previews remain supported. Failure retains fields/destination; pending duplicate taps and stale navigation remain excluded.

## Food catalog selection

Ingredient selection chooses a Catalog food with genuine gram nutrition for a Custom meal. A selection facade owns assembled saved/bundled catalog knowledge, saved-item identity and kind resolution, result metadata, logging versus ingredient purpose, and eligibility before pagination. Rendering callers do not scan stored food/meal arrays or filter already paged rows.

Use `createFoodSelection({ savedFoods, savedMeals, bundledFoods })` with `search({ purpose: "logging" | "ingredient", query, page })` and `savedItem(customId)`. Results provide selectable rows with their food, kind and generic-match marker, total/page information and enough exclusion information for honest volume-only ingredient guidance. `createFoodCatalog`'s current search interface and the accepted matching implementation remain compatible for existing callers/tests; the facade may deepen its internal paging support. Rank eligible matches using existing matching policy, then calculate total and slice a page. Do not reimplement normalization, fuzzy ranking, joined-word/qualifier rules or brand aliases.

Logging includes Custom foods, Custom meals and bundled records. Ingredient selection excludes Custom meals and volume-only Custom drinks but retains bundled drinks with real source gram nutrition. Eligible rows fill pages, and totals/pagers describe only those rows. Query results with only excluded volume-only drinks explain why they cannot be ingredients rather than claim there were no matching records. Saved item lookup reflects successful add/edit/delete; logged and ingredient nutrition snapshots remain isolated. Row nutrition uses the existing purpose-specific gram/ml display.

Filtering before paging is an explicitly accepted behavior fix within this implementation. It changes ingredient totals and page membership. Other search ordering and user-visible behavior are preserved.

## Constraints and verification

No new dependencies, network search, accounts, sync, storage key/version changes, inferred density or Product import provenance changes. Preserve current camera/barcode work, keyboard dismissal, saved feedback, detailed nutrient zero/null semantics and selected-day lifecycle. Do not touch user profile/log/catalog/water data, stop the existing original Expo server, merge/push/create a PR, or commit the original dirty checkout.

Implementation happens in `/home/idan/.codex/worktrees/kinevault-food-architecture`, on `codex/deepen-food-modules`, matching the original current source at baseline `bc68d09875879ffb62c3947564c7b9a862022797`. Root copies only independently reviewed deltas into the original app after checks, verifying baseline and unrelated-file hashes. Each implementation receives a separate spec/quality review; fixes receive scoped re-review. A final whole-branch review precedes completion.

Test through the modules' interfaces with actual domain fixtures and existing storage/lookup stand-ins. Preserve behavioral browser journeys for visible draft retention, save/retry/delete, keyboard and hydration. Add focused coverage for session retirement and mode-basis retention, preview/write agreement and invalid input, ingredient filtering before paging, saved identity and reconstruction. Complete typecheck, all unit and browser tests, Android/iOS/web exports, and a non-writing smoke check in the live original preview.

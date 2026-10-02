# Dynamic food search implementation

Approved design: the conversation's combination 1 + 2 + 4, explained in docs/research/2026-10-01-dynamic-food-search.md. This plan implements that approved approach in the existing food catalog and product-import flow.

## Global constraints

- Search while typing runs locally and offline. No requests on typing or implicit product discovery.
- Preserve original food objects, IDs, brand/import metadata, nutrition, gram-based servings, pagination, and ingredient exclusion of meals.
- Every query term must match. Exact/direct matches precede fuzzy matches; actual branded products precede generic fallback suggestions. Short queries, numeric tokens, and nutrition qualifiers must not be fuzzily guessed or discarded.
- Generate formatting keys from source text. Do not enumerate brand-specific spelling mistakes. Keep the small, clearly labeled semantic generic fallback until missing brands have replacement data; do not invent product nutrition.
- The Search and Scan controls use a 75/25 row. Barcode import remains explicit, cancellable, cached, quota-aware, editable before save, and persisted only after save.
- Work only in the isolated dynamic-search checkout. Preserve the original checkout's uncommitted work and running Cloudflare server. No push, publish, or original-branch commit.
- Follow TypeScript discipline, focused meaningful regression tests, and independent review of each task. Implementers do not spawn agents.

## Task 1: Dynamic local food matching

Own catalog.ts, drink-aliases.ts, new search helper modules, package.json/package-lock.json, and related unit tests only.

Use MiniSearch (stable 7.2.0; install with npx expo install minisearch@7.2.0) to supply a local candidate index with bounded token fuzziness. Preserve public createFoodCatalog/getById/search and returned item identity; adding match classification only if necessary. Keep matching policy in a focused helper rather than turning catalog.ts into a large opaque pipeline.

Generate Unicode-normalized, apostrophe-folded, and compact keys from names, brands, and canonical generic aliases. Use bounded contiguous spans for brands embedded in long USDA names. Retain ordinary tokens, plurals, arbitrary word order and prefix behavior. Avoid unconstrained substring matching or sorted whole-name concatenation. Support Red Bull/redbull/red-bull; McDonald's/McDonalds; and Dr Pepper/drpepper/drpeper when real or canonical fallback text exists. Reject drpeper banana and Pepsi mango without matching metadata for the extra term.

Use AND terms, no fuzzy short/numeric/qualifier terms, and at most one Levenshtein edit for eligible terms initially. Exact/prefix/formatting results rank above fuzzy results; stable tie-breaks and pagination must not skip/repeat. Preserve diet/zero/sugar-free and preparation distinctions; do not match protected terms to unrelated words (e.g. diet to pie). Permit incomplete final-term prefixes, while guarding completed variant words.

Reduce drink-aliases.ts to canonical semantic relationships, removing manually enumerated joined/spaced/typo spellings now handled generically. Generic fallback remains explicitly labeled and ranks below actual matching records, including fuzzy branded matches. No semantic variant equivalence for saved products without source evidence.

Write failing tests before implementation for general formatting, bounded typos, all-term constraints, exact/custom/brand priority, variant constraints, no interior substrings, pagination, and catalog reconstruction after saved-record add/edit/delete. Run focused tests and typecheck. Measure cold index build and query latency with the real bundled dataset and record results/limitations. Commit only task files and write task-1-report.md in the plan workspace.

## Task 2: Saved-product integration

Own food.tsx, search-results.tsx, product-import.tsx, browser tests, and user-facing documentation only. Do not modify provider endpoints or task 1 code.

Keep source-backed barcode Scan lookup and local search. Use accessible buttons and honor loading/saving/foreground guards. Keep generic results labeled. Do not grant camera permission or perform remote requests on text changes.

Explain that saved imported products join offline food search. Preserve cancel/back behavior and editable draft, attribution, variant data, persistence, marker-only-for-barcode rule, and volume-based unknown nutrition handling.

Add focused browser coverage for typo/formatting lookup of saved branded records, ingredient search, offline operation, no network while typing, barcode import save followed by local search/reload, and cancellation where applicable. Mock external API at the browser boundary; do not rely on live OFF. Reuse fixtures and assert actual product identities/nutrition, not implementation details.

Update README/CONTEXT/PRODUCT as appropriate, describing capabilities and limits. Commit task files only and write task-2-report.md in the plan workspace.

## Task 3: Integration verification

Controller runs npm run check, relevant browser suite, exports for web/iOS/Android, and examines typing/index performance. Independently review final changes including task boundaries and precision risks. Bring only reviewed changes since the current-app snapshot into the original checkout with a guarded patch, install dependency, and verify the original checkout. Keep Cloudflare available for iPhone preview, verifying its manifest after integration. Document test evidence and remaining device/performance limits. Do not claim physical iPhone testing without evidence.

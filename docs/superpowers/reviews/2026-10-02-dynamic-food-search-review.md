# Dynamic food search review

The approved approach combines generated spelling keys, bounded local MiniSearch matching, and source-backed products saved through Scan. Search while typing stays offline; barcode lookup is explicit, editable, and cancellable. No provider endpoints, food nutrition, serving units, or saved-record schemas changed.

Each implementation received an independent spec and quality review. The local matcher review found joined qualifiers bypassing prefix and fuzzy constraints and a runtime module cycle. Scoped fixes and re-reviews resolved all three. The final whole-change review found omitted preparation/nutrition terms, which were added to the shared finite constraint vocabulary with separated/joined regressions. Final scoped re-review approved both spec and quality, with no outstanding findings.

Reviewed implementation commits in the isolated checkout: 0462134, 5793579, d2b1062, 5dc3727, f15eb97. Current-app snapshot baseline: 30f3d28. Original user changes are preserved; integration uses only the delta after that snapshot.

Verification evidence:

- Final TypeScript check and all 289 unit tests passed.
- All 45 browser regressions passed across the food/drink and onboarding/water suites.
- Final web, iOS, and Android Expo exports passed.
- Android Expo Go/Hermes loaded the application, found two actual Red Bull records for `redbull` through offline search. No product request or sample food save was triggered during that smoke check; no new ReactNativeJS warnings/errors were observed.
- Final original-checkout TypeScript check, all 289 unit tests, and all 11 food/drink browser checks passed. Its 17 integrated files matched the reviewed checkout byte for byte. The public Cloudflare iOS manifest verified runtime SDK 57 and a device-reachable HTTPS bundle address.

Formatting and typo variants are generated from indexed names/brands. Canonical, labeled semantic generic drink fallbacks remain for missing brand data; generic USDA nutrition is never renamed as branded nutrition. Typo matching is deliberately bounded to one edit in eligible ordinary components of at least five characters. Exact matches precede fuzzy matches, every query term must match, and actual products precede generic suggestions.

The domain vocabulary is finite, so this does not promise universal semantic interpretation of every product label. Completed preparation words narrow matches: `roas` can match roast or roasted, while completed `roast` requires that source word. Treating complete preparation synonyms as equivalent would be a separate semantic policy. Physical iPhone behavior and device latency/memory have not been benchmarked; desktop timing does not establish mobile performance. Online provider behavior is covered through mocked browser boundaries and existing adapter tests, not a new live Open Food Facts availability guarantee.

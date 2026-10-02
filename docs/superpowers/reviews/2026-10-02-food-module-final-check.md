# Food module final check — October 2, 2026

Reviewed all 25 paths in the complete Food architecture change `bc68d09875879ffb62c3947564c7b9a862022797..f44f2dd`, applied to the original app checkout. All copies matched the reviewed helper implementation at review start. Surrounding callers, validation and persistence contracts were traced. The security pass also covered repository entry points, local storage, external product lookup, camera permissions, developer scripts, CI, configuration, dependency advisories and secret handling.

No additional functional regression was confirmed in the Food refactor. Draft identity and independent retention, durable-save retirement, preview/write agreement, snapshot authority, ingredient eligibility before pagination and stale-page recovery match the accepted specification.

## Fixes

- Removed the unused `nutritionForMl` import in `tests/beverage.test.ts`. Strict unused-code checking reproduced TS6133 before removal and passed afterward; test assertions were preserved.
- Corrected README's stale audit claim that there were no high-severity findings. It now records both advisory chains and compatible remediation constraints.
- Added the missing carbs row to README's description of the daily nutrient order; the UI already includes it.

No dependencies, application behavior, storage format or saved user data were changed in this review.

## Remaining security findings

1. **High: Expo tooling contains `node-forge` 1.4.0.** [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) affects RSA signature verification through 1.4.0 and lists no patched release. The registry also reports 1.4.0 as latest at review time. Expo CLI uses the verifier through `@expo/code-signing-certificates`, including certificate validation and generated manifest-signature verification. The app source does not import Forge and has no configured update-signing certificate. A working application exploit was not demonstrated; these facts do not establish tooling safety. **Next action:** adopt a compatible patched Expo toolchain when released, or separately validate an upstream-supported patch. The audit's proposed Expo 44 downgrade is incompatible with SDK 57.
2. **Moderate: Router contains `decode-uri-component` 0.2.2 through `query-string` 7.1.3.** [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) describes malformed-input CPU exhaustion, fixed in 0.5.0. Router 57.0.24 still requires query-string 7. The fixed decoder and current query-string 9 expose ESM interfaces; existing callers expect CommonJS function/named exports. The earlier isolated decoder override failed with `decodeComponent is not a function`; current package metadata and installed imports retain that incompatibility. Expo's inbound linking parser uses `URL.searchParams`, while its query-string call serializes outgoing parameters; no vulnerable decoder path from app input was confirmed. The dependency finding remains open. **Next action:** use a compatible Router update or a separately validated dependency patch. Avoid the audit's Router 5 downgrade.

`npm audit --json` exited 1 with seven affected package entries: four high and three moderate, representing these two advisory chains; no critical entries. Package entries are not seven independent vulnerabilities. Dependencies and lockfile were preserved.

The inspected app uses local data without implemented accounts or a hosted backend. Storage parsers validate records before writes; writes publish after durable success and exclude stale lifecycles. Barcode lookup validates GTINs and uses a fixed HTTPS provider with cancellation, timeout, cache and request limits. React renders product text without HTML execution. Camera configuration excludes microphone permissions. Developer commands use argument arrays; the USDA importer reads archive contents without filesystem extraction. CI has read-only repository permission and no privileged pull-request trigger. A redacted scan of 185 tracked/unignored text files found no matches for the tested private-key and common credential patterns. This is not a complete secret inventory or a security guarantee.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` after import cleanup | TypeScript and all 326 domain tests passed |
| `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | Passed after removing the unused import |
| `npx expo-doctor` | 21/21 checks passed |
| Existing browser suite against localhost:8081, serial fresh contexts | 73/73 passed, no skips |
| `npx expo export --platform all --clear --max-workers 2` to a temporary directory | iOS and Android Hermes bundles, web bundles and 11 static routes passed |
| `git diff --check` and `git diff --cached --check` | Passed |
| Untracked text whitespace scan | One pre-existing trailing space in unrelated `.impeccable/critique/2026-10-01T23-34-04Z__src-app-tabs-food-tsx.md:5`; preserved |
| Original working-tree preservation | Only README and the unused test import changed among the 218 initial paths; this review is the sole new file |
| Original Git state and live app | HEAD and index unchanged; original Expo PID 53001 kept running; shared browser storage checksum unchanged |

The browser suite covers responsive layouts, themes, accessible controls, draft/save/delete recovery, real gram versus ml flows, hydration and offline search. A read-only collaborative preview inspection confirmed the live daily log. Native camera capture, hardware keyboard behavior, gestures, safe areas, text scaling and screen-reader behavior were not re-tested on physical iOS/Android devices in this review. Production operations, live exploitation and credential rotation were not performed. Temporary evidence: `/tmp/kinevault-final-check-20261002-110959`.

# Final-check coverage
Scope: complete Food refactor bc68d09..f44f2dd plus current copies and repository-wide security.
- [x] CONTEXT.md
- [x] README.md
- [x] docs/superpowers/plans/2026-10-02-food-module-depth.md
- [x] docs/superpowers/specs/2026-10-02-food-module-depth-design.md
- [x] src/app/(tabs)/food.tsx
- [x] src/food/catalog-drafts.ts
- [x] src/food/catalog-selection.ts
- [x] src/food/create-form.tsx
- [x] src/food/create-item-form.tsx
- [x] src/food/create-meal-form.tsx
- [x] src/food/custom-item-actions.tsx
- [x] src/food/custom-provider.tsx
- [x] src/food/draft-provider.tsx
- [x] src/food/ingredient-search.tsx
- [x] src/food/logging-controls.tsx
- [x] src/food/logging-preparation.ts
- [x] src/food/nutrition-detail.tsx
- [x] src/food/product-import.tsx
- [x] src/food/search-results.tsx
- [x] tests/catalog-drafts.test.ts
- [x] tests/catalog-selection.test.ts
- [x] tests/drink-hydration.browser.mjs
- [x] tests/drinks.browser.mjs
- [x] tests/food-ux.browser.mjs
- [x] tests/logging-preparation.test.ts

- [x] Repository-wide security: entrypoints, local persistence, external lookup/camera, tools/CI/dependencies/secrets
- [x] Final checks and original index/unrelated-file preservation

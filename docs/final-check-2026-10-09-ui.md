# October 9, 2026 UI final check

## Scope and base

Reviewed the complete uncommitted feature against `HEAD` (`ad0a1b0`), including
new files and the deleted Food button alias. The scope covers shared buttons,
compact daily food entries, Workout creation/logging consistency, scrollbar
visibility, and Profile menu lifecycle. No staged changes were present; the
review preserves the index and existing feature work. No commit or deployment
was performed. The sibling Workout studio is a separate application and was not
part of this review.

## Findings fixed

- **Medium: unbounded barcode response parsing and caching.** The Open Food Facts
  client limited time, request count and cache count, but accepted a response of
  arbitrary size. An oversized synthetic provider response reproduced this.
  `src/food/product-provider.ts` now enforces a 1 MiB UTF-8 response limit before
  JSON parsing or caching. It rejects oversized declared lengths, stops and
  cancels oversized streams, and releases stalled streams on cancellation. A
  native adapter without streams checks the decoded text before parsing; native
  transport buffering itself remains outside this limit.
- **Low: unused shared screen interface.** Removed `Screen.scrollStyle` after
  confirming that the scrollbar cleanup left no callers. The shared screen keeps
  one content-padding and scrolling policy.
- **Medium: development server retained rendered bundles.** The browser run
  exposed the recurring 8 GiB Node heap exhaustion. Allocation sampling and
  interval instrumentation traced retained bundles to Sentry's import-time
  cleanup timers. The reporting adapter now loads the SDK synchronously only
  when reporting is configured in a browser/native app; server rendering and
  disabled reporting leave it unloaded. Its privacy policy and error recovery
  behavior are preserved. After forced garbage collection, eight page requests
  added about 160 KiB of retained heap, compared with about 670 MiB beforehand.
- **Medium: account refresh lifecycle during server rendering.** Rendering
  constructed the app's Supabase client with automatic refresh enabled. The
  client now returns no app account service in server-rendered web requests,
  preventing request-created refresh timers. Browser and native session behavior
  remain covered by runtime and real-screen tests.
- **Low: eager food search indexing.** The allocation profile also exposed a
  full search index being built during module import, even for food-by-ID lookup.
  Search now builds it once on the first eligible query. Empty/short queries and
  catalog construction skip indexing; a captured array retains the catalog's
  original membership. The first eligible query pays the indexing cost once.
- **Low: clean-checkout CSS import types.** Integration CI found that the global
  CSS import depended on ignored, generated Expo declarations. A type check
  restricted to tracked files reproduced the missing declaration. The versioned
  TypeScript configuration now includes `expo/types`, using Expo's CSS
  declarations without requiring a development server to generate local files.

The final browser rerun exposed a transient food-row geometry assertion during
viewport resizing; an isolated rerun passed. The test now reads all compared
rectangles in one layout frame, avoiding scroll/resize movement between separate
measurements while retaining its alignment, order and target-size assertions.

Four new size-limit regressions failed before the provider change and passed
after it. A fifth regression verifies cancellation during a stalled body read
and a successful uncached retry. Ordinary Unicode labels remain supported.
Additional regressions cover server/browser/native account construction,
unloaded server/disabled telemetry, one-time configured reporting with privacy
scrubbing and failure isolation, deferred indexing and catalog membership.

The reviewed controls preserve domain-owned save/delete validation and lifecycle.
The compact food row retains safe confirmation, readable long names, and visible
edit/remove actions. Workout forms share the workspace and action layout.
Profile disclosures stop handling Back when their tab loses focus. No additional
confirmed behavior defect was found in these paths.

## Change coverage checklist

All 67 feature paths below were reviewed, including each changed hunk and every
new file. This review record is the additional documentation file. Callers,
ownership boundaries and test intent were checked as appropriate to each change.

| Directory | Reviewed files |
| --- | --- |
| Configuration | `tsconfig.json` |
| `docs` | `architecture.md`, `button-layout-review-2026-10-09.md` |
| `src/account` | `client.ts`, `settings-panel.tsx` |
| `src/app/(tabs)` | `exercise.tsx`, `food.tsx` |
| `src/app` | `_layout.tsx`, `onboarding.tsx` |
| `src/app/auth` | `callback.tsx`, `reset-password.tsx` |
| `src/components` | `button.tsx`, `crash-reporting.ts`, `delete-button.tsx`, `error-boundary.tsx`, `profile-menu.tsx`, `ui.tsx` |
| `src/daily` | `food-log-entry.tsx`, `meals-widget.tsx`, `search-actions.tsx` |
| `src/exercise` | `controls.tsx`, `library-forms.tsx`, `search-results.tsx`, `session-editor.tsx`, `workout-library.tsx`, `workout-workspace.tsx` |
| `src/food` | `barcode-scanner.tsx`, `create-form.tsx`, `create-item-form.tsx`, `create-meal-form.tsx`, `custom-item-actions.tsx`, `custom-status.tsx`, `daily-macros.tsx`, `detailed-nutrient-fields.tsx`, deleted `food-button.tsx`, `ingredient-search.tsx`, `log-status.tsx`, `logging-controls.tsx`, `nutrition-detail.tsx`, `product-import.tsx`, `product-provider.ts`, `search-matching.ts`, `search-results.tsx` |
| `src/onboarding` | `account-screen.tsx`, `controls.tsx` |
| `src/profile` | `journal-ui.tsx`, `photo-editor.tsx`, `profile-controls.tsx`, `profile-editor.tsx`, `profile-goals.tsx`, `profile-identity.tsx`, `profile-name.tsx`, `profile-screen.tsx`, `progress-photos.tsx`, `recovery.tsx`, `water-goal-editor.tsx`, `weight-journal.tsx` |
| `src/theme` | `global.css` |
| `src/water` | `entry-modal.tsx`, `goal-settings.tsx` |
| `scripts` | `account-client.test.mjs`, `crash-reporting-runtime.test.mjs` |
| `tests` | `exercise.browser.mjs`, `food-catalog.test.ts`, `food-ux.browser.mjs`, `product-provider.test.ts`, `profile.browser.mjs` |

## Repository security pass

Reviewed Account authentication and link handling, owner-scoped session and
tracking storage, cloud/RPC account checks, SQL grants and RLS, privileged account
deletion, input/request validation, media file ownership and URI handling,
telemetry sanitization, configuration scripts, and CI/dependency tooling.

Security tests exercise account replacement, forged/malformed deletion requests,
grants and RLS, anonymous access, foreign-owner changes, and invalid-batch rollback.
The maintained migrations use authenticated owner checks, explicit grants and
invoker RPCs. Service credentials stay in the server adapter. Media identifiers
are validated and stored in owned namespaces. The crash policy returns an
allowlisted event rather than raw user data.

A redacted pattern scan covered 411 tracked/nonignored text files and found no
matching private keys, provider secrets or service-role JWTs. Indexed source had
no `eval` or raw HTML injection call; the one `new Function` occurrence belongs
to a browser test predicate. This is a bounded source review and pattern scan,
not proof that every vulnerability or secret is absent. Binary/large files and
ignored local credentials were excluded from the secret scan.

Current official Supabase RLS/session guidance and the changelog were checked.
Hosted policy state, deployed Edge Functions, project settings and server patch
levels were not inspected or changed. The previously recorded hosted Auth and
history rollout gates remain in [security remediation](security-remediation.md)
and [history storage](account-history-storage.md); this check does not clear them.

## Unresolved dependency findings

`npm audit --json` reports **19 high alerts**, cascading from two advisories in
Expo tooling:

- `braces` 3.0.3: deeply nested patterns can exhaust the stack.
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- `node-forge` 1.4.0: an RSA PKCS#1 v1.5 signature verification flaw.
  [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

The advisories list no patched versions, and registry checks confirmed that the
installed versions remain the latest published releases on the review date.
Neither dependency is imported by app code; both enter through Expo/Metro/CLI
tooling. An app-runtime exploit was not demonstrated. Audit-proposed old Expo
versions would require an incompatible downgrade, so no speculative dependency
or cryptography patch was applied. These findings remain unresolved.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed: lint, formatting, TypeScript and all 891 unit/script tests |
| Clean-checkout TypeScript check excluding generated Expo files | Passed after explicitly including Expo's ambient types |
| Full browser suite against the final web export and development fixtures | 169 passed, 0 failed; 1 optional screenshot case skipped |
| Expo Doctor | All 21 checks passed |
| Deno 2.9.6 account deletion function check | Passed with `--node-modules-dir=none --no-lock` |
| Web, iOS and Android exports | All succeeded after the final app source changes |
| Shared preview | Onboarding loads; development server remains running on port 8083 |
| Retained-heap reproduction | Eight page requests after forced garbage collection stayed nearly flat following the telemetry fix |
| Source graph, diff and new-file whitespace | Passed; staged index remains empty |
| Dependency audit | 19 high alerts remain as documented above |

Browser tests use isolated synthetic account/data fixtures. Hardware Back is
tested through an injected event adapter. Native exports verify bundling; no
physical device was connected, so installed-device camera, file/permission and
native UI behavior were not verified. Hosted Supabase configuration, deployed
policies/functions and real email delivery were not verified in this check.
The memory comparison is a bounded repeated-request reproduction, rather than a
long-duration stress test.

Detailed command logs, failure reproductions, coverage inventory and memory
measurements are retained in the ignored `.local-artifacts/final-check-2026-10-09/`
directory. Only final successful broad runs are counted in the table above.

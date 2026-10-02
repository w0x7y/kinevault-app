# Import, Daily activity, and durable-write deepening

Spec: `docs/superpowers/specs/2026-10-02-import-daily-persistence-depth.md`.
All tasks preserve current behavior, independent storage, and accepted deep modules.
Implement sequentially with an independent review after every task.

## Task 1: Shared durable-write lifecycle

Read the spec first. Own `src/water/persistence.ts`, `src/water/goal-persistence.ts`,
`src/food/log-persistence.ts`, `src/food/custom-persistence.ts`, a new internal
module under `src/persistence/`, and their model tests. Keep all exposed domain
interfaces, document formats, validation, messages, and result meanings stable.

Concentrate common lifecycle ownership in a typed internal module: inert creation,
stable snapshot/subscription, start/stop/retry, generations, write exclusion,
canonical validation before write, durable-success publication, failure retention,
and post-restart reload after an uncancelable write. No new external seam. Use
existing storage adapters. Domain operations retain their own mutation/validation
and explicit result semantics, including null/missing targets and custom validation
messages. Avoid a universal actions framework and type erasure.

Test the module's interface with controlled storage for stale reads (success and
error), duplicate/pending writes, read during write, failed writes, validation,
inert construction, stop/restart, delayed success/failure across lifecycles, and
listener unsubscribe/reentrant lifecycle changes if relevant. Keep domain tests
covering canonical records, manual replacement/zero, goal default/custom/invalid,
food editing/removal and custom foods/meals; remove equivalent duplicated race
tests only after shared coverage proves their invariant. Run focused model suites
and TypeScript. Parent handles final browser/export checks.

No edits to Product import, Daily activity, rendering, docs, or browser tests.
No subagents. Commit your scoped implementation in the isolated worktree and
write the full report to the supplied task report path, including files, chosen
interface/invariants, evidence, concerns, and commit IDs.

## Task 2: Product import workflow

Read the spec first. Own `src/food/product-import.tsx`, new
`src/food/product-import-flow.ts`, `tests/product-import-flow.test.ts`, and
`tests/food-expansion.browser.mjs` only if needed for real wiring regression.
Inspect FoodDay focus/date/scanner wiring; edit that caller only if necessary
and document why. Preserve the existing Product lookup and Catalog draft modules.

Choose a small workflow interface with snapshots/subscription and user/lifecycle
intentions. The module owns request state, identity, abort, interruption, retry,
manual entry, provenance, and adoption through the real draft owner's existing
open operation. Rendering supplies lifecycle facts, camera signals, and presentation;
no request-generation refs or manual/reviewed draft assembly remain in rendering.
Inject the existing lookup adapter plus deferred test adapter. Camera permission,
foreground camera lifetime, and detection locking remain in barcode-scanner.tsx.
Construction is inert. Old responses after cancel/stop/restart/day change/new Scan
cannot reopen review. Reviewed draft edits survive; manual unknown product keeps
manual provenance. Handle StrictMode lifecycle and non-aborting lookup adapters.

Use direct workflow tests with the real Catalog draft owner for overlapping lookup,
cancel before resolve/reject, day/activity changes, retry, missing/manual entry,
review adoption, retained edits, and restart. Keep browser journeys for visible
review/save and camera/wiring behavior; avoid duplicating Product lookup policies.
Run TypeScript, workflow/provider/draft tests, and food-expansion browser tests
against the isolated preview supplied by parent.

No persistence or Daily activity edits. No subagents. Commit scoped changes and
write full task report with interfaces, invariants, tests, concerns, and commit IDs.

## Task 3: Coherent Daily activity availability

Read the spec first. Own a new `src/daily/activity.ts`, `src/daily/use-day.ts`,
`src/daily/activity-widgets.tsx`, `src/app/(tabs)/index.tsx`, `src/water/goal-cup.tsx`,
`tests/daily-activity.test.ts`, and necessary Food/Exercise/DailyMacros callers.
Own water-goal/drink-hydration browser tests only if stronger wiring coverage is
needed. Preserve current persistence interfaces and the existing goal algorithm.

Choose a small in-process interpretation interface taking Selected day and source
snapshots. Return coherent availability with usable values: known empty/zero is
different from unreadable/loading. Combine manual water and explicit Drinks only
when both are known; food availability remains independent of water/goal. Derive
progress once through waterGoalProgress. Home no longer independently reads raw
food/water/goal readiness to reconstruct an interpreted result; widget and cup
consume coherent interpreted water/progress. Labels, units, retry wording, focus,
and layout remain rendering decisions. Preserve separate manual editing, default
goal and saved feedback, Selected day lifecycle, food log visibility and Exercise.

Use direct tests for cross-source readiness combinations, unknown versus zero,
Selected day isolation, manual/Drink totals, legacy missing volume, progress cap,
and recovery. Keep useful existing nutrition/workout tests. Run TypeScript, daily
and goal model suites, water-goal/drink-hydration browser tests, plus existing
responsive/calendar regressions against isolated preview. No storage writes in
live user preview. No persistence/Product import/docs edits. No subagents.
Commit scoped changes and write full report with interfaces, invariants, tests,
concerns, and commit IDs.

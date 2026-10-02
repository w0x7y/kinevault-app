# Product import, Daily activity, and durable-write depth

The user requested implementation and fixes for all three candidates in
`/tmp/architecture-review-20261002-133811-679832.html`. That report and its
independent review establish the scope. This is a behavior-preserving refactor.

## Global constraints

- Preserve the existing Home water editor, required default 1,500 ml goal,
  successful-save confirmation, compact 48 by 60 cup, and coming-soon menu.
- Keep storage keys, version-1 formats, validators, domain results, failure copy,
  drink classification and nutrition rules unchanged. No accounts or sync.
- Use existing deep Product lookup, Catalog draft, Logging attempt, Food catalog
  selection, completed-workout, and `waterGoalProgress` implementations.
- Camera permissions, foreground camera lifetime, detection locking, rendering,
  accessible labels, focus, formatting, and visual layout stay with rendering.
- Do not touch real saved user data or stop the original Expo server.
- Work in the isolated worktree. Commit only there; integrate reviewed deltas
  back into the original dirty checkout after checking file hashes. No push,
  merge, PR, deployment, or commits in the original checkout.
- Every implementation and fix receives independent review; a final combined
  review checks the whole architecture delta against the captured dirty baseline.

## Shared durable-write lifecycle

Create one internal module for inert construction, stable snapshots/subscription,
start/stop/retry, stale-read exclusion, one write at a time, canonical validation
before writing, publication only after durable success, preservation on failure,
and restart recovery after uncancelable writes. Migrate only manual water, water
goal, Logged food, and Custom food/meal persistence to it. Keep their public
interfaces stable, including boolean versus saved-item results, silent missing
log targets versus catalog validation feedback, independent keys, and invalid
value behavior. Profile reset and Appearance are excluded.

The existing AsyncStorage and controlled storage adapters justify the internal
storage seam. Avoid a general command framework, new external seam, or casts
that erase domain validation. Centralize lifecycle race permutations in tests
through the internal module's interface; retain domain behavior tests. Remove
redundant lifecycle-only tests after equivalent shared coverage exists.

## Product import request ownership

Create a pure controllable Product import workflow module. It owns scanner,
loading, missing, retryable error, and reviewed-draft states; request identity,
abort, interruption by Selected day/activity changes, retry, manual entry,
reviewed/manual provenance, and adoption into the real Catalog draft owner.
Rendering supplies lifecycle facts and uses a stable subscription; it no longer
contains request-generation or stale-response logic or assembles import drafts.

Inject Product lookup: use the existing Product lookup adapter in production
and deferred lookup fixtures in direct tests. Preserve lookup caching, timeout,
budget, validation, and nutrition classification in the existing lookup module.
Construction must not start work. Stop/unmount and replacement requests cannot
adopt a stale draft. Reviewed editable drafts survive interruptions as today;
canceling import does not discard an existing reviewed Catalog draft. Reopening
Scan begins a new journey. Camera lifetime remains separate.

Test actual workflow outcomes through the same interface used by rendering,
including late responses, overlapping lookups, retry, day/activity interruption,
manual entry, retained edits, and stop/restart. Keep browser coverage for lifecycle
wiring, camera permissions, visible review/save, and hydration.

## Daily activity availability

Create one in-process interpretation module for Selected day, source readiness,
combined manual water plus explicit Drinks, usable food/nutrition totals, and
goal progress. Unknown data must remain distinguishable from known zero and
partial hydration must never become a usable total. Reuse `waterGoalProgress`;
no second progress algorithm. Preserve legacy missing drink volume behavior.

The React hook supplies source snapshots and selection to this module. Home
and Water rendering consume a coherent interpreted value rather than separately
subscribing to raw states and reconstructing their ordering obligations. Food
remains usable with ready food records even when water/goal is unavailable;
Exercise keeps its current completed-workout behavior. Avoid forcing unrelated
callers to wait on a global all-or-nothing status. Make the cup consume interpreted
progress instead of recalculating it from independently supplied numbers.

Use direct fixtures for readiness combinations, selected-date isolation,
zero/unknown, manual plus Drinks, legacy records, below/at/above goal, and recovery.
Retain browser checks for unavailable accessible progress, default goal, compact
layout, selected-day edits, and separate Drink totals.

## Verification

Baseline and final TypeScript/full model tests; focused checks per task; all
browser suites against an isolated Expo preview; web, Android, and iOS bundle
exports; whitespace checks; and a read-only check in the shared live preview
after integration. Update the domain glossary only for clarified domain terms,
and record the final interfaces and test evidence in the architecture review.

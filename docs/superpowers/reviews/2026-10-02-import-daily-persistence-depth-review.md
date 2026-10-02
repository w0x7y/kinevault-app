# Product import, Daily activity, and durable-write review

Scope: the three opportunities in the October 2 architecture report, implemented
against a snapshot of the existing Home water/profile changes. The original
checkout was preserved during implementation; only reviewed deltas are integrated.

## Interfaces and ownership

`createDurableWrite({ storage, key, parse })` owns read generations, write
exclusion, stable snapshots, durable publication, and restart recovery. Its typed
`update(build, failureMessage)` keeps mutation, validation messages, and successful
result values with the water, water-goal, food-log, and custom-catalog modules.
Storage keys, version-1 documents, public domain operations, and failure copy
remain unchanged. Profile and Appearance persistence are outside this refactor.

`createProductImportFlow({ lookup, drafts })` owns one Scan journey through scanner,
loading, missing, error, and review states. Its intentions cover lookup, retry,
manual entry, Scan restart, cancellation, and committed activity/date context.
The existing lookup adapter owns provider policies; the real Catalog draft owner
owns editable inputs and provenance. React supplies lifecycle facts and subscribes
to the workflow. Camera permission, foreground lifetime, and detection locking
remain with the scanner.

`interpretDayActivity({ selectedDay, food, water, goal })` returns independently
usable food and water interpretations. The water total is usable only when both
manual and Drink records are known. A goal can be unavailable while the total
remains usable. The existing `waterGoalProgress` calculation runs here once; the
widget and cup consume that result. The hook supplies snapshots, Home consumes
the interpretation, and food-only views use narrowed day records without invented
water values. Labels, formatting, focus, and layout remain in rendering.

## Independent task reviews

The durable-write implementation passed review after restoring a direct stale-load
regression that had become less specific during consolidation. Six permutations
now cover older successful, invalid, and rejected reads after a newer successful
read, both while active and after stopping, without an intervening write.
The scoped test fix passed independent re-review.

Product import review found a synchronous abort callback could cancel, stop, or
change context while an outer replacement lookup was being started. The fix
allocates an intention identity before aborting and checks it before continuing.
The same rule protects Scan restart and later publication/adoption. Ten direct
regressions failed before the fix and passed afterward. Independent re-review
confirmed both the replacement and Scan restart windows were closed.

Daily activity passed independent spec and quality review without findings.
Direct tests cover all 27 readiness combinations, date isolation, known zero,
legacy volume, capped progress, source nonmutation, and recovery. A browser
regression confirms Food and daily macros remain usable while water and goal
sources are loading or unreadable. Existing manual-water, responsive, calendar,
corrupt-food, and completed-workout journeys passed as well.

## Combined verification

- `npm run check`: TypeScript and all 431 model tests passed on the final
  implementation.
- `KINE_PREVIEW_URL=http://localhost:8086 node --test --test-concurrency=2
  tests/*.browser.mjs`: all 88 browser tests passed, with no failures or skips.
  These used isolated test contexts and fixture storage.
- `npx expo export --platform all --max-workers 2`: passed for web (11 static
  routes), Android, and iOS. Metro emitted an environment color-variable warning
  because the harness supplies both `NO_COLOR` and `FORCE_COLOR`; no app build
  error occurred.
- `git diff --check`: passed.

## Final review and integration

The final independent review of `3d4187d..58898e4` passed with no Critical,
Important, or Minor findings. Each implementation and both scoped fixes received
independent review; no findings were parked or deferred.

Before integration, every changed original file matched its captured baseline
hash. All 31 reviewed paths were copied and verified against the isolated
worktree. The original checkout then passed a fresh `npm run check` (TypeScript
and all 431 model tests) and `git diff --check`. This review record was added
after those checks. Existing uncommitted Home water/profile work was preserved.

A read-only check of the original live Home preview found the expected 1,500 ml
goal, accessible water label, and 48 by 60 cup, with no visible runtime error.
Saved browser storage had the same hash before and after integration. Camera
capture and native interactions still require device verification; the platform
exports validate bundling.


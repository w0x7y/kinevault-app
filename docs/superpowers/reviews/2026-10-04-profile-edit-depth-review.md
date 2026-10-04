# Profile edit depth verification

Both candidates from the architecture review are implemented. The media owner
coordinates avatar edits and the gallery's photo edit through selection, form
changes, validation, Save/removal and retirement. The focused Profile owner
coordinates independent inline-name and section drafts, latest-answer merge,
validation, retry and successful completion. UI modules render the snapshots and
send commands instead of repeating those lifetime protocols.

## Correctness review

The implementation was reviewed independently and through the caller interfaces.
Review reproduced and corrected an observer race that could let an unrelated
media mutation reserve the durable write before the intended Save. Invalid
Profile validation could recursively submit through an observer; submission is
now excluded during notifications. Retained media sources are detached from
mutable picker results. Regression tests cover these cases.

Tests also cover late picker completion, replacement attempts, duplicate and
competing operations, failed writes retaining draft fields, disposal during a
real import, and stop/start rehearsal. Source retirement waits for operations
using the source and preserves committed media. Existing browser coverage checks
that pending completion cannot close a replacement form or discard an inline
name draft, while section navigation remains available.

Inline-name failure copy and single photo error presentation were preserved
during migration. Existing storage formats, durable transaction ordering,
onboarding, Water goal and Workout edit ownership are retained.

## Verification

- `npm run check`: TypeScript passed; all 598 direct tests passed, including 33
  new tests through the editing interfaces.
- `node --test --test-concurrency=2 tests/profile.browser.mjs
  tests/profile-menu.browser.mjs tests/profile-media.browser.mjs
  tests/onboarding.browser.mjs`: 57 passed, zero failures, one existing optional
  screenshot capture skipped.
- `npx expo export --platform all --output-dir /tmp/kine-profile-depth-export`:
  web, iOS and Android exports passed.
- `git diff --check`: passed. Graft was rebuilt for the migrated modules.

An earlier browser run overlapped a provider source refresh and reported a
transient missing-provider error. The isolated test and then the full stable
browser group passed without further application changes.

The collaborative browser loaded the updated Profile with the existing saved
data and no horizontal overflow. Platform exports verify native compilation;
native camera interaction was not rerun for this architecture-only change.

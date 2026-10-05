# Track module ownership

Domain terms live in [CONTEXT.md](../CONTEXT.md). This document records where
current behavior belongs; the older design specs describe earlier increments.

## Accounts and entry

The Account controller owns session restoration, request exclusion, recovery,
email-delivery feedback and email-link completion. Its interface returns stable
snapshots and account intentions. Supabase Auth is an injected adapter, so tests
exercise the same seam as the account screens.

Email verification feedback carries its purpose and normalized recipient. Screens
do not infer a successful signup from arbitrary notice text or a mutable input.
An identity change invalidates request feedback and recovery from the prior owner.
Only the active email-link result survives an owner replacement, allowing the
callback screen to resume after the account-owned subtree changes.

The entry policy permits sign-in and email-link routes independently of Profile
loading or failure. A signed-in Account with a damaged Profile sees Profile
recovery and can log out without deleting its saved data. Tracking still requires
an authenticated Account and a completed Profile.

## Account tracking storage

Account storage owns device namespaces, legacy onboarding import, durable pending
saves, cloud revisions, deletion records, conflicts and synchronization lifecycle.
Its interface exposes ordinary key-based reads and writes, synchronization
intentions, snapshots and key-specific external-change subscriptions. Device
storage and the Supabase document transport are adapters at this seam.

Synchronization reserves its current operation before publishing feedback. A
stopped lifecycle cannot start another adapter request or publish an abandoned
request's result. Restarting does not wait for an abandoned network read; device
mutations remain serialized because they cannot be canceled once started.

Cloud hydration notifies only the changed tracking key, after that value is
durable. A failed upload after successful hydration still notifies the changed
data. An unchanged sync emits no document refresh. Settings does not remount
tracking to reload it, so a Water goal update cannot erase an unrelated Workout
edit. Account replacement still remounts the owner scope for privacy.

## Durable domain documents

Profile, Exercise, Food log, Custom foods, Manual water and Water goal persistence
share the durable-write module's lifecycle. Their own modules retain validation,
mutations and domain-specific results. Callers do not coordinate storage ordering,
write exclusion, subscriber cancellation or stale read generations themselves.

Optional key-specific subscriptions refresh the relevant durable document through
the same interface. A notification during a write is deferred until the write
settles. Draft owners remain mounted and merge their chosen fields into the latest
saved document when the user saves. Tests cross the domain interface instead of
depending on private lifecycle state.

External refresh keeps the last ready document visible while validating its
replacement. A failed refresh carries a typed `refreshError` and retry action,
retains draft owners, and blocks stale writes until a valid replacement is read.
Normal save failures remain separate from failed refreshes.

Profile media keeps its own module: importing an image, committing its metadata
and cleaning up owned files is a distinct two-phase workflow. It shares Account
privacy but does not synchronize image files. Cancellation is checked before
starting adapter work, and committed metadata keeps its owned image after a
lifecycle change.

This ownership gives locality to lifecycle fixes and leverage to all document
callers without adding another public abstraction layer.

## Verification

The October 5, 2026 architecture follow-up passed TypeScript, all 705 unit tests,
and 158 browser tests. One optional screenshot export case was skipped. The two
authentication configuration script tests also passed. Web, iOS and Android
exports succeeded; native exports verify bundling, not installed-device behavior.

Regressions cover stopped and reentrant lifecycles, stale account and recovery
results, email confirmation after a screen remount, damaged Profile access and
reset, partial sync failure, external refresh retries, and retained Workout,
Profile and Water goal drafts. Browser tests use the real screens with injected
account transport fixtures. This follow-up did not change the remote schema.

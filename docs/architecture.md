# Track module ownership

Domain terms live in [CONTEXT.md](../CONTEXT.md). This document records where
current behavior belongs; the older design specs describe earlier increments.

## Accounts and entry

The Account controller owns session restoration, request exclusion, recovery,
email-delivery feedback and email-link completion. Its interface returns stable
snapshots and account intentions. Supabase Auth is an injected adapter, so tests
exercise the same seam as the account screens.

The app retains one controller per stable auth adapter across root-layout remounts. Mounted providers attach and detach its lifecycle; request generations still retire abandoned work. Deletion feedback survives a remount, while a replacement identity clears the previous account's feedback.

Server rendering does not create the app's Supabase client or its session refresh
timers. The browser and native runtimes retain their existing client and refresh
ownership.

Email verification feedback carries its purpose and normalized recipient. Screens
do not infer a successful signup from arbitrary notice text or a mutable input.
An identity change invalidates request feedback and recovery from the prior owner.
Only the active email-link result survives an owner replacement, allowing the
callback screen to resume after the account-owned subtree changes.

Account management attempts own Settings action exclusion, owner/caller lifetime, confirmation fields, export delivery and action feedback. The React adapter supplies current account/connectivity readings and platform delivery; rendering submits intentions. Rejected deletion feedback is scoped to its caller, while confirmed deletion and its notice remain with the auth owner. Account management owns logical export assembly and the authenticated deletion sequence. Settings renders those intentions; file download/sharing and server requests are adapters. Deletion freezes the owner's storage before server work, then commits a tombstone and scoped cleanup after confirmed success. Session storage performs owner-conditional clearing so a delayed deletion cannot remove a replacement account. See [account management](account-management.md).

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

Food and exercise history have physical monthly partitions behind that logical
document interface. Local copy-on-write manifests publish a whole replacement
only after its changed fragments are durable. The optional cloud transport
commits changed fragments and one logical revision atomically. Providers keep
their existing v1 documents and explicit conflict choices. Migration, rollout,
and remaining full-history assembly costs are described in
[history storage](account-history-storage.md).

Synchronization reserves its current operation before publishing feedback. A
stopped lifecycle cannot start another adapter request or publish an abandoned
request's result. Restarting does not wait for an abandoned network read; device
mutations remain serialized because they cannot be canceled once started.

Cloud hydration notifies only the changed tracking key, after that value is
durable. A failed upload after successful hydration still notifies the changed
data. An unchanged sync emits no document refresh. Settings does not remount
tracking to reload it, so a Water goal update cannot erase an unrelated Workout
edit. Account replacement still remounts the owner scope for privacy.

Connectivity owns reachability observations, while each account scope owns its
reconnect retry subscription. It removes that subscription before stopping
storage. Root crash recovery sits outside the providers and can remount them
without clearing persisted records. Optional JavaScript reporting sanitizes
errors independently of the recovery UI; see [resilience](resilience.md).

The telemetry SDK loads only when reporting is enabled in an app runtime.
Server rendering and disabled reporting do not import it: its import-time timers
otherwise retain rendered bundles even without SDK initialization. Crash recovery
remains independent of telemetry startup or capture failures.

## Editing and summaries

The Onboarding flow owns validation, staged answers, navigation and save ordering.
Route focus starts and stops its lifecycle. A started durable save can finish after
blur, but its result cannot advance the abandoned flow or navigate. Restarting
keeps staged answers and excludes another save until the pending write settles.

Catalog drafts own save validation, attempt feedback, write exclusion and retirement
through the existing Custom food persistence interface. Food and meal forms submit
intentions and render the session snapshot. Retained drafts keep their own failure
message across unrelated storage operations. A completed save cannot discard fields
changed while it was pending, close a replacement editor or deliver its result to
that editor. Save completion is delivered before retirement notifications can
detach the submitting form. Successful deletion retires only the deleted item's
retained edit; callers cannot bypass durability to retire an edit themselves.

Completed Workout totals derive from persisted Workout sessions and their valid
sets. Daily activity and test fixtures use the same Exercise summary interface;
there is no separate workout interpreter or fixture-only measurement model.

Barcode lookup owns provider validation, cancellation, request budgets and its
bounded cache. Responses are limited to 1 MiB of UTF-8 data before JSON parsing
or caching. Web streams stop reading and cancel when oversized or abandoned.
Native fetch buffers internally; its fallback checks decoded response size
before parsing, so the limit does not bound native transport buffering.

Food catalogs retain their original membership and build the search index once,
on the first eligible query. Construction, food-by-ID lookup and empty queries
do not tokenize the catalog or build an index during server rendering.

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

Body-weight entries are optional history within the existing Profile document. The weight model owns dated entry validation and trend coordinates; the body-weight edit module owns raw drafts, validation, replacement guidance and save/delete feedback. The journal renders that snapshot, and Profile persistence owns durable mutations. Leaving the journal retires its edit; an older completion cannot change a replacement edit. Logging a measurement preserves goal answers and does not recalculate calorie or macro targets.

Profile media keeps its own module: importing an image, committing its metadata
and cleaning up owned files is a distinct two-phase workflow. The media ownership module interprets metadata and ownership ledgers once for reservation, retirement and confirmed Account cleanup. Account storage supplies immutable namespaces, its local transaction gate and freeze/drain coordination; persistence uses the required ownership interface instead of a separate fallback policy. It shares Account
privacy but does not synchronize image files. Cancellation is checked before
starting adapter work, and committed metadata keeps its owned image after a
lifecycle change.

The Profile media edit owns picker state, shared persistence readiness and busy
state, and feedback for its current save attempt. Avatar and Progress photo
callers render that snapshot. Canceling or replacing an edit does not carry an
earlier durable failure into the new editor.

This ownership gives locality to lifecycle fixes and leverage to all document
callers without adding another public abstraction layer.

## Shared controls

The shared button module owns action sizing, focus and press feedback, disabled
state and selection/disclosure semantics. Food, Exercise, Profile and Water import
its interface directly. Domain-named pass-through aliases and duplicate icon
controls are removed, so control fixes have one place to live. Plain and secondary
icon appearances retain the existing treatments through the same interface.

The Profile chart disclosure module owns its focused lifetime. Blur closes the
menu and removes its Back, Escape and outside-interaction listeners, even when
the tab remains mounted. Escape and selection restore trigger focus on web;
native menus retain their modal dismissal. These behaviors stay together with
the disclosure rendering instead of creating another general menu abstraction.

## Verification

The [October 9 final-check record](final-check-2026-10-09-ui.md) covers the complete
UI diff and repository security review, including the barcode response limit,
its regressions, current dependency advisories and final verification.

The October 9, 2026 control follow-up passed lint, formatting, TypeScript, all
874 unit/script tests and 169 browser tests, with one optional screenshot case
skipped. Web, iOS and Android exports succeeded. Regressions cover chart-menu
blur, Back/Escape dismissal, outside focus/pointer dismissal, keyboard activation
and disclosure state through the real Profile and Workout screens. Native
exports verify bundling; the Back regression uses the browser's injected event
adapter rather than an installed device.

The October 8, 2026 implementation concentrates Profile media ownership,
Account management attempts and body-weight editing. See the
[final-check record](final-check-2026-10-08-architecture.md) for review coverage,
regression fixes and remaining release gates, and [TODO.md](../TODO.md) for the
latest integrated results.

The October 5, 2026 architecture follow-up passed TypeScript, all 739 automated
unit and script tests, and 159 browser tests. One optional screenshot export case
was skipped. Expo Doctor passed all 21 checks. Web, iOS and Android exports
succeeded; native exports verify bundling, not installed-device behavior.

Regressions cover stopped and reentrant lifecycles, stale account and recovery
results, email confirmation after a screen remount, damaged Profile access and
reset, partial sync failure, external refresh retries, and retained Workout,
Profile and Water goal drafts. New regressions cover abandoned Onboarding saves,
media error isolation, Catalog validation and save ownership, and persisted
Workout summaries. Browser tests use the real screens with injected account
transport fixtures. This follow-up did not change the remote schema.

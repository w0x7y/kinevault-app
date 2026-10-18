# Track module ownership

Domain terms live in [CONTEXT.md](../CONTEXT.md). This document records where
current behavior belongs; the older design specs describe earlier increments.

## Accounts and entry

The Account controller owns session restoration, request exclusion, recovery,
email-delivery feedback and email-link completion. Its interface returns stable
snapshots and account intentions. Supabase Auth and the Google sign-in browser
(`openAuthSession`) are adapters injected when the controller is created, next to
`redirectTo`, so tests exercise the same seam as the account screens. One Google
browser runs at a time, and only a PKCE code it returns completes the sign-in. The account
context passes the controller's actions on unchanged, without its lifecycle methods.

The app retains one controller per stable auth adapter across root-layout remounts. Mounted providers attach and detach its lifecycle; request generations still retire abandoned work. Deletion feedback survives a remount, while a replacement identity clears the previous account's feedback.

Server rendering does not create the app's Supabase client or its session refresh
timers. The browser and native runtimes retain their existing client and refresh
ownership.

Signing up with an email that already has a confirmed account shows an error that
says to log in: Auth sends no email then and returns a stand-in user without
identities. This tells anyone whether an email has an account.
Email verification feedback carries its purpose and normalized recipient. Screens
do not infer a successful signup from arbitrary notice text or a mutable input.
A confirmation delivery also counts its resends. Each successful resend publishes a new
delivery, so its text survives a remount and changes with every send; Android and the
web read it from the panel's live region, and iOS gets an announcement. Resend stops
once three confirmation emails, sign-up included, went to an address in the past hour
on this device (signing up again isn't blocked); Supabase's email rate limits are the
server guard.
An identity change invalidates request feedback and recovery from the prior owner.
Only the active email-link result survives an owner replacement, allowing the
callback screen to resume after the account-owned subtree changes. On iOS the Google
browser session keeps its redirect and no callback screen runs, so the controller
drops a finished Google result itself (`oauthRedirectOpensCallback: false`); Android
also opens the callback route for that redirect and keeps the result for it.
`completeAuthLink` is the only entry point: a cleaned callback URL that matches the
retained link resumes its in-flight or settled result, while a URL that still carries
a code, token or error is processed as a new link. Only a PKCE code completes a link:
`parseAuthLink` reads token-hash and session-token links as invalid, because they
carry no proof that this device started the flow.

Account management attempts own Settings action exclusion, owner/caller lifetime, confirmation fields, export delivery and action feedback. The React adapter supplies current account/connectivity readings and platform delivery; rendering submits intentions. Rejected deletion feedback is scoped to its caller, while confirmed deletion and its notice remain with the auth owner. Account management owns logical export assembly and the authenticated deletion sequence. The `delete-account` Edge Function confirms the password or, for an account created with Google, a Google sign-in from the last 10 minutes, and allows five attempts per account an hour. Settings renders those intentions; file download/sharing and server requests are adapters. Deletion freezes the owner's storage before server work, then commits a tombstone and scoped cleanup after confirmed success. Session storage performs owner-conditional clearing so a delayed deletion cannot remove a replacement account. See [account management](account-management.md).

The entry policy permits sign-in and email-link routes independently of Profile
loading or failure. Once someone signs in on the sign-in screen, it waits for the
account's first download like the guarded routes, so it never acts on the new
account's empty Profile before setup answers from this device are imported. A signed-in Account with a damaged Profile sees Profile
recovery and can log out without deleting its saved data. Tracking still requires
an authenticated Account and a completed Profile.

The entry policy module (`src/account/entry-policy.ts`) holds that rule. Its
input is the route class (`auth` for the email-link and password-reset screens,
`account` for sign-in, `onboarding`, `tracking`, `other`) and the Account, storage
and Profile readings; its output is one decision:
render, loading, wait, redirect, Profile recovery or storage failure. It also says
whether a reminder tap waits, opens or is dropped, and where a saved Onboarding flow
exits. The app evaluates the rule in layers because each layer's readings exist only
below the one above it: AccountDataProvider (`sessionGate`, then `storageGate`), the
root navigator (`navigatorGate`: theme, fonts, Profile) and each route
(`routeDecision`). Those are adapters that render the
decision through `EntryGate`; `entryDecision` composes the layers, and its unit test
covers every route and reading combination.

The Track tabs module (`src/navigation/track-tabs.ts`) owns the tab list, the hidden
Personal journal tab after it and the navigator's `initialRoute` Back, so native Back
returns Home and never selects the journal. It also decides which screens show the
Selected day and calendar, the originating tab the journal's Back returns to, which
header popover survives a route change, and the route requests (`workoutMenu`,
`liveWorkout`, `workoutImport`, `section`): their builders, and the parsers
`useRouteRequest` applies before a screen sees a value. The tab layout and the app
header are adapters over it.

## Account tracking storage

Account storage owns device namespaces, legacy onboarding import, durable pending
saves, cloud revisions, deletion records, conflicts and synchronization lifecycle.
Its interface exposes ordinary key-based reads and writes, synchronization
intentions, snapshots and key-specific external-change subscriptions. Device
storage and the Supabase document transport are adapters at this seam.

The Account tracking document registry (`src/account/tracking-documents.ts`)
lists every synced document once, with its storage key, parser and Settings name.
Account storage, Cloud conflict names and the history partitions read keys from it
or from the domain key constants it uses, so each key is written in one place.
Each document's provider comes from `createDocumentProvider`, which owns store
creation per account scope, subscription, start and stop, and the context guard.
The tabs mount the documents they read through `AccountTrackingProvider`, and
`TrackingRefreshNotices` renders their refresh notices from the same list; Profile
mounts above them with the account scope. Adding a synced document means a domain key constant, a provider from the
factory and one registry entry.

Logged steps (`kinevault-track.steps-log.v1`) are a device-only document: their
provider comes from the same factory and mounts with the others, but the key is
not in the registry, so account storage keeps it under the account's local prefix
without syncing it, and account deletion cleanup removes it with the rest of that
prefix. Syncing it would need the cloud `track_documents` key allowlist to accept
the key first. Phone steps never reach storage: `src/steps/device-steps.ts`
(Core Motion on iOS, Health Connect on Android, nothing on web) is read for the
Selected day while Home shows it.

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

Startup reads this device's documents first. If they hold a completed Profile, the
Account opens at once and the first cloud sync runs in the background; otherwise,
including an onboarding draft, entry waits for that sync. An edit queued behind a
cloud replacement keeps the revision it was built on, so its upload becomes a Cloud
conflict instead of overwriting the downloaded change.

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
through the existing Custom food persistence interface. `catalogWriteState` is the one
write rule for the drafts and the forms: Saving belongs to the session's own write, and a
refresh, another write or an unloaded catalog only locks Save. Food and meal forms submit
intentions and render the session snapshot. Retained drafts keep their own failure
message across unrelated storage operations. A completed save cannot discard fields
changed while it was pending, close a replacement editor or deliver its result to
that editor. Save completion is delivered before retirement notifications can
detach the submitting form. Successful deletion retires only the deleted item's
retained edit; callers cannot bypass durability to retire an edit themselves.
Catalog drafts receive the Custom food persistence when created and also own
saved-item deletion feedback, scoped to the caller that requested it, and the Meal
destination that Logging attempts read and write.

The Exercise tab view owns the tab's panel and the tokens that keep late results
local to the panel they began on, follows the exercise store directly (it subscribes
while started, so tests and the app use the same store), the query, focus and the `workoutMenu`,
`workoutImport` and `liveWorkout` route requests, which it receives as intents.
Workout edits and Library drafts reach the panel through its panel seam; before a
panel changes, the view asks Workout edits to save the logs it leaves and stays put
if one can't save. Its snapshot decides where every Workout log and panel goes: compact
cards stay on the tab, and every other panel, the Active workout's page included, is
a sheet with its title, back name and test ID. On the default view the Active
workout is a Live workout card that opens its page; when that workout ends, the
snapshot marks the day's card that replaces it to fade in. Workout edits open that page
after a Start from the day, keep the edit when its back button leaves it (the
`leave` action saves first and stays put if the save fails), and don't save a
workout before opening its own page. `activeWorkout` in the exercise model is the one
lookup of the Active workout. The app header reads the Active workout from
the exercise store and opens the page through the `liveWorkout` route request. Workout edits own the selected exercise, the Details
disclosure and the planned-set settings disclosure, which reopens when a planned count is
invalid, and
the same log mode drives planned-count validation. The edit's snapshot carries that
mode and the controls it allows from one table, `workoutLogControls`: whether Back
leaves or cancels and its name, Save or complete and its label, Discard, Start,
Details, Retry, the overline and the sheet's title and test ID; the compact card, the
editor and the sheet render them. `parsePlannedSetCount` in the exercise model is the one planned-count
rule for Workout edits and Workout templates. `setHints` there gives each blank set its
Previous sets hint, and `matchingExercises` is the one library search rule; it takes the typed query.
`short-name.ts` owns both row labels: the accessible "Squat exercise 2" and the chip label. Library drafts own Exercise
definition, Workout template (including its selected exercise, builder disclosure and
search), Saved workouts and Workout import state per panel, so the sheet can unmount when the tab
loses focus without losing input; their durable success closes the originating
panel through the same panel seam as Workout edits. Exercise persistence returns
each write's outcome: saved with its value, rejected with its command's reason, or
unavailable when storage failed, a refresh blocked it or the document isn't loaded.
Workout edits and Library drafts show that reason after their own lead ("Couldn't
start.") and offer a retry only when nothing was written. The sheet page owns its
header overrides and scroll positioning: pages claim the back button with
`useSheetBack`, request a scroll target with `useSheetScrollTarget`, and a new
`page` starts at the top. A page can replace its centered title with `center`, as
the live workout does with its timer.

Demo link (`src/exercise/demo/demo-link.ts`) picks the demo a template or log
exercise shows (the library's current link, else the saved copy's), turns catalog and
clip readings into one status, and maps that status to its notice and the Retry target
(`demoNotice`: the catalog or the clip). It also holds the player's attempt state as a
reducer (`demoPlayback`): poster, starting and playing; a start timeout fails only a
clip that never started, and losing focus returns it to the poster. `exercise-demo.tsx`
keeps the expo-video adapter, focus and timers.

The Food tab view owns the Food tab's query, its page over the log and the owners
behind that page (a Logging attempt, a Product import flow). Catalog views
(creation, resumed drafts, import, a created item, an open catalog editor) survive
a day change and follow the new day; other views return to the new day's log and
reset the Meal destination. Leaving the tab hides the page without discarding it:
the scanner closes, a pending lookup is interrupted, and saves that finish while
hidden still route their page. It also owns removing a Logged food entry: one open
confirmation, the removal, and its failure. From confirmation until the write settles, the
entry's fade included, the removal counts as a write, so other entries, search and resuming
stay locked. A logged entry's details and Daily macros show only over a loaded food log.
React keeps only scroll and keyboard effects and the entry's fade.

A Logging attempt is built from the food-log persistence, the Custom food
persistence and the Meal destination. It derives whether it can submit from them
and follows the live saved item; only its own pending write reads as saving, and
a save started during a food-log refresh waits for the refresh, then writes the
preparation that is current at that point, since the day or food may have changed.

Daily activity (`src/daily/activity.ts`) reads one day from every saved source: the
food log, Manual water and the Water goal, workouts, and Phone steps plus Logged steps.
Each source reports its own availability and retry, and the activity owns the Home Steps,
Water and Workout tile wording (Workout covers loading, error, empty, live and done, plus
the Exercise title's one-line summary), so Home, Exercise and the Personal journal read it
instead of the providers.
It also computes the day's nutrition progress beside its targets (eaten, left or over,
percentage and each macro's share of the calorie ring, rounded to whole kcal and grams to
one decimal) and writes the figures the screens show ("eaten / target unit", the Food
title and the ring's left, over or eaten caption), so the Home ring and macros, the Food
title, Daily macros and the journal only draw it. A missing calorie or macro target shows as "—" and is read as "unset", and
"Set your goals" is one link that pages close before following.
`useDayActivity` is its React adapter; only Home asks it to read Phone steps. The journal's
streak comes from the same activity and is counted once per change of its sources.

Completed Workout totals derive from persisted Workout sessions and their valid
sets. Daily activity and test fixtures use the same Exercise summary interface;
there is no separate workout interpreter or fixture-only measurement model.

`workoutGraph` (`src/profile/activity.ts`) returns the weeks the Workout graph draws:
weekly buckets ending today, the exercise options with the resolved selection, the
latest week and the pending message (fewer than two weeks with measurements);
`workoutWeekLabel` captions a selected week. `workout-chart.tsx` only scales the axes,
draws and maps touches.

Barcode lookup owns provider validation, cancellation, request budgets and its
bounded cache. Responses are limited to 1 MiB of UTF-8 data before JSON parsing
or caching. Web streams stop reading and cancel when oversized or abandoned.
Native fetch buffers internally; its fallback checks decoded response size
before parsing, so the limit does not bound native transport buffering.

Food catalogs retain their original membership and build the search index once,
on the first eligible query. Construction, food-by-ID lookup and empty queries
do not tokenize the catalog or build an index during server rendering.

## Durable domain documents

Profile, Exercise, Food log, Custom foods, Manual water, Logged steps, Water goal
and Reminders persistence share the durable-write module's lifecycle. Their own modules retain validation,
mutations and domain-specific results. Callers do not coordinate storage ordering,
write exclusion, subscriber cancellation or stale read generations themselves.

Optional key-specific subscriptions refresh the relevant durable document through
the same interface. A notification during a write is deferred until the write
settles. Draft owners remain mounted and merge their chosen fields into the latest
saved document when the user saves. Tests cross the domain interface instead of
depending on private lifecycle state.

Manual water and Logged steps are both day amount documents (`{ version: 1, days:
{ date: amount } }`, a whole amount from zero per date) built from
`src/persistence/day-amount-log.ts`. It owns their parsing, the durable
`set({ date, amount })` that replaces one date's amount, and the edit whose `adjust`
keeps the draft between zero and the safe maximum. `DayAmountSheet`
(`src/persistence/day-amount-sheet.tsx`) is the one entry sheet for both; the steps sheet
adds its phone panel, whose status, count and offered fix `phoneStepsStatus` decides. Each
domain keeps its own storage key, parser and messages.

`stepFields` in `src/profile/answers.ts` is the one map of which Answers fields each step
owns. The Onboarding flow uses it to decide which errors block Continue; focused Profile
edits use it to split errors between the section's Question and the editor's inline
messages.

Manual water, Logged steps, Water goal and focused Profile edits share the
document-edit module.
It owns the draft's seeding (fill once or follow until typed), save exclusion,
write reservation before observers run, stale-completion handling,
persistence-failure feedback and load state with retry. Domains supply the seed,
the draft parser (section merge for Profile) and the write command. Editors read
load state and retry from the edit; one React adapter mounts every edit.
Body-weight and Profile media edits keep their own modules: their attempts open and
close by command, and media has a separate two-phase lifecycle.

External refresh keeps the last ready document visible while validating its
replacement. A failed refresh carries a typed `refreshError` and retry action,
retains draft owners, and blocks stale writes until a valid replacement is read.
Normal save failures remain separate from failed refreshes. The durable snapshot
reports `refreshing` while a background refresh validates; `saving` still excludes
writes during it, and editors label "Saving…" only for a running write.

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

Every pressable control is a Tappable. It owns the accessible role, name and
state, the keyboard-only focus ring, the pressed state with its one press
feedback (a 0.97 scale that reduced motion drops, or the accent fill for rows and
links), the single disabled fade (`disabledOpacity`, which SegmentedControl also applies
to its raised fill) and the 44 pt minimum target; callers only draw
the control. AppButton is the one button on top of it, with a tone (primary,
secondary, danger, destructive, link) and a size (regular, compact, small).
DeleteButton is the one delete control (button, pill or icon) and arms, then
confirms, on the same node. There are no area-specific button variants.

An exclusive choice between a few options is a SegmentedControl. Callers give a
group label, the options (value, label, optional short label and icon), the value
and onChange, and pick what assistive technology hears: pressed-state buttons, a
radio group or tabs. The control owns the sunken track, the raised fill that
slides to the chosen option and its reduced-motion fallback, short labels on
narrow tracks and each segment's Tappable behavior. Pill choices (meal and serving
pills, reminder days and kinds, a workout's exercise chips) are Chips: a button,
radio or checkbox whose fill eases in when chosen.

Every text field is a TextField. It owns the label and accessible name, the
sunken surface with its focused and invalid looks, the keyboard and autofill for
its kind, length limits, the unit suffix, optional numeric filtering and invalid
semantics: `aria-invalid` and exactly one alert for its error. Feedback next to a
control is an InlineMessage (an error alert, or a success or info status). A
source that could not be read shows a LoadFailure: its message as one alert and a
Retry that stays busy until the retry settles. Only the exercise set cell, the
search boxes and the Profile name field draw their own inputs.

Small modal tasks (editing water, logging steps, the profile photo, progress
photos, weight entries, the details chooser) are ModalSheets: a bottom sheet on phones and a
centered dialog on wider windows. The caller only says whether it is open. The
sheet owns the backdrop, the entrance, the exit for every way of closing (holding
the last content while it leaves), reduced motion, Escape and Android Back, and
moving focus in and back out on web. A caller that acts after the sheet has gone,
such as opening a picker, does it in `onClosed`. Flows that leave the day view
are SheetPages: a full page with a back-button header, whose nested pages take
over its header instead of stacking another sheet. The water and steps entries
share the round ± Stepper (`src/components/stepper.tsx`), whose accessible name
carries the amount and unit.

Popovers (the header calendar, the profile menu and the journal's choice lists)
use `usePopover` for dismissal: Escape returns focus to the trigger, Android Back
closes, and light-dismiss popovers also close on an outside press or when focus
leaves. They draw on `PopoverSurface`, which owns the raised surface, the one
popover shadow and the entrance. The journal's choice lists also close when their
tab loses focus, so their listeners don't outlive the screen.

The only raw Pressables left are the error screen's Reload button, which renders
outside the theme, and tap areas that are deliberately not accessible (the header
title area and popover backdrops). A Tappable with `href` is a route link, an
anchor on web. Leading icons in rows and cards sit in an IconWell (regular for
rows, large for a card's lead), and a sub-view's title block is a ViewHeader.
`motion.tsx` keeps the motion policy (MotionProvider, useReducedMotion), the
shared curves and durations, and the entrance, layout, progress and step helpers.

## Verification

The October 17, 2026 final check removed unused props (AppButton `iconPlacement`,
Icon `solid`, FoodLogStatus `fill` and `testIDPrefix` on the Home calorie and
nutrition widgets) and exported `disabledOpacity` for SegmentedControl. In the same
pass, food logging writes the current preparation after waiting for a food-log
refresh, the workout settings disclosure toggles and reopens on a count error, the
live timer ticks on whole seconds and its accessibility label includes the time,
food entries stay disabled while another entry's removal fade runs, and Settings
shows account action errors in one place. All 1160 unit tests passed. The
full browser run had 206 passes, one skip and one profile-menu failure; reverting
the change that caused it fixed it, and that file then passed 7/7.

The October 16, 2026 architecture pass (tab views, Logging attempt, Catalog and
Library drafts, document edits, shared controls and the Account tracking document
registry) passed lint, formatting, TypeScript, all 1158 unit and script tests and
207 browser tests, with one optional screenshot case skipped. One earlier full
run had a single water-goal layout check fail under load; it passed alone, in
two parallel runs of its file and in the next full run.

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

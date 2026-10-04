# Profile edit ownership

The Personal journal repeats editing lifetime rules in its avatar, photo gallery,
photo form, inline name and focused section forms. Consolidate those rules into
two domain modules without changing the visible layout or durable formats.

## Profile media edit

One owner keeps an avatar edit or the gallery's current Progress photo edit. The
gallery's first selection and subsequent photo form share the same owner, so a
chosen source is never transferred between independent lifetime protocols.

The module owns selection, replacement, date/note validation, pending exclusion,
Save, removal, failure retention and cancellation. It injects the existing Expo
picker adapter and reads the real media persistence snapshot. Durable import,
metadata publication and owned-file cleanup remain in media persistence.

An operation captures its attempt and inputs before notifying observers. Late
picker results and save completions cannot alter replacement edits or detached
views. Temporary source retirement waits for any operation that still uses the
source. React effect restart must not make an edit unusable.

## Focused Profile edit

Each inline name or section form owns an independent focused Profile edit. The
module owns raw answers, updates, complete-profile validation, owned-field merge
into the latest saved answers, save exclusion, retry and successful retirement.
The existing field-ownership and Profile persistence modules remain in use.

Inline name editing remains mounted across Personal journal section switches.
Section forms discard their draft when replaced or left. A detached section's
pending durable write may finish, but cannot close a replacement form. Water goal
editing, onboarding and Workout edit retain their distinct persistence and rules.

## Verification

Direct tests exercise each editing interface with real persistence and in-memory
metadata/assets. A deferred picker supplies controllable platform completion.
Cover invalid input, failed writes and retry, latest saved values, competing
commands, observer reentry, replacement, dismissal and effect restart. Retain
browser tests for form interaction, navigation, accessibility and real web media
durability. Check TypeScript and web/native exports after caller migration.

## Implementation

- `src/profile/media-editing.ts` owns Profile media edits; `use-media-editing.ts`
  binds one stable owner to the avatar or gallery. `PhotoEditor` renders the
  gallery owner's snapshot rather than accepting a transferred temporary source.
- `src/profile/focused-editing.ts` owns focused Profile edits;
  `use-focused-edit.ts` binds independent owners to the inline name and section
  forms. The existing section editor identity still protects navigation.
- Each provider exposes its stable persistence separately from its rendered
  snapshot, so commands read the current durable state without stale closures.
- Both Save commands reserve the real durable write before notifying their
  observers. Validation notifications reject recursive submission, and media
  edits copy picker results before retaining them.

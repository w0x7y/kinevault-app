# Profile final check — October 4, 2026

## Scope and method

Reviewed the complete Personal journal feature against `211eb49`, including
committed revisions through `a49352e` and the unstaged media/focused editing
refactors. The base precedes the first Profile feature commit. Reviewed the
user's latest UI requirements, not only the initial concept. Three independent
agents reviewed media ownership, Profile interfaces and repository security;
the main agent reviewed navigation, activity/chart derivation, documentation,
configuration, generated evidence and final integration.

Unrelated existing `.gitignore`, `.ignore`, `AGENTS.md` and `opencode.json`
changes were inspected where relevant and preserved. The index started empty
and remains empty. No staging, commit, push, merge or publishing was performed.

## Corrected findings

1. **Padded names failed after passing validation.** A raw 41-character name
   containing leading spaces passed trimmed-length validation, but the durable
   Profile parser rejected its raw length. Validation now enforces the stored
   40-character limit and the inline input has the same limit. The owner test
   verifies field feedback, no attempted write, and a valid padded-name retry;
   browser coverage verifies the input limit and failed-write retry.
2. **Details chooser had no visible Cancel action.** The modal offered only
   section choices, leaving iOS users without an explicit dismiss control.
   Added Cancel. Its browser regression verifies keyboard activation, unchanged
   durable answers, no opened editor, retained Goals selection, restored trigger
   focus and successful subsequent section selection.
3. **Current documentation described superseded UI.** Updated README, product,
   design and the current spec for the Sunday-first week, automatic earliest/latest
   comparison, horizontal carousel, inline name and owner modules. Labeled the
   original implementation plan and standalone prototype as historical references.

No additional confirmed source defect, unsafe new file operation, or justified
dead-code deletion was found in the inspected feature. Existing snapshots and
historical verification counts remain dated evidence; they are not presented
as captures of the final state.

## Verification

- `npm run check`: TypeScript and all **599 direct tests passed**.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: passed.
- `npx expo-doctor`: **21/21 checks passed**.
- Targeted details-chooser browser regression: passed, including focus return.
- `npm run test:browser`: **141 passed, zero failures, one opt-in capture
  skipped** (142 scenarios). The skipped capture passed separately.
- Optional visual capture against isolated fixtures: passed; current inline name,
  photo carousel and automatic comparison captures were visually inspected.
  Captures are in `/tmp/kine-final-check-captures` and use synthetic records.
- `npx expo export --platform all --output-dir /tmp/kine-final-check-export`:
  web, iOS and Android exports passed.
- Browser test and standalone prototype script syntax checks passed.
- `git diff --check`, `git diff --cached --check` and changed/untracked text
  whitespace checks passed. The index remains empty.
- Graft rebuilt after source edits.

Collaborative preview loaded `/profile` with the name pencil, no obsolete Edit
profile control and no horizontal document overflow. Repository browser tests
provide the responsive/accessibility, media durability, navigation, point
selection, carousel and failed-save interaction evidence. Generated historical
PNG headers/dimensions and their isolated fixture generation source were checked;
representative identity/carousel captures were visually inspected.

## Remaining dependency findings

`npm audit --json` still reports **23 affected package entries: 20 high and
3 moderate, no critical**, representing four advisory chains. Advisory details
and installed versions were checked against current primary GitHub advisories
and registry versions. These are dependency findings; this review did not
demonstrate an application exploit. No forced dependency migration was applied.

| Severity | Installed chain and impact | Evidence and next action |
| --- | --- | --- |
| High | Expo CLI/code-signing → `node-forge` 1.4.0; signature verification weakness. | [Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) has no patched release. Tooling verifier calls exist; app source does not import it and update signing is not configured. Adopt a compatible upstream toolchain fix. |
| High | Metro/micromatch → `braces` 3.0.3; nested-pattern stack exhaustion. | [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no patched release. Inspected callers use configured globs; attacker-controlled pattern reachability was not confirmed. Adopt a verified compatible patch when available. |
| High | Development tunnel → Got/cacheable-request → `http-cache-semantics` 4.2.0; shared-cache response disclosure. | [Advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp). Prior isolated synthetic checks reproduced the flaw in both 4.2.0 and 4.3.0, documented in README and the workout final-check report. Ngrok does not enable Got caching and the app has no shared response cache. A verified fix is needed; the version-only 4.3.0 upgrade does not establish remediation. |
| Moderate | Router → query-string 7.1.3 → `decode-uri-component` 0.2.2; malformed-input CPU exhaustion. | [Advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) is fixed in decoder 0.5.0, whose ESM default export breaks the installed CommonJS consumer. New query-string also changes Router's expected export interface. Current linking uses `URL.searchParams`; vulnerable-decoder app reachability was not confirmed. Use a compatible Router fix or a separately validated patch. |

`npm audit fix --force` proposes incompatible Expo/Router changes and is unsuitable
as a local cleanup. All four unresolved chains remain recorded in TODO and README.
No credential/private-key match was found in the scanned current text files.
This is not a guarantee of vulnerability absence.

## Security and device coverage limits

The security pass inspected routes/deep links, local data validation, media path
ownership and blob lifetimes, fixed-host barcode HTTP requests, scripts/imports,
permissions, dependency metadata and CI/deployment configuration. No backend
account/authorization or cloud photo upload exists in this feature. Review used
source inspection and local/synthetic tests, not live exploitation or external
source uploads. Historical Git secrets, deployed hosts, actual native OS sandbox
behavior and a physical camera were not audited.

Native exports establish compilation, not native interaction acceptance. Earlier
Android emulator evidence is preserved in the revision reports. Native photo
flows were not rerun for these owner refactors. The Profile camera/library,
reopening, scrolling and accessibility check on a physical iPhone remains pending
in TODO; prior workout acceptance does not cover this new flow.

## Complete change coverage

All feature files below were reviewed; no feature item was intentionally left
unreviewed. Generated screenshots were reviewed through their source, generation
process, file checks and representative visual inspection. Unrelated local
configuration is excluded from the feature count and was preserved.

### Navigation, shared UI and activity/chart derivation

- `src/app/(tabs)/_layout.tsx`
- `src/app/(tabs)/profile.tsx`
- `src/components/app-header.tsx`
- `src/components/profile-menu.tsx`
- `src/components/ui.tsx`
- `src/profile/activity.ts`
- `src/profile/chart-weeks.ts`
- `src/profile/profile-screen.tsx`
- `src/profile/profile-streak.tsx`
- `src/profile/workout-chart.tsx`

### Profile edits, goals and persistence integration

- `src/profile/calories.ts`
- `src/profile/focused-editing.ts`
- `src/profile/journal-ui.tsx`
- `src/profile/profile-controls.tsx`
- `src/profile/profile-editor.tsx`
- `src/profile/profile-goals.tsx`
- `src/profile/profile-identity.tsx`
- `src/profile/profile-name.tsx`
- `src/profile/provider.tsx`
- `src/profile/section-editing.ts`
- `src/profile/use-focused-edit.ts`
- `src/profile/water-goal-editor.tsx`

### Photo/media lifecycle, storage and rendering

- `src/profile/media-editing.ts`
- `src/profile/media-files.ts`
- `src/profile/media-files.web.ts`
- `src/profile/media-model.ts`
- `src/profile/media-persistence.ts`
- `src/profile/media-picker.ts`
- `src/profile/media-provider.tsx`
- `src/profile/photo-editor.tsx`
- `src/profile/photo-image.tsx`
- `src/profile/progress-photo-order.ts`
- `src/profile/progress-photos.tsx`
- `src/profile/use-media-editing.ts`

### Regression suites

- `tests/focused-profile-editing.test.ts`
- `tests/media-editing.test.ts`
- `tests/profile-activity.test.ts`
- `tests/profile-chart-weeks.test.ts`
- `tests/profile-media.browser.mjs`
- `tests/profile-media.test.ts`
- `tests/profile-menu.browser.mjs`
- `tests/profile-navigation.test.ts`
- `tests/profile-section-editing.test.ts`
- `tests/profile.browser.mjs`
- `tests/progress-photo-order.test.ts`

### Configuration and dependencies

- `app.json`
- `package-lock.json`
- `package.json`

### Documentation and initial prototype

- `CONTEXT.md`
- `DESIGN.md`
- `PRODUCT.md`
- `README.md`
- `TODO.md`
- `design/README.md`
- `design/profile-prototype.html`
- `docs/superpowers/plans/2026-10-04-profile-page.md`
- `docs/superpowers/reviews/2026-10-04-profile-carousel-revision.md`
- `docs/superpowers/reviews/2026-10-04-profile-concept-3-fidelity.md`
- `docs/superpowers/reviews/2026-10-04-profile-edit-depth-review.md`
- `docs/superpowers/reviews/2026-10-04-profile-identity-cleanup.md`
- `docs/superpowers/reviews/2026-10-04-profile-menu-chart-controls.md`
- `docs/superpowers/reviews/2026-10-04-profile-personal-journal.md`
- `docs/superpowers/specs/2026-10-04-profile-edit-depth-design.md`
- `docs/superpowers/specs/2026-10-04-profile-page-design.md`

### Historical generated visual evidence

- `docs/superpowers/reviews/assets/profile-carousel/overview-comparison.png`
- `docs/superpowers/reviews/assets/profile-carousel/photos-carousel-scrolled.png`
- `docs/superpowers/reviews/assets/profile-carousel/photos-carousel.png`
- `docs/superpowers/reviews/assets/profile-concept-3/goals.png`
- `docs/superpowers/reviews/assets/profile-concept-3/overview-scrolled.png`
- `docs/superpowers/reviews/assets/profile-concept-3/overview.png`
- `docs/superpowers/reviews/assets/profile-concept-3/photos.png`
- `docs/superpowers/reviews/assets/profile-identity-cleanup/name-editing.png`
- `docs/superpowers/reviews/assets/profile-identity-cleanup/overview.png`

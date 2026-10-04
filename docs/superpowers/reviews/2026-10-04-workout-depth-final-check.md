# Workout architecture final check

Reviewed Application changes from `c653e72` through `b1c0401`, including the
final-check working-tree fixes. The checkout and index were initially clean.
At final-check handoff, changes were unstaged and no commit or remote operation
had been performed. The user subsequently authorized committing and pushing.

## Coverage

- [x] `src/app/(tabs)/exercise.tsx`: guarded panel replacement, route parameters,
  selected-day/search behavior and automatic active rendering.
- [x] `src/exercise/session-editor.tsx`, `use-workout-editing.ts`,
  `workout-editing.ts`: retained fields, reactive lifetime, failed-save recovery,
  counts, competing actions, observer reentry and retirement.
- [x] `src/exercise/library-forms.tsx`, `workout-template-draft.ts`: both template
  layouts, selection/order/count ownership, compatibility defaults and preparation.
- [x] Deleted `src/exercise/session-drafts.ts` and
  `tests/exercise-session-drafts.test.ts`: retention, cancellation/pruning and
  per-workout isolation have replacement coverage using real persistence.
- [x] `tests/workout-editing.test.ts`, `tests/workout-template-draft.test.ts`:
  observable contracts, deferred writes, failures, retry and snapshot independence.
- [x] Final-check additions to `src/exercise/commands.ts`,
  `tests/exercise-persistence.test.ts`, `tests/exercise.browser.mjs`.
- [x] `CONTEXT.md`, `README.md`, the workout-edit-depth specification, plan,
  implementation review and this report: actual behavior and verification claims.

Reviewed surrounding model, commands, persistence/provider, workspace, controls,
library and set table. No supported dead-code removal or further abstraction was
needed. The correctness and security subagent reports were independently checked
by the parent; the fix received a separate review. A reviewer's initial decoder
reachability inference was corrected after tracing the active Router call chain.

## Fixed

A blank or whitespace-only name entered in manual pre-start Settings could become
an active workout. End then rejected the name, while the active screen offered no
name field to repair it. Start now validates the name at the durable command
boundary. The edit owner gives a specific message after queued draft saves finish,
preserving the planned workout and editable fields. Two regression tests failed
before the fix and passed afterward; a browser regression covers correction,
successful Start/End and preserved measurements. Existing stored data remains
readable; this change prevents new unnamed starts rather than rewriting history.

## Security

Repository-wide inspection covered app entry points/local profile gating,
navigation, external product/barcode inputs, validated local persistence, camera
permissions, subprocess/file-import scripts, secret handling, app configuration,
CI and installed dependencies. No additional confirmed source-security defect was
found; the redacted credential-pattern scan emitted no matching paths.

`npm audit --json` reports 23 affected package entries, 20 high and three moderate,
representing four vulnerable leaf packages. These are installed dependency
findings; no working application exploit was demonstrated.

| Severity / package | Evidence and inspected exposure | Next action |
| --- | --- | --- |
| High: `node-forge@1.4.0` | [RSA verification advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv). Expo tooling uses the verifier; the app has no update-signing configuration or direct Forge import. | Await a verified compatible upstream fix; no patched release is listed. |
| High: `braces@3.0.3` | [Stack exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Metro's Micromatch dependency processes configured patterns; no attacker-controlled pattern path was confirmed. | Await a compatible upstream fix; registry latest remains affected. |
| High: `http-cache-semantics@4.2.0` | [Shared-cache disclosure advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp). Development-only Ngrok/Got chain; its caller does not enable caching. Local synthetic probes reproduce the zero-age/max-stale flaw in both 4.2.0 and registry 4.3.0. | A 4.3.0 update alone would not establish remediation despite npm's affected range. Await a verified compatible fix. |
| Moderate: `decode-uri-component@0.2.2` | [Malformed-input denial-of-service advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr). Active Expo Router inbound parsing uses `URL.searchParams`; the vulnerable alternate parser remains installed. No application invocation was confirmed. | Fixed 0.5.0 is ESM and incompatible with the current CommonJS callable import. Use a compatible Router update or separately verified mitigation. |

Dependency versions and lockfile were left intact. Audit-suggested Expo/Router
major-version changes were not applied. The security conclusion covers the
inspected paths, not a guarantee of absence of vulnerabilities.

## Verification

- `npm run check`: TypeScript and all 518 direct tests passed.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: passed.
- Focused persistence/edit-owner suite: 56 tests passed; new browser regression passed.
- Full browser suite against port 8090: all 115 tests passed, including 27 Exercise regressions.
- `npx expo-doctor`: all 21 checks passed; project configuration/dependencies unchanged afterward.
- `npx expo export --platform all`: web, iOS and Android exports passed after the source fix.
- Dependency audit/advisory verification and synthetic cache probes completed as above.

- `git diff --check` and `git diff --cached --check`: passed; the new report also passed its whitespace check. The initially empty index was unchanged at final-check handoff.

The existing Expo preview and Cloudflare endpoint both returned HTTP 200.
Physical-device execution, generated
native/binary internals, the separate sibling KineVault studio and external
infrastructure were outside this review. No live exploitation or source upload
was performed.

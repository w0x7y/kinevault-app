# Exercise v1 whole-branch review

Reviewed the changes from `e010027` through application commit `0470b76332ed0777aa85897834399d1b7963063e`, plus the pending Exercise browser tests and product documentation. The review covered the approved design and plan, all changed application files, the shared durable-write implementation, adjacent consumers, and relevant unit and browser tests.

## Verdict

Application specification and code quality are approved. No actionable finding remains in the reviewed tree. The sole stale browser assertion found during this review has been corrected and its focused rerun passed.

## Resolved finding

- P2, `tests/onboarding.browser.mjs:950`: the broad tab-layout regression expected Create Exercise and Create Workouts to be disabled. Exercise v1 intentionally enables these controls once the exercise store loads. The corrected assertion expects enabled actions on both Food and Exercise and retains the surrounding layout assertions. I inspected the correction. This was a stale test expectation, not a product-code defect. The focused responsive regression passed after correction.

## Assessment

- The versioned exercise document owns library definitions, retained workout templates, session snapshots, and the sole active session. Parsing checks nested structures, identifiers, tracking variants, raw draft field types, completed measurements, and timer consistency. Historical sessions retain their exercise definitions when the library changes or loses a source.
- Commands execute through a serialized queue on the existing durable-write boundary. Inputs are copied before waiting; session mutations capture status; stale drafts cannot overwrite a completion or recreate a deleted session. Stop/start invalidates queued work while the shared writer reloads the durable outcome of an in-flight write. Publication follows storage success.
- Planned and active editors keep current local values while queued writes finish. Explicit Close flushes pending fields. Completion submits the current draft directly, so an earlier autosave failure cannot replace current inputs. Failed active completion leaves the stored start time active. Route request tokens and mounted-state checks prevent older asynchronous actions from closing a replacement editor.
- The completed-session draft fix retains name, duration, sets, and repeated exercise additions through picker transitions. Explicit save or Close releases the draft; deletion prunes it. Initialization reads do not mutate the draft map, avoiding duplicate additions during repeated initialization. Completed edits remain separate from saved totals until successful save.
- Single-load and side measurements follow the agreed arithmetic. A side pair counts as one set, sums repetitions and kg-times-reps volume, and permits an unused side. Empty exercise rows contribute no statistics. Bodyweight contributes no invented lifted mass.
- Home and Exercise share the completed-session summary for the selected date. Multiple sessions aggregate, planned and active sessions do not count, and missing duration remains unknown. Exercise loading or corruption renders recovery instead of zero totals. Home now keeps known workout data visible when Food storage is unavailable.
- Panels capture the selected date when opened. Starting is explicit, and the active timer derives elapsed time from the stored timestamp and stays visible on other selected dates. Destructive session, exercise, set, and template controls require confirmation.
- The implementation uses existing React Native controls, theme tokens, typography, and keyboard-aware screen behavior. No new dependency or browser-only cloning API enters the runtime path. Native exports support build compatibility; physical-device keyboard, background, and interaction behavior still needs separately identified evidence.
- README, PRODUCT, CONTEXT, and the design describe the implemented feature. The design now distinguishes durable raw set measurements from validated manual minutes stored as seconds.

## Verification evidence

The parent reports the following final evidence against application commit `0470b76`:

- TypeScript, the strict unused-code check, and all 463 unit tests passed.
- Web, iOS, and Android exports passed; the web export generated 11 static routes.
- The broad browser run passed 99 of 100 scenarios. Its sole failure was the obsolete disabled-button expectation. After correction, the focused "daily screens fit" regression passed at widths 320, 390, and 1280 in both themes. All 100 scenarios therefore have passing coverage from the broad run plus the focused rerun. No second complete 100-scenario run is claimed.
- The completed-draft correction has three focused unit cases and a passing browser scenario covering edited fields and repeated picker additions. Its independent scoped rereview passed. Earlier focused reviews approved the domain and daily integration changes.
- The T3 collaborative preview navigated and produced a healthy desktop snapshot. Its resize operation timed out, so manual narrow-preview inspection is not claimed. Automated browser coverage includes narrow layouts. No ADB device was attached; physical-device interaction remains unverified.

These execution outcomes were supplied by the parent. Local commands and evidence:

- `npm run check`: `/tmp/kine-exercise-final-check.log`.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: `/tmp/kine-exercise-unused.log`.
- `npm run test:browser`: `/tmp/kine-exercise-all-browser.log`.
- `node --test --test-name-pattern='daily screens fit' tests/onboarding.browser.mjs`: `/tmp/kine-exercise-layout-check.log`.
- `npx expo export --platform web --platform ios --platform android --output-dir /tmp/kine-exercise-final-export`: `/tmp/kine-exercise-export.log`.

Implementation commits: `6ebabf6` (domain/provider), `ee0e4c2` (shared daily integration), `abf0f8a` (library/session UI), and `0470b76` (completed draft preservation). Every implementing subagent received an independent review. The UI completed-draft finding and Home Food-gating finding were fixed and scoped rereviews passed. The final whole-branch reviewer used GPT-6-Astra. No dependencies were added. The feature branch remains `feat/exercise-v1` in the shared checkout.

This review inspected source and tests and ran a clean `git diff --check e010027`. It did not repeat routine suites or claim physical-device verification.

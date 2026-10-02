# Food expansion review and verification

The nutrient and barcode changes are implemented. Each implementation task received an independent specification and code-quality review. The scanner lifecycle and import re-entry findings were fixed and independently re-reviewed; no findings remain.

## Final verification

- TypeScript and 167 unit tests passed.
- All 35 browser tests passed, including seven Food expansion regressions.
- Web, iOS and Android exports passed.
- Expo Doctor passed all 21 checks.
- Android Expo Go confirmed on-demand permission acceptance, camera connection, camera release on background, and scanner closure on tab blur.
- Live barcode lookup opened an editable Nutella draft.
- Physical optical barcode capture and iOS permission interaction remain unverified.

## Implementation decisions

- Carry the existing dirty baseline into an isolated worktree and apply only the feature delta back. This preserves user edits; overlapping changes would require resolution against their newest version.
- OFF v2 supplies barcode lookup and the shared nutrition mapper. Its deprecation may require a future API migration.
- Volume labels do not imply gram weights. Liquid imports retain product metadata and leave nutrition blank until the user enters values for a weighed gram serving.

## Independent review records

The records below include initial findings and the follow-up verdicts resolving them. Earlier test counts describe their respective snapshots; the final totals above cover the integrated source.


### Task 1 independent review

## Verdicts

- **Spec compliance: Pass.** The daily macro rows are ordered calories, carbs, protein, fat, then the existing detailed nutrients. Carbs is labeled in grams, is not indented, and uses `colors.carbs`. Its displayed value is sourced from `values.carbs`, which is the carbs field from `summarizeDay` because `values` spreads `summary` before the detailed nutrient values.
- **Code quality: Pass with a minor regression-coverage note.** The implementation follows the existing row rendering and formatting. The browser test change is limited to the expected ordered labels, as requested. Existing assertions verify layout, old-entry behavior, and row count, but the new carbs row is only observed with a zero value; the later nonzero Banana assertion checks calories, protein, and fat but omits carbs. Adding a nonzero carbs expectation there would cover the new summary-value wiring directly.

## Findings

No implementation defects found. Minor coverage gap: the regression does not assert that a logged food's nonzero carbs total appears in the new row.

## Review scope

Reviewed the Task 1 spec and plan, `task1-report.md`, `task1-review.diff`, and the current source/test files. Did not rerun checks; the task report records `npm run check` passing on this unchanged diff.

## Follow-up review

- **Previous nonzero-carbs coverage note: ADDRESSED.** The banana regression now asserts `45.4` for the 200 g serving, exercising the displayed daily carbs total.
- **Theme color coverage: ADDRESSED.** The existing light/dark theme loop compares the daily carbs label color with the carbs category color captured from the corresponding theme.
- **Responsive row count: ADDRESSED.** The expected count is updated to 16, matching the inserted carbs row.
- **No new findings.** These focused assertion changes align with the requested behavior and do not broaden the test scope beyond the daily macro regression.

**Final verdicts:** Spec compliance **Pass**; code quality **Pass**.

Reviewed the follow-up diff and report only. Did not rerun checks; the report records the focused browser run (2/2 passed) and typecheck passing.



### Task 2 independent review

Reviewed the frozen `task2-review.diff`, Task 2 plan, design spec, implementation report, and surrounding catalog, persistence, form, and log code. Provider and scanner work are outside this review. No production files were changed and no tests were rerun.

## Spec compliance

Verdict: PASS for Task 2. No concrete blocking defects found.

- Food and meal create/edit forms share the expandable component and existing nutrient labels and g/mg/mcg units. The disclosure exposes its expanded state and has a 44px minimum height. Existing controls, theme tokens, Comfortaa typography, and 12px layout spacing are reused.
- `custom-model.ts` normalizes optional amounts from one serving to per-100g values and reverses this for editing. Blank/missing values become unknown; explicit zero remains known zero.
- `meal-model.ts:87` validates whole-meal detail overrides; `meal-model.ts:104` merges them over ingredient totals before normalization. Blank values omit overrides and therefore restore ingredient calculation. Unknown calculation results remain null, and explicit zero overrides survive serialization and editing.
- Draft values live in the parent forms, so hiding the component does not clear them. Save validates the complete draft. `detailed-nutrient-fields.tsx:21` opens the section when detailed validation errors exist.
- Old version-1 food documents without details and meals without detail overrides remain readable. New persisted amounts are checked for finite nonnegative numbers, and malformed optional records are rejected.
- Ingredient and log snapshots retain copied nutrition rather than consulting edited catalog entries. The new detail calculations and overrides use those snapshots.
- `create-form.tsx:19` initializes an editable unsaved `initialDraft`; an existing food takes precedence. Changes to the import prop require a keyed remount, as documented in the task report. Task 4 must apply that integration contract.

## Code quality

Verdict: PASS. No concrete blocking defects or material maintainability findings in the reviewed changes.

The implementation keeps draft parsing and saved-data validation in the food model modules and uses one input component for both forms. Nutrient keys derive from the existing nutrient definition. Nested detail errors remain separate from macro errors, and normalized values are checked for overflow before constructing saved records. Existing save locking, mounted guards, failed-save draft retention, and immutable catalog replacement remain intact.

## Verification limits and Task 4 checks

The implementation report records 26 focused model/persistence tests passing, typecheck passing, and `git diff --check` passing. These unchanged checks were inspected, not rerun. Browser and native interaction coverage remains pending and is not claimed by this review.

Task 4 should verify collapse/reopen retention, invalid hidden fields opening on save, clearing an individual meal override and confirming the saved calculated value, explicit zero and unknown imported fields, and mounting a second imported draft without showing the first draft's state. These are integration test recommendations, not observed defects.

Spec findings: 0. Code quality findings: 0. Blocking findings: 0.



### Task 3 independent review

Reviewed `task3-review.diff`, the current barcode/model/provider implementation, the Task 3 plan and report, the design spec, and `/tmp/kinevault-food-provider-research.md`. This review covers the provider boundary and its editable draft contract, not camera hardware or the rest of the import UI. No application code changed, no commits, no subagents, and no repeated test runs.

## Spec verdict

Pass. No actionable defects found within Task 3.

- Barcode validation preserves leading zeros, validates GTIN check digits, rejects URLs and unsupported formats including QR, and expands scanner-identified UPC-E before lookup. Expansion handles the 0/1/2, 3, 4, and 5-9 zero-suppression cases. Manual eight-digit input deliberately uses EAN-8 semantics because UPC-E is ambiguous without its format.
- Provider envelopes and product identity are validated at the boundary; missing names remain editable fallback labels. Lookup distinguishes explicit provider absence from HTTP, JSON, malformed-success and mismatched-product failures.
- Import drafts preserve unknown/invalid nutrients as blanks and explicit zero as zero. Calorie conversion uses kcal or kJ divided by 4.184. Reported normalized gram quantities become the app's g/mg/mcg values, independently of contributor input-unit labels. Total carbohydrates take precedence when reported. Alcohol volume percentage remains unknown.
- Volume markers and `no_nutrition_data = "on"` leave nutrition blank. The adapter makes no ml-to-g conversion. A fixed 100 g draft remains editable; it is not persisted or logged by this module.
- Barcode lookup uses a fixed Open Food Facts v2 product endpoint and an identifying `X-User-Agent` header.
- Cancellation covers both transport and JSON parsing and is checked again before publishing/cache insertion, including cached absence. Timeout rejects even when an injected transport ignores abort. Listeners and timers are removed. Valid responses have a bounded five-minute cache; each hit creates a fresh draft. The rolling lookup budget counts issued failures/cancellations, and no automatic retries occur.

## Code-quality verdict

Pass. No actionable defects found.

The barcode helper, external-data normalization and network policy have clear ownership. The mapping table keeps unit conversions easy to audit, public inputs are small, and the injected fetch/clock/timeout support meaningful failure-path tests without application scaffolding. Caching raw validated envelopes rather than editable results prevents draft edits from corrupting later imports. UI attribution, provenance persistence, request cancellation triggers and save behavior remain integration responsibilities, as planned.

## Evidence and limits

The implementation report records 17 passing provider tests and a passing integrated TypeScript check. I reviewed their coverage without rerunning them. It includes all UPC-E expansion shapes, unknown/zero nutrition, malformed numbers, volume/no-nutrition safety, provider failures, cache independence/expiry/capacity, request budgets, timeout and stale-response cancellation.

The controller additionally reports a real browser lookup of `3017620422003` opening an editable Nutella draft with 539 kcal, 57.5 g carbohydrates and 42.8 mg sodium, with unknown fields blank. No new live provider requests were needed for this review.

Current v2 support, per-IP remote quotas and camera hardware remain the documented provider/integration limits. They do not invalidate the scoped implementation.

## Scoped follow-up: browser transport failures

Spec verdict: pass. Code-quality verdict: pass. No actionable defects or introduced breakage found.

Reviewed the added catch around `this.#fetch` and its regression test in the updated Task 3 diff/report. A fetch-level `TypeError` while the internal controller is active becomes the useful message `Could not reach Open Food Facts. Check your connection or try again later.` The handler preserves other exceptions and does not relabel failures after cancellation. HTTP-status handling and JSON parsing remain outside this catch, so their existing errors stay distinct. The timeout/cancellation race, request budget, cleanup and cache paths are unchanged; no retries were introduced.

The added test injects the browser's actual `TypeError("Failed to fetch")` failure shape, checks the exact connection message and verifies a single transport call. The implementer reports that it failed before the fix and passed afterward, with all 18 provider tests and typecheck passing. I did not repeat those checks.




### Task 4 independent review

Reviewed the frozen `task4-review.diff`, the current Task 4 files and surrounding persistence/log/catalog code, the design spec, Task 4 plan/report, and independent Task 2/3 reviews. No application files changed, no commits, no subagents, and no repeated test runs.

## Spec compliance

Verdict: CHANGES REQUIRED for one P2 camera lifecycle defect. The remaining Task 4 requirements conform.

### P2: gate camera mounting on actual foreground state

`src/food/barcode-scanner.tsx:33-38` ignores all background events while the permission request is pending, then only clears `permissionPending` when the request settles. Its camera condition at line 51 does not include foreground state. `src/food/product-import.tsx:59` renders the scanner based only on tab focus; the `active` prop from `src/app/(tabs)/food.tsx:88` cancels network requests but does not control the camera.

Concrete event sequence: open Scan; leave the permission request unresolved; background the app; resolve permission as granted before an `active` event. The background event was discarded, no settlement reconciliation closes or suspends the camera, and the permission hook's granted update can mount `CameraView` while the app remains backgrounded. Native OS suspension is not an application-level release of camera mounting. This violates the requested lifecycle behavior and the report's claim that real background releases the camera.

Track actual foreground state independently of the permission-dialog close guard and require it to mount `CameraView`. Reconcile background state when the permission flow settles, without treating a still-pending return-to-active event as an instruction to discard the scanner. Add a lifecycle regression with deferred permission settlement and background/active events. Preserve the independently verified normal Android permission acceptance flow and tab-blur close behavior.

### Requirements that conform

- A labelled barcode control with at least 44px touch size preserves offline USDA/custom name search and daily logging. Unreadable custom storage blocks creation/import instead of overwriting the existing document; existing search/log recovery remains usable.
- Scanner requests camera permission only on opening, excludes QR formats, validates product codes before lookup, locks successful detection synchronously, and leaves manual entry available when permission/camera access fails. Android's optimistic mount is appropriate because this SDK lacks Android `isAvailableAsync`; mount errors provide fallback.
- Barcode imports produce unsaved editable food drafts. Unknown nutrition remains blank, known zero remains zero, and volume-based products explain why values need a weighed serving. Saving adds a reusable food without logging; Cancel discards it; failed saves retain editable values and save locking prevents duplicates.
- Brand and validated import origin survive save, edit, reload and ingredient parsing. Only barcode-method records show the barcode badge and corresponding accessible label. Stored non-scanned imports do not show it. Manual missing-product drafts do not claim Open Food Facts provenance; provider imports show attribution in draft/edit/detail views.
- Abort signals plus sequence checks prevent stale lookup results after cancellation, scanner re-entry/tab/day changes and background. Day changes preserve mounted reusable import drafts. Nutrient form/model additions preserve the independently reviewed Task 2 normalization, nested errors, collapse retention, and unknown/zero behavior.
- Camera plugin configuration disables Android audio recording, blocks `RECORD_AUDIO`, and omits the iOS microphone permission. README, PRODUCT and CONTEXT describe the resulting behavior and remaining device limits.

## Code quality

Verdict: CHANGES REQUIRED for the same P2 lifecycle defect. No additional actionable defects or material maintainability findings found.

Camera ownership belongs in the scanner, networking/parsing remain in the provider, import orchestration is separate from the editable form, and shared metadata parsing keeps saved food/ingredient boundaries consistent. Existing food-save locking, failed-save retention, immutable catalog replacement and saved log snapshots remain intact. The lifecycle defect arises because tab focus, app foreground and permission pending are three separate facts but camera mounting currently checks only granted permission and device availability.

## Evidence and limits

The implementer reports TypeScript and 166 unit tests plus all 33 browser regressions passing. The controller subsequently reports TypeScript and 167 unit tests passing after the independently reviewed transport-message fix, and successful web/iOS/Android exports. These checks were inspected, not repeated.

Browser coverage includes editable imports, failed-save retry, badge/brand reload, manual missing products, provider retry, volume/unknown values, cancellation on scanner re-entry/tab/day changes, and day-preserved drafts. It does not exercise native permission/background event ordering, which is why the P2 needs a focused lifecycle test.

The controller independently verified a real editable Nutella barcode import and Android first-time permission acceptance with the scanner retained and an active native camera client. Those successful flows do not cover permission settlement while still backgrounded. Physical optical capture, iOS permission flow and assistive-technology interaction remain unverified device checks, not separate observed defects.

Spec findings: 1 P2. Code-quality findings: the same 1 P2. Additional findings: 0.

## Scoped follow-up: permission settlement and foreground gate

Spec verdict: PASS. Code-quality verdict: PASS. The original P2 is resolved; no unresolved findings remain for Task 4.

Reviewed `task4-foreground-review.diff`, the actual scanner and browser fixture, the appended implementation report, and the installed SDK's web permission implementation. No application files changed and no checks were rerun.

`barcode-scanner.tsx` now records background/active events independently of `permissionPending`. Camera mounting requires `foreground` as well as granted permission, availability and no mount error. A background event during a deferred permission request sets foreground false even though the scanner form stays mounted. When permission resolves granted, that update cannot mount `CameraView`; the next active event permits mounting. This removes the resource defect without closing the scanner merely because the permission promise resolves before the native active event. A normal background after settlement still closes the scanner, and tab-blur cleanup is unchanged.

The new regression exercises this ordering through document visibility events, the actual React Native web AppState behavior, Expo's permission hook, deferred `getUserMedia` and real canvas MediaStreams. Its grant-response assertion waits for the permission button to disappear while the scanner remains present, then checks that no video element or second capture request exists while hidden. On resume it requires a video/capture request. Cancel and a later settled-permission background must detach the camera and end all media tracks; returning active must leave the log rather than remount the camera. The injected permission query returns prompt with `canAskAgain` true through Expo, so disappearance of Allow camera corresponds to the granted-hook render. The old missing-gate condition would mount the video during that render and fail the background assertion. The worker did not run the test against the previous implementation; this expected failure is established by inspecting the old condition and SDK behavior, not claimed as an observed test run.

The worker reports the focused lifecycle regression passing, all 6 expansion browser tests passing, TypeScript passing, and clean diff checking. The controller additionally observed no active native camera client after pressing Home with the Android permission prompt unresolved. That native experiment leaves the request pending and therefore does not force the deferred-grant ordering; the controlled browser regression covers it. Previously verified ordinary Android permission acceptance is preserved by the source flow. Physical optical capture and iOS permission interaction remain device-verification limits.

Current spec findings: 0. Current code-quality findings: 0. Original P2: resolved.



### Final whole-feature integration review

Reviewed the full feature diff against preserved baseline `0f941d4`, all changed production modules, the new unit/browser tests, documentation, design spec, plan, ledger, and Task 4's scoped foreground follow-up. No app files, index, branch state or commits changed. No checks rerun; validation below is controller-reported evidence.

## Strengths

- Detailed nutrient normalization consistently distinguishes unknown from explicit zero and keeps g/mg/mcg conversions at the appropriate boundaries. Food values are per serving; meal overrides remain whole-meal amounts when ingredient weights change. Old version-1 documents remain readable, and saved ingredient/log snapshots stay independent of catalog edits.
- Provider parsing, fixed-host transport, barcode validation, editable draft creation, and metadata persistence have separate responsibilities. Stale network work is aborted and sequence-guarded. Rate limits, timeouts, invalid envelopes, missing products, upstream failures, volume-based labels, and failed local saves receive deliberate handling.
- Import origin survives editing/reload, only barcode imports receive the badge, and stored non-scanned imports retain attribution without a scan badge. Offline catalog/name search remains available alongside barcode lookup.
- The corrected camera lifecycle gates mounting on foreground state independently of permission-prompt ordering. The deferred-permission regression checks both camera attachment and release of real browser media tracks.

## Issues

### Important — P2: global import actions do not reopen their own mode from an existing draft

**File:** `src/app/(tabs)/food.tsx:88` (with `openImport` at lines 72–73 and `src/food/product-import.tsx:24`).

**Trigger:** Open Scan food barcode, look up a valid product until Review imported food appears, then press the still-enabled Scan food barcode control beside search. The scanner does not open; the previous review draft remains. Re-pressing Scan during its existing lookup also leaves that lookup running.

**Cause:** `openImport` replaces the parent view with the same mode, while the child key is only `view.mode`. React preserves `FoodProductImport` and its local `state`, whose initial mode is used only on mount. Neither the active/date effect nor another action resets that state for a fresh invocation of the same mode.

**Impact:** The requested global scanner button fails to perform its labelled navigation from common import states. Users must first cancel or switch to another mode to make those actions work.

**Fix:** Give each explicit import invocation a fresh session identity/key, or provide an explicit reset action that aborts pending requests and enters the requested initial state. Preserve reusable drafts during unrelated day/tab changes. Add regression coverage for re-opening Scan from its review draft, plus same-mode reopening during a pending lookup so the old result cannot replace the new scanner.

No Critical findings. No additional Minor findings.

## Scope and evidence

The nutrient and barcode feature areas are implemented. Blank nutrition for volume-labelled products is an accepted ruling. The existing required four macro fields still require user completion when a provider value is unknown; imported unknown values are not invented as zero.

Controller evidence reports final 167 unit tests, TypeScript, all 34 browser tests, web/iOS/Android exports, and Expo Doctor 21/21 passing. Current browser sources include the foreground regression and cover saved import metadata/badges, editable drafts, failed-save retry, detailed nutrients and cancellation on day/tab/scanner re-entry changes. They do not cover the same-mode re-entry trigger above.

A live Nutella barcode lookup and the normal Android first camera permission grant were independently exercised by the controller. On the latest source the controller also confirmed the active Android camera client, camera release on app background, and scanner closure on tab blur. Physical optical capture and iOS permission interaction remain explicitly unverified device checks, not observed defects.

## Assessment

**Ready to merge: With fixes.** The feature's data handling and normal import flows are sound. Resolve the one P2 global-action re-entry defect and perform its focused regression before calling the integrated feature complete.

Spec findings: 1 P2. Code-quality findings: the same 1 P2. Additional findings: 0.

## Scoped follow-up: explicit import session identity

**Spec verdict: PASS. Code-quality verdict: PASS. Ready to merge: Yes, subject to the controller's final aggregate validation.** The sole P2 from this review is resolved. No remaining findings.

Reviewed `final-fix-review.diff`, the actual FoodDay session state and import cleanup, and the appended implementation report. No application edits or repeated checks were performed.

Each explicit Scan action now increments a session ref and includes that required session number in the import view. Using the session as the child key gives even a same-mode invocation a new FoodProductImport instance. The old instance's cleanup aborts pending transport and increments its sequence; the new instance starts in the scanner state. Calendar and focus updates leave the session identity unchanged, preserving reusable drafts during unrelated navigation while retaining existing request cancellation and camera lifecycle behavior.

The new browser regression covers both reported review-draft triggers and reopening Scan while a barcode lookup is pending. It checks blank initial inputs, removal of the old review form, a real browser request-failed cancellation event, the scanner remaining after delayed fixture completion, and no catalog/log writes. The implementer observed this test fail on the old source at the first same-mode Scan transition, then pass after the fix; all seven expansion browser tests and TypeScript also passed. This is relevant behavioral evidence for the defect and the preservation of existing day/foreground tests. The controller's aggregate 35-browser/167-unit/export rerun is in progress and is not claimed here as completed.

Current spec findings: 0. Current code-quality findings: 0. Original P2: resolved. Device-verification limits stated above remain unchanged.

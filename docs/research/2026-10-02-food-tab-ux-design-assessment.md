# Food tab independent UX assessment A

Date: 2026-10-02. Read-only app assessment. Recommendations are proposals, not implementation approval. This assessment uses the Impeccable critique framework, Nielsen's heuristics, source inspection and a fresh T3 preview. Research was delegated to this independent assessment agent. No detector output was used.

## Overall judgement

The Food tab has a calm, readable visual system and sound separation between reusable foods and actual logged intake. Simplify the decisions around logging before changing the visual identity. The largest issue is silent draft loss through the globally available search. Serving shortcuts and contextual meal entry are the next most useful improvements.

Retain Kine, the even action/Kine split, Comfortaa, Font Awesome 6 and the palette. Retain the pinned two Search/Scan controls with a 75/25 flex allocation and the existing Scan icon color. Keep barcode badges exclusive to barcode imports. Optional detailed nutrients already use More nutrients disclosure; adding another fold is unnecessary.

## Evidence and limits

- Inspected `PRODUCT.md`, the first 100 lines of `DESIGN.md`, `src/app/(tabs)/food.tsx` and Food components.
- Started with T3 `preview_status`, then `preview_open` with `reuseExistingTab:false`. Fresh audit tab is `tab_2`, origin `http://localhost:8084`, page `/food`. Only that origin's onboarding profile fixture was seeded. No native records or port 8082 storage were changed.
- Browser interaction verified empty log, banana search/detail, draft loss and generic drink results. Browser resize timed out after 15 seconds. `innerWidth/innerHeight` remained 1280/800, so this assessment does not claim a live mobile browser walkthrough. Snapshot semantic geometry and screenshot scaling differ; absolute measurements from snapshot coordinates are not treated as app layout defects.
- Inspected root-provided native screenshot `/tmp/kinevault-food-ux-native-food.png` for the current empty mobile Food tab. Native serving and form interactions were not exercised by this assessor.
- No live product lookup response, camera permission flow, failed storage write or screen-reader walkthrough was tested here. Their observations below are identified as source-based. No app code changes or tests were needed.

Saved screenshots:

| View | Evidence |
| --- | --- |
| Empty Food log, desktop preview | `/home/idan/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muq63nq7-64361c64.png` |
| Banana detail, Log food before serving shortcuts | `/home/idan/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muq63wb6-977e8384.png` |
| Dr Pepper generic results with repeated notices | `/home/idan/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muq645bk-f98482f5.png` |
| Current native empty Food log | `/tmp/kinevault-food-ux-native-food.png` |

## Strengths

1. The meal group labels, selected date, familiar search and named scan action support recognition. The native empty-state screenshot has readable hierarchy and restrained color. The source preserves barcode provenance rather than presenting every import as scanned. Evidence: `src/daily/search-actions.tsx`, `src/daily/meals-widget.tsx`, `src/food/food-result.tsx:20,32`.
2. Nutrition responds to the gram amount and keeps calories and macro labels visible. Explicit logging separates preview, catalog saving and consumed intake. Evidence: observed banana detail; `src/food/nutrition-detail.tsx:71–100`, `src/food/create-form.tsx:68`.
3. Existing safeguards are useful. More nutrients keeps the main creation form focused; failed saves preserve amounts and meals; Food/Meal creation switches keep both drafts mounted; imported foods retain attribution and require review. Evidence: `src/food/detailed-nutrient-fields.tsx`, `src/food/logging-controls.tsx:57–59`, `src/food/create-item-form.tsx:14–33`, `src/food/product-import.tsx:69–75`.

## Priority issues

### P1. Global search silently discards a creation draft

Observed sequence in tab_2: Create food/meal, enter Food name "Audit draft", type "rice" into global Search foods, reopen Create food/meal. Food name is empty. The source confirms that `food.tsx:81` replaces the create view on every search change; `:84–87` also lets global creation, import and macros actions replace the active view. The creation component then unmounts. This is different from switching Food/Meal inside the creation form or changing dates, where drafts are intentionally retained.

Recommendation: keep a resumable draft when users move to other Food tasks. Make intentional Cancel the discard action, or explain discarding before replacing dirty work. Keep global navigation usable; do not solve this by hiding all navigation. Evaluate catalog edit and imported review drafts under the same rule. This follows error prevention and user control guidance in [Nielsen's heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).

### P2. Serving shortcuts appear after the commitment action

Observed Banana, raw detail shows Amount 100 g, nutrition, four meal choices, Log food, then Serving sizes including 1 banana, 126 g. Source: `nutrition-detail.tsx:100` places logging controls before `:108–119` serving buttons. A user who knows they ate one banana sees the Log action before the easiest way to express that portion. They may enter grams unnecessarily or log the 100 g default.

Recommendation: place serving choices beside or directly below Amount, before the nutrition preview and meal selection. Keep one clear Log action after the required decisions. If portions are long, show common choices first with an expandable list. This applies familiar ordering and recognition from [Nielsen's heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).

### P2. Empty meals do not start meal-specific logging, and additions always default to Breakfast

The empty log repeats "No food has been logged yet" for four meal sections, with no Add control in any section. Source: `meals-widget.tsx:20–56`. All new entries default to breakfast in `logging-controls.tsx:25`, regardless of intended meal. Existing entries correctly retain their original meal when editing. Observed banana detail starts with Breakfast selected.

Recommendation: add a compact Add food action for each empty meal, focusing the existing search and carrying the chosen meal into detail. Label the final action with its destination, for example "Log to Lunch". Preserve explicit meal selection for users who start from global search. Do not infer meals from time alone, especially when users are logging another date. This reduces recall and improves defaults without adding another dialog, following [Nielsen's heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).

### P2. Routine creation success requires an extra acknowledgement

Source-based: after successful creation `food.tsx:66–69` opens nutrition detail with `noticeOpen:true`; `:127–129` renders a separate FoodCreatedNotice. `created-notice.tsx:8–20` shows "Food created", where to find it and an OK button. The next real decision, serving and logging, is already behind that modal. This adds a required dismissal to every reusable-food creation.

Recommendation: replace the acknowledgement with concise inline success text on the detail screen, such as "Saved to your foods. Choose an amount to log." Keep catalog saving and logging separate. A successful save needs feedback, but the user does not need to approve the result again. [Apple's alerts guidance](https://developer.apple.com/design/human-interface-guidelines/alerts) and [modality guidance](https://developer.apple.com/design/human-interface-guidelines/modality) support reserving interruption for information that merits attention or a decision. Apple pages are JavaScript-rendered; indexed official excerpts were available, while direct open returned only the shell.

### P2. Generic drink guidance repeats at both page and row level

Observed "dr pepper" produces four generic pepper-type drinks. The page warns that these are generic, then every result repeats the generic guidance. Source: `search-results.tsx:51–58`, `food-result.tsx:10,35`. The repeated directions compete with product names, variants and nutrition that users need to compare.

Recommendation: retain one page-level explanation. Mark individual generic rows with a short "Generic" label and retain an accessible hint. Diet and decaffeinated variants must remain distinguishable. Scan remains available in its pinned row. This uses the focus and minimalism principle in [Nielsen's heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).

## Cognitive load and emotional journey

The initial page asks users to distinguish reusable creation, daily macro review, offline search and barcode scanning before the empty log explains how to add intake. These are valid tools, but the novice task is simply "put this food in Lunch". An Add food affordance at each meal would connect the visible goal with the existing tools while preserving the pinned layout.

The detail view has a clear name and amount, then makes users decide between four meal destinations, commit, and only afterward discover household servings. Moving servings earlier turns this into one linear sequence: food, portion, nutrition, destination, log. That is a reasoning-based design proposal, not a measured reduction in task time.

Kine and the familiar meal sections create an inviting start. Search results can build confidence through immediate nutrition previews. Confidence weakens when users find a portion shortcut below Log, must dismiss a save popup, or lose a draft by searching. The likely emotion shifts from "this is approachable" to "I need to be careful where I tap". No user study was conducted; this is an evaluator's prediction.

## Nielsen heuristic scores

Scores use 0–4, with 4 reserved for excellent behavior throughout. These are expert judgements, not benchmark measurements.

| Heuristic | Score | Evidence and reason |
| --- | ---: | --- |
| Visibility of system status | 3 | Selected date, loading labels, nutrition preview and save/error messages exist. The save popup over-communicates routine success. |
| Match with real world | 3 | Familiar meal names and portions. Serving shortcuts are later than the natural decision order. |
| User control and freedom | 2 | Back and Cancel controls exist; searching discards a draft without warning. Logged removal has no visible undo in MealsWidget. |
| Consistency and standards | 3 | Shared palette, fonts, controls and macro colors. Creation draft protection differs across Food/Meal switching and global task switches. |
| Error prevention | 2 | Range validation, separate catalog save and logging, and custom deletion confirmation help. Breakfast default and draft loss remain error opportunities. |
| Recognition rather than recall | 2 | Primary tools are visible, but empty meals do not expose Add and serving shortcuts follow Log. |
| Flexibility and efficiency | 2 | Search, Scan, portions and reusable meals provide alternate routes. Every addition still requires individual detail and routine creation requires OK. No recent-food accelerator appears in inspected sources. |
| Aesthetic and minimalist design | 3 | Restrained visual system and optional nutrients disclosure. Generic notices repeat and global controls persist inside task views. |
| Error recovery | 3 | Amount, meal and form values remain after save failures; retry copy is actionable. Failure flows were source-reviewed, not induced here. |
| Help and documentation | 2 | Contextual import and serving guidance exists. Empty meals do not explain the immediate logging step. |
| Total | 25/40 | Acceptable by the critique rubric. The visual foundation is stronger than the task flow. |

## Persona walkthroughs

- Jordan, first-time logger: sees an empty Lunch section, but cannot start there. They must infer that Search foods creates a log entry later, then notice Breakfast is selected and change it. A meal-specific Add path would remove both ambiguities.
- Alex, frequent logger: searches Banana, raw, wants one banana, reaches Log food before 1 banana, 126 g. Creating a reusable food also requires OK before the real logging step. Reorder portions and use inline save feedback to remove repeated work.
- Casey, distracted mobile user: begins entering a custom food, then searches an ingredient or another food with the global search field. Returning to Create food/meal loses the draft. This is browser-reproduced. Background/tab changes are not presumed to erase every draft; the source intentionally cancels stale online work and retains some local drafts.

## Minor observations

- P2, logged removal recovery: `meals-widget.tsx:43–47` immediately invokes removal from an x button, and `log-provider.tsx:7,22` exposes remove without an undo action. A brief undo would suit accidental removal better than another mandatory confirmation. This is separate from existing custom catalog deletion confirmation.
- Larger drink opportunity, source-only: `product-model.ts:42–44` detects volume-based products and keeps calories and macros blank. `product-import.tsx:64` then asks users to weigh a serving and enter nutrition manually. This creates substantial work for a user expecting Scan to log a can. A future portion model could preserve verified per-100-ml nutrition and allow ml/can/bottle logging. That needs a data-model decision and provider basis validation; never assume 1 ml equals 1 g. It is beyond a small UI simplification pass.
- Scan is visually icon-only but has an accessible name and a camera/manual-entry hint in `search-actions.tsx:126–127`. Do not label it inaccessible without a native screen-reader test.
- The product documentation mentions Food/Meal catalog choices beneath search. Current `search-results.tsx` searches both; the visible Food/Meal switch inspected here belongs to creation. Update documentation or validate intended navigation before proposing extra filters.

## Official research basis

[Jakob Nielsen's 10 heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) provide the evaluation framework: timely status, familiar ordering, safe exits, error prevention, visible task information, efficient routes and focused content. Recommendations above are project-specific inferences from those principles and inspected behavior.

[Apple HIG alerts](https://developer.apple.com/design/human-interface-guidelines/alerts) and [Apple HIG modality](https://developer.apple.com/design/human-interface-guidelines/modality) describe interruptive feedback and dedicated modal tasks. They inform the recommendation to remove routine OK acknowledgements while preserving important review and destructive-action decisions. Browsed 2026-10-02.

## Parent review

Root reviewed this assessment after completion against Food navigation, nutrition-detail ordering, logging defaults, meal rows, creation feedback and product import sources. The five priorities are supported; draft retention is preferred to adding routine confirmation dialogs. Corrected the volume-warning citation to the current source line. Assessment B was read only after A finished: CLI returned no findings; three browser rule/location pairs were framework measurement/overflow signals with no confirmed visible Food defect. These do not invalidate the interaction findings above. Both agents received a review.

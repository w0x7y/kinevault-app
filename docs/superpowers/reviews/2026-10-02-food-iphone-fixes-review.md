# iPhone food compatibility and drink hydration review — 2026-10-02

All three user requests are implemented locally. User chose explicit drink volume in millilitres, separate from gram-based nutrition.

## Result

- Shared search input normalization maps typographic apostrophes and Unicode whitespace to the same query in offline catalog matching. Saved/display names, case, product identity and nutrition qualifiers remain intact. Root T3 preview confirmed McDonald’s finds seven USDA McDonalds foods.
- Snacks and Drinks are separate meal groups with named Add food actions. Drinks requires1..10000 wholeml on new intake writes. Home Water combines manual water with persisted drink volume on the selected day. Editing grams affects nutrition independently; editing ml, moving between meals or deleting changes derived hydration only after successful food persistence. No duplicate water write; saving reusable foods/meals adds neither intake nor hydration. Legacy snacks stay Snacks; no volumes are inferred for legacy entries.
- iOS no longer calls expo-camera's web-only availability method. Installed57.0.6 CameraView throws when the manager method is absent; complete iOS CameraViewModule lacks that method. Permission and actual mount errors govern native camera availability, with manual barcode fallback, EAN/UPC-only validation, duplicate locking and resource cancellation retained. Official camera documentation identifies Expo Go support and the web-only probe: https://docs.expo.dev/versions/latest/sdk/camera/#isavailableasync . User confirmed the camera preview opens on the physical iPhone after reload. Root observed Android Expo Go active camera client while Scan and no clients after Cancel; physical barcode detection itself was not observed by root.

## Review and validation

- Task1 commit a9a2349: independent Spec/Quality Approved,147 focused unit checks,11 browser checks,typecheck.
- Task2 commit f3768b9: independent Spec/Quality Approved,63 focused unit checks,26 browser checks,typecheck. Root T3 checked independent100g/330ml values, selectedDrinks, enabledLog and no horizontal overflow.
- Final source verification: npm run check passed with297/297 unit tests; Android/iOS/web exports succeeded.
- Full browser suite atf3768b9 passed65/67; two original onboarding cases asserted the old four meal sections and three empty sections. Test-only commit2fcd8d8 updated counts and added explicit five-section/header/Add assertions. Both affected cases passed2/2, including narrow/desktop layout in both themes. No second full67-test run is claimed; all67 scenarios have passing coverage with unchanged application source. Existing drink artifact regression passed1/1 after waiting for a settled Home scene and scrolling the detail. Initial P3 screenshot evidence limitation resolved.
- Final whole-change review b33870b..2fcd8d8 Approved with no actionable findings.
- Transferred27 reviewed files after verifying original bytes match exact dirty baseline b33870b or already approved/copied Task1. Unrelated original file hashes unchanged. No original commit, merge, push or PR; helper branch retained.
- Original npm run typecheck passed after transfer.
- Native Android read-only smoke: separate Snacks/Drinks, Drinks Add focuses search, cola detail keeps100g nutrition separate from330ml, selectedDrinks and enabledLog food to Drinks. No Save/Log pressed. Restored empty daily screen and Home zero litres with Includes Drinks. Evidence /tmp/kinevault-iphone-native-five-meals.png, /tmp/kinevault-iphone-native-drink-volume.png, /tmp/kinevault-iphone-native-home-water.png, /tmp/kinevault-iphone-camera-native.png.

## Preview

Original development server was stopped at turn start; restarted Cloudflare8082. Current Expo Go: exps://stages-relevant-cargo-approximately.trycloudflare.com . It remains running.

## Decisions recorded

Ruling: direct implementation request authorizes these existing-flow changes and safe isolation/transfer; no extra design approval. Copy only baseline-verified deltas, retain original history and prior edits. Cost if wrong: reversible local rework.
Ruling: retain legacy snacks entries as Snacks without guessed ml; derive hydration from saved drink ml plus manual water. Cost if wrong: older drinks need explicit manual recategorization.
Ruling: initial original Cloudflare server was not running; restart authorized development preview8082. New URL https://stages-relevant-cargo-approximately.trycloudflare.com. Cost if wrong: previous temporary URL is replaced.

## Commits

```text
a9a2349 Fix iPhone food search typography and native camera preflight
f3768b9 Track explicit drink volume with selected-day hydration
2fcd8d8 Update five-meal browser expectations and hydration screenshots
```

## Final review

# Final whole-change review

Reviewed `b33870b..2fcd8d8`, with application source frozen at `f3768b9` and the final test-only commit inspected separately. Read the plan, ledger, both implementation reports, both independent task reviews, complete application diff, and bounded adjacent callers. No application changes, suite reruns, or additional reviewers.

## Verdict

Spec approved. Quality approved. No actionable critical, important, or minor findings remain. The change is ready for the planned baseline-verified local transfer. Original-workspace transfer and its verification remain root-owned work.

## Source assessment

- `src/food/search-query.ts`, `search-matching.ts`, and `product-provider.ts` apply the same typography normalization before local tokenization and outbound URL/cache construction. Saved labels and identities remain intact. Existing matcher qualifier/numeric protections, `drink-aliases.ts` exact-source safeguards, explicit provider requests, cancellation, and cache/budget behavior remain unchanged.
- `src/food/camera-availability.ts` bypasses the web-only probe on native platforms. `barcode-scanner.tsx` retains permission, foreground, mount-error, unmount, and duplicate-detection gates. Supported barcode filtering and parent import date/tab cancellation are preserved. The installed Expo contract and prior task evidence support the diagnosed iOS preflight failure.
- `src/daily/model.ts` introduces Drinks while preserving the snacks key. `meals-widget.tsx` renders all five sections and their destinations. Existing Food screen, search, import, created-item and retained-draft paths consume the shared Meal type without a hard-coded four-meal restriction.
- `src/food/log-model.ts` and `log-persistence.ts` validate new integer drink volumes at write boundaries and persisted volumes at read boundaries. Legacy missing volume remains readable without invented hydration. Editing strips old volume before constructing the destination entry. One serialized food write precedes publication, preserving failure/retry and duplicate-write behavior.
- `src/food/nutrition-detail.tsx` owns explicit ml separately from grams and above catalog-editor conditional rendering. Editing restores ml; gram changes and catalog saves do not generate hydration. `logging-controls.tsx` forwards volume only for Drinks.
- `src/daily/use-day.ts` derives manual water plus every persisted Drinks volume for the selected date. Home's food-readiness gate in `src/app/(tabs)/index.tsx` and water status in `activity-widgets.tsx` prevent a partial total during either unreadable store. Manual water remains an independent add operation.

## Final test correction and evidence

Independently checked the two broad browser failures in `/tmp/kinevault-iphone-final-browser.log`. Actual values were five empty sections versus the old expectation of four, and four empty sections after Lunch logging versus the old expectation of three. The new five-entry meal model and the renderer justify both corrections. Commit `2fcd8d8` changes only two test files, updates those counts, and strengthens checks for each named section and Add action. It does not weaken unrelated assertions or alter application behavior.

Inspected `/tmp/kine-task2-meal-expectations.log`: both corrected tests passed, with no failures or skips. The original broad run passed the other 65 of 67 browser tests. This is a broad run plus focused correction verification, not a claim that a second complete 67-test run occurred.

Inspected `/tmp/kinevault-iphone-final-check.log`: typecheck completed and all 297 unit tests passed. `/tmp/kinevault-iphone-export.log` records successful export; root reports all platform exports passed. Existing focused task logs and reviews cover scanner lifecycle, saved typography, import/draft retention, hydration failure/retry, date changes, reload, manual-water combination, and catalog saves without intake.

The final screenshot delta waits for the Home transition and scrolls the detail controls into view. `/tmp/kine-task2-artifact-refresh.log` records its targeted hydration test passing. I inspected both refreshed images. The Water tile clearly shows 0.35 litres and Includes Drinks. The detail shows 250 ml, nutrition for 50 g, all five meal choices, and Log food to Drinks. The earlier screenshot-quality P3 is resolved.

## Verification limits

Root recorded manual T3 checks of the curly-apostrophe query returning seven foods and independent 100 g/330 ml logging controls without horizontal overflow. The ledger records Android camera ownership while scanning and release after Cancel. The user confirmed physical iPhone preview opens. Actual physical iPhone barcode detection has not been observed. Provider fixtures verify barcode request contracts; they do not establish coverage for every product.

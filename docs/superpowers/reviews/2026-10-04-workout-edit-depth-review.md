# Workout edit and template depth review

Implemented both architecture candidates accepted from the review at `c653e72`.

`workout-editing.ts` owns retained workout fields, planned-count safety, status-aware saving, pending/error state and guarded panel replacement. `use-workout-editing.ts` binds this state to React. The Exercise route retains routing and scrolling; SessionEditor retains layout, selected-exercise detail and notes. The old completed-draft cache and imperative editor flush interface are removed.

`workout-template-draft.ts` owns an immutable name, ordered retained definitions, raw counts and ready-to-save preparation. Both template layouts use its commands. Legacy omitted counts remain zero, unseen selected IDs default to three, and removal/re-addition retains prior count text. Durable persistence, document schema and snapshot resolution remain unchanged.

Each subagent implementation received an independent spec and quality review. The first workout review found two synchronous observer re-entry defects: an older autosave could overwrite a newer field change, and validation notifications could admit a competing destructive action. Both were independently reproduced with real persistence, fixed in `3a2d45c`, and covered by three tests observed failing before the fixes. Scoped re-review approved both corrections. The template review and final combined review found no actionable issues.

Final verification at `b969434`:

- `npm run check`: typecheck and all 516 direct tests passed.
- All 26 Exercise browser regressions passed, with no runtime errors, against the existing Expo web preview on port 8090.
- `npx expo export --platform all`: web, iOS and Android exports passed.
- `git diff --check`: passed.
- Existing persistence behavior remains covered, including one active workout, captured dates, completed-only totals, blank-set exclusion, historical snapshots and failed-write recovery.

The direct suite includes 22 workout edit owner tests and 11 template draft tests. Storage controls use the existing adapter with real exercise persistence; no new dependency or storage port was introduced.

Implementation commits: `6be974a`, `3a2d45c`, `b969434`. The Cloudflare Expo server was restored on port 8082 and its external endpoint and Expo Go iOS manifest returned HTTP 200. No remote branch operations were performed.

# Workout editing depth implementation plan

> **For agentic workers:** Use subagent-driven-development with a task review after each deliverable and a final combined review.

**Goal:** Implement both accepted architecture opportunities without changing the Exercise experience.

**Architecture:** A workout edit lifetime owner replaces the route/editor/cache protocol. A separate template draft owner replaces parallel selection/count/default preparation in WorkoutForm. Both keep the existing durable exercise persistence interface.

**Tech Stack:** Expo 57, React 19, TypeScript, Node test runner, existing browser regression harness.

**Spec:** `docs/superpowers/specs/2026-10-04-workout-edit-depth-design.md`

## Global Constraints

- Preserve current layout, test/accessibility identifiers, saved schema and existing workout behavior.
- Keep durable persistence, exercise snapshots, captured dates, one active workout and completed-only totals intact.
- Keep planned-log state exclusively in workout editing and template state exclusively in template preparation.
- No new dependencies, storage ports, generic form/navigation frameworks or universal editor.
- Each implementer writes behavioral tests first, verifies the failure, implements, verifies, self-reviews and reports evidence.
- Work in the current dedicated `feat/exercise-v1` checkout so the existing Expo/Cloudflare preview receives changes. Do not push or merge.

### Task 1: Own workout edit lifetime

**Files:** Create `src/exercise/workout-editing.ts` and a focused React adapter if needed; modify `src/exercise/session-editor.tsx` and `src/app/(tabs)/exercise.tsx`; replace `src/exercise/session-drafts.ts` and its tests when superseded; create direct `tests/workout-editing.test.ts`.

**Consumes:** Existing exercise persistence commands and the current exercise document. Read the spec's workout lifetime section and current UI tests to preserve semantics.

**Produces:** One coherent owner for raw fields, status-aware durability/retention, planned count resizing, feedback and guarded replacement, with observable state and a thin React binding. Concrete interface design belongs to this task and must remove caller knowledge rather than move refs unchanged.

- [x] Write and run failing direct behavioral tests using real exercise persistence and controlled storage: completed retention/cancel, failed active fields across view replacement/retry, invalid duration, count safety, competing view requests, successful retirement and stale feedback.
- [x] Implement the owner and migrate editor/route callers. Remove obsolete imperative flush/cache lifetime machinery. Keep route parameter consumption and scrolling in the route.
- [x] Run new tests, existing exercise persistence tests and typecheck. Inspect the diff for duplicated lifetime ownership and lifecycle/re-entrancy defects.
- [x] Commit only task files, write the implementation report, then receive independent spec/quality review and address its findings.

### Task 2: Own workout template drafts

**Files:** Create `src/exercise/workout-template-draft.ts`; modify only the WorkoutForm portion of `src/exercise/library-forms.tsx`; create `tests/workout-template-draft.test.ts`.

**Consumes:** ExerciseDefinition, WorkoutTemplate and SaveWorkoutInput. Does not consume or change Task 1's planned-log owner.

**Produces:** A coherent draft interface for template selection/order/name/raw counts/preparation, used in both template layouts.

- [x] Write and run failing direct tests: legacy zero/new-ID three, retained raw count after remove/re-add, invalid/blank/oversize counts, duplicate selection, reorder, removed source snapshots and selected-only numeric preparation.
- [x] Implement the draft owner and migrate both form layouts. Keep search/detail/notes and asynchronous durable save feedback in their existing presentation roles.
- [x] Run new tests, exercise persistence count tests and typecheck. Verify caller state no longer coordinates separate selected/count maps or repeats count defaults/preparation.
- [x] Commit only task files, write the implementation report, then receive independent spec/quality review and address its findings.

### Task 3: Integration and final review

- [x] Run typecheck and the complete direct suite; run all Exercise browser regressions on the existing Expo server.
- [x] Independently review the combined diff from `c653e72` for requirements, lifetime races, Strict Mode behavior and remaining legacy paths. Fix supported findings and rerun affected checks.
- [x] Record verification and final module ownership in the review document. Confirm the user preview still runs and report changes and evidence.

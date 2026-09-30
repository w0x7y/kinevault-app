# Architecture refactor implementation

The user approved all three candidates from the visual architecture review.
See [design](../specs/2026-10-01-architecture-refactor-design.md).

1. Add behavior tests for onboarding and calorie policy. Create profile answer
   vocabulary, consolidate policy, and migrate all screen callers. Remove the
   old age-patch and target-selection entry points.
2. Add local HTTP fixture tests. Share Expo connection interpretation and
   bounded readiness between existing commands, and abort requests on shutdown.
3. Verify focused tests and existing browser flows, export web/iOS/Android,
   inspect the final diff, and document module ownership.

No dependency changes are required. Appearance and profile recovery retain
separate policies. Kine rendering and motion preference already have depth.

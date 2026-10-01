# Architecture refactor completion record

Updated October 1, 2026. Both sets of accepted review candidates are implemented;
[the architecture contract](../specs/2026-10-01-architecture-refactor-design.md)
describes current boundaries and behavior.

## Completed work

- [x] Move onboarding navigation, validation, review return, staged edits,
      repeated-action exclusion, and save ordering into the observable flow.
- [x] Consolidate calorie policy and migrate screen callers to answer intentions.
      Preserve adult/teen/manual behavior and fixed custom targets.
- [x] Share Expo manifest interpretation and bounded readiness between connection
      commands. Cancel pending readiness requests and delays on shutdown.
- [x] Move Selected day timing/wake behavior behind clock and event adapters.
      Preserve explicit date intent, local-midnight behavior, and restart safety.
- [x] Interpret completed workouts once for consistent totals and exercise rows.
      Migrate Home and Exercise; search filters rows without changing totals.
- [x] Move Profile storage lifecycle behind a controlled adapter. Preserve
      version-1 compatibility, recovery, durable publication, and stable callbacks.
- [x] Review every implementation independently, resolve final cleanup, and
      remove the unused empty-state component, SVG dependency, and old calendar
      rollover helper/test. Preserve meaningful lifecycle regression coverage.
- [x] Update the domain glossary, product/design docs, module map, and verification
      instructions. Keep appearance separate from Profile persistence.
- [x] Pass TypeScript with unused checks, 84 unit tests, 15 browser tests,
      Expo Doctor 21/21, web export with 11 routes, and iOS/Android bundle exports.

The app retains the confirmed daily layouts, shared 12px spacing, Comfortaa,
Font Awesome 6, responsive equal-column Kine rows, and empty date-specific
activity. The four creation/macro-view buttons remain disabled placeholders.
No logging source, account integration, or backend was added.

Native interaction and accessibility still require device testing. The existing
Router decoder advisory remains disclosed: three moderate package entries for
one advisory, with no confirmed reachable decoder use in the configured parser
and an incompatible direct decoder upgrade. No forced dependency migration was
performed. Expo MCP tooling and scoped UUID compatibility overrides remain.

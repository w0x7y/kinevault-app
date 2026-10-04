# Workout editing depth

Implement the two opportunities accepted from the architecture review at `c653e72`. Preserve the current layout, saved document schema and product behavior.

## Workout edit lifetime

One plain TypeScript module owns raw workout fields, planned count editing, pending/error state, completed draft retention and guarded view replacement. A React adapter binds observable state to the existing editor and Exercise route. Rendering owns exercise selection, notes visibility, layout and scrolling. Durable exercise persistence keeps command validation, captured inputs, serial writes and status protection.

The route must no longer construct/prune a completed draft cache or register an imperative editor flush handle. It requests view changes through the edit lifetime owner. Presentation callbacks retain identity protection: delayed success from an old panel cannot replace a newer view. Search and Selected day changes preserve unfinished active fields without requiring a rendering mount to be their only owner.

Planned and active raw sets save immediately. Failed writes retain fields and prevent guarded departure until retry succeeds. Invalid manual duration retains its text, allows sets to save and blocks departure. Completed fields stay local across other panels until explicit Save or Cancel. Failed completed Save retains all fields. Cancel releases them. Successful completion/save/discard retires the edit only after durable success. Start saves current fields before starting. Invalid planned counts and shrink over entered sets block Start/departure; manual metadata Settings do not validate compact-card count state. Blank sets remain excluded from completed totals. No new storage adapter, generic navigation framework or universal template/log editor.

## Workout template draft preparation

One in-process module owns name, retained selected Exercise definitions, order, raw counts, compatibility defaults and ready-to-save preparation. Both creation and saved-template rendering use this state. Previously unseen selected IDs default to three. Legacy saved IDs lacking counts initialize to zero. Removing/re-adding an ID retains its earlier raw count, including invalid text; prepared saves include selected IDs only. Duplicate additions do not duplicate a row. Invalid raw count text remains visible and blocks saving. Reordering preserves count identity and retained definitions survive library deletion. Existing durable snapshot resolution stays in persistence.

Template draft cancellation/save and planned-log set resizing are separate policies. Search, selected detail, notes and asynchronous form feedback can remain presentation state. Do not extract a parser alone or expose the old parallel setters unchanged.

## Evidence

New direct tests exercise each module's observable behavior. Workout editing tests use real exercise persistence with controlled local storage for write failures, deferred writes, competing navigation, retirement and retry. Template tests cover raw counts, ordering and preparation without rendering. Preserve useful browser and persistence coverage; remove obsolete cache tests only after replacement behavior is tested. Run typecheck, the complete direct suite and Exercise browser regression tests. Use the existing Expo preview and Cloudflare server.

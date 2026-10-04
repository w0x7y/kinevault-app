# Exercise tracking v1

The user approved implementation after defining this behavior in chat.

## Product behavior

- Exercises come exclusively from the user's local library. An exercise has a name, optional muscle group, equipment, and notes, and either single-load or separate left/right tracking. Strength and bodyweight use repetitions and optional kilograms. Blank weight means bodyweight. Timed holds and cardio are future increments; measurement variants must remain explicit.
- Reusable workouts contain a name and ordered exercise definitions, without prescribed sets, repetitions, weights, or rest times.
- Multiple named sessions may belong to the selected calendar day. A session may be created from a saved workout or built from exercises. Selecting an exercise always asks the user to choose a session or create one.
- The exercise search finds library exercises. A saved-workouts button beside it uses the same 75/25 search/action layout as Food's barcode control. Choosing a workout creates a planned session on the captured selected date. Adding sessions never starts the timer.
- Starting a planned session creates the sole active workout. A timer appears at the top of Exercise, including when another date is selected. Its wall-clock start timestamp and all entered sets survive tab switching, backgrounding, and app reopening. The timer runs until Finish workout successfully saves the completed session. The date captured when planning remains fixed across midnight.
- Planned and active session edits persist as drafts. Completion requires a nonblank name and at least one valid set. Entered sets are all completed; no per-set completion controls exist. Empty exercise rows do not contribute to statistics. Failed saves retain editable fields and allow retry.
- Manually log already completed workouts on any selected date, with optional duration in minutes. Completed sessions can be edited or removed. Active sessions require explicit confirmation to discard.
- Each left/right set has independently entered repetitions and weights. A pair counts as one set. Reps and lifted volume add the sides; volume is left kg times left reps plus right kg times right reps. One side may be entirely blank or have zero reps if the other has positive reps. A nonblank weight with blank reps is invalid. Single-load sets need positive whole repetitions and finite nonnegative weight. Body mass is never invented as lifted weight.
- Completed sessions alone contribute to daily sets, repetitions, exercises, lifted volume, and recorded duration on Home and Exercise. Session details show left/right results. Unknown manual duration remains unknown, not a measured zero.
- Exercise, workout, and session editing/deletion is supported. All destructive UI actions require confirmation. Historical sessions preserve exercise metadata and set snapshots. Deleting an exercise does not erase templates or historical sessions; templates retain their saved definition when the source is absent. Creating a session resolves existing library definitions and otherwise uses the retained template snapshot.
- Offline AsyncStorage persistence follows existing loading/error/ready and durable-success conventions. Corrupt/unavailable exercise data displays recovery and never fabricated zero totals. No accounts, hosted services, new exercise data, or external writes are needed.

## Architecture and shared interfaces

One versioned exercise document owns the exercise library, workout templates, sessions, and single-active invariant. This makes planning, snapshots, and completion atomic. Domain code remains outside Expo routes. Reuse `createDurableWrite`, with a lifecycle-safe serialized command queue so rapid draft updates cannot be dropped by concurrent-write exclusion.

```ts
type ExerciseDefinition = { id: string; name: string; muscleGroup: string; equipment: string; notes: string; tracking: "single" | "sides" };
type SetSide = { reps: string; weightKg: string };
type ExerciseSet = { id: string; kind: "single"; reps: string; weightKg: string }
  | { id: string; kind: "sides"; left: SetSide; right: SetSide };
type SessionExercise = { id: string; exercise: ExerciseDefinition; sets: ExerciseSet[] };
type WorkoutTemplate = { id: string; name: string; exercises: ExerciseDefinition[] };
type WorkoutSession = { id: string; date: string; name: string; status: "planned" | "active" | "completed";
  startedAt: number | null; durationSeconds: number | null; exercises: SessionExercise[] };
type ExerciseDocument = { version: 1; exercises: ExerciseDefinition[]; workouts: WorkoutTemplate[]; sessions: WorkoutSession[] };
```

Draft set measurements persist exactly, including unfinished/invalid input. Valid manual minutes persist as duration seconds; invalid minutes remain in the editor and prevent Close until corrected, while entered sets still save. Completed records require strict decimal parsing, whole reps, and validated measurements. Identifiers, dates, enums, strings, nested arrays, uniqueness, status/timestamp consistency, and version are validated on reads and writes. Draft parsing never accepts arbitrary nonstring values. Reasonable numeric limits prevent unusable inputs.

`createExercisePersistence({ storage, createId, now })` produces snapshot/subscription/lifecycle methods and these queued commands:

```ts
saveExercise(input: Omit<ExerciseDefinition, "id"> & { id?: string }): Promise<string | null>
removeExercise(id: string): Promise<boolean>
saveWorkout(input: { id?: string; name: string; exerciseIds: string[] }): Promise<string | null>
removeWorkout(id: string): Promise<boolean>
planWorkout(input: { date: string; workoutId: string }): Promise<string | null>
createSession(input: { date: string; name: string }): Promise<string | null>
addExercise(input: { sessionId: string; exerciseId: string }): Promise<boolean>
updateSession(input: { id: string; name: string; exercises: SessionExercise[]; durationSeconds?: number | null }): Promise<boolean>
startSession(id: string): Promise<boolean>
completeSession(input: { id: string; name: string; exercises: SessionExercise[]; durationMinutes?: string }): Promise<boolean>
removeSession(id: string): Promise<boolean>
```

Updates cannot recreate deleted sessions, change dates/status/start times, or overwrite stale completed sessions through queued draft commands. Starting an already active session is rejected. Completed edits validate before publication. Active completion computes elapsed time from the stored start timestamp; planned/manual completion parses optional minutes. Failure keeps durable records unchanged. A failed active completion leaves the original start timestamp running.

`summarizeSessions(sessions)` returns the existing `CompletedWorkout` shape, with optional `durationKnown` metadata for unavailable durations. It sums recorded seconds and labels that value Recorded duration. A nonempty collection with no known durations displays Not recorded; missing duration never claims measured zero. With multiple completed sessions its title is `Workouts of the day`; empty days retain the existing empty wording. Completed row IDs identify session occurrences. `elapsedSeconds(session, now)` derives time without incrementing a stored counter.

`ExerciseProvider` and `useExercises()` expose the store snapshot and commands across tabs. `useDayActivity` supplies this independent source to the existing daily activity aggregation. Existing consumers and tests retain the old empty default if no exercise source is supplied; actual mounted UI displays unavailable source states rather than empty totals.

## UI and verification

Use existing theme, Comfortaa, Font Awesome, flat panels, 12px spacing, keyboard-aware scrolling, accessible labels, and >=44px actions. Consulted Expo UI; reuse the app's universal form/button patterns to preserve the existing cross-platform design and avoid an unrelated native-control dependency migration. Feature-specific controls live in `src/exercise/` rather than importing Food-domain components.

Verify model parsing, snapshot preservation, multi-session summaries, side arithmetic, draft ordering, failed storage, lifecycle cancellation, corruption recovery, active restore, duplicate starts, completion retry, and captured dates. Browser regression covers creation, ordered templates, planned sessions, picker behavior, single/side set entry, manual/active completion, reload, Home totals, edits/deletion, and narrow layouts. Run full TypeScript/unit checks, browser regressions, and web/iOS/Android exports. Native-device interaction remains a separately reported verification limit if no native device is available.

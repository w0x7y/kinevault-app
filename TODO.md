# TODO

## Food & water

- [x] Integrate drink logging with water tracking.
- [x] Verify barcode scanning and drink/water logging on physical iOS and Android devices.

## Exercise

- [x] Build strength/bodyweight exercise and reusable workout creation, search, editing, and deletion.
- [x] Log saved workouts by day with planned set counts, reps, optional kg, and independent left/right measurements.
- [x] Restore the active workout, timer, and saved draft fields after reopening; retain failed edits for retry.
- [x] Share completed-workout totals with Home and skip untouched blank sets.
- [x] Complete workout-edit/template architecture refactors, independent reviews, and automated regression checks.
- [x] Verify a full workout on a physical iPhone: Start, set entry, exercise scrolling, keyboard, background/reopen, End, and completed editing.
- [ ] Add timed exercises and cardio with duration/distance in a future phase.

Optional ideas, not scheduled: previous reps/weights beside each exercise,
progress/history charts, workout duplication, and a rest timer.

## Profile & integrations

- [ ] Finish the profile screen and avatar flow.
- [ ] Decide account/sync requirements and KineVault/video integration.
- [ ] Configure app identifiers and store builds when ready to release.

## Quality & security

- [x] Verify native keyboard, gestures, safe areas, text scaling, and screen readers.
- [ ] Adopt a compatible Expo/node-forge signature-verification fix when available.
- [ ] Resolve the Router decoder advisory with a compatible update or validated patch.
- [ ] Adopt a verified compatible Braces nested-pattern denial-of-service fix when available.
- [ ] Resolve the http-cache-semantics shared-cache advisory with a verified fix; 4.3.0 alone still reproduces the flaw.

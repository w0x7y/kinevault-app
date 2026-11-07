# Track module ownership

Which module owns each behavior, and the rule to keep when you change it. Terms are defined in [CONTEXT.md](../CONTEXT.md). This file describes today's code; the older design specs describe earlier increments.

## Accounts and entry

| Module                               | Owns                                                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/account/controller.ts`          | Session restore, sign-in, recovery, email delivery and email links. Supabase Auth and the Google browser (`openAuthSession`) are injected adapters |
| `src/account/entry-policy.ts`        | `entryDecision`: whether a route renders, waits or redirects. Also reminder taps and where Onboarding exits                                        |
| `src/account/management-attempts.ts` | Export and account deletion in Settings. See [account management](account-management.md)                                                           |
| `src/navigation/track-tabs.ts`       | The tabs, the hidden Personal journal tab, Back, the Selected day and calendar, and the route requests                                             |
| `src/onboarding/flow.ts`             | The Onboarding flow: validation, staged answers, navigation and save order                                                                         |

Sign-in:

- Only a PKCE code completes a sign-in or email link. `parseAuthLink` (`src/account/auth-links.ts`) treats token-hash and session-token links as invalid, since they don't prove this device started the flow.
- `completeAuthLink` is the only entry point.
- One Google browser runs at a time. On iOS no callback screen runs after Google, so the controller drops the result itself (`oauthRedirectOpensCallback: false`).
- Signing up with an email that already has a confirmed account shows an error that says to log in. This tells anyone whether an email has an account.
- Resend stops after three confirmation emails, sign-up included, to one address in an hour on this device. Supabase's email rate limits are the server guard.
- An identity change clears the previous owner's feedback and recovery. Only the active email-link result survives.
- Server rendering doesn't create the Supabase client or its refresh timers.

Entry and deletion:

- `entryDecision` composes the layers `sessionGate`, `storageGate`, `navigatorGate` and `routeDecision`, and `EntryGate` renders the result. Its unit test covers every route and reading combination.
- Sign-in, email-link and privacy policy routes render whatever state the Profile is in. Tracking needs a signed-in Account and a completed Profile.
- After sign-in, the sign-in screen waits for the account's first download, so it never acts on an empty Profile before this device's setup answers are imported.
- A damaged Profile shows Profile recovery, which can log out without deleting saved data.
- An Onboarding save that finishes after the route loses focus can't advance or navigate the flow.
- Native Back returns Home, never the journal. `useRouteRequest` parses route requests (`workoutMenu`, `liveWorkout`, `workoutImport`, `section`) before a screen sees them.
- The `delete-account` Edge Function confirms the password, or a Google sign-in from the last 10 minutes for a Google account. It allows five attempts per account an hour.
- Deletion freezes the owner's storage before the server call and cleans up only after the server confirms. Session storage clears only for the same owner, so a late deletion can't remove a replacement account.

## Account tracking storage

| Module                                  | Owns                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/account/storage.ts`                | Device namespaces, legacy onboarding import, pending saves, cloud revisions, deletion records, conflicts and sync  |
| `src/account/tracking-documents.ts`     | The registry: every synced document once, with its storage key, parser and Settings name                           |
| `src/persistence/document-provider.tsx` | `createDocumentProvider`: one store per account scope, subscription, start and stop                                |
| `src/account/tracking-provider.tsx`     | `AccountTrackingProvider` mounts the documents the tabs read. `TrackingRefreshNotices` shows their refresh notices |
| `src/account/history-partitions.ts`     | Monthly partitions behind food and exercise history. See [history storage](account-history-storage.md)             |

- Each storage key is written in one place: the registry or the domain key constant it uses. Changing a key orphans saved data.
- Every registered document except Profile needs a notice in `TrackingRefreshNotices`; typecheck fails without it. A document whose cloud refresh failed refuses writes until that notice's retry reads it.
- Downloads skip cloud rows with an unregistered key, such as a newer build's document, and cloud export keeps them unparsed. A registered key is strict: a bad revision or payload, or one its parser rejects, fails the whole download.
- An edit queued behind a cloud replacement keeps the revision it was built on, so its upload becomes a Cloud conflict instead of overwriting the download.
- Startup reads this device first. A completed local Profile opens the Account at once and syncs in the background. Anything else, an onboarding draft included, waits for the first sync.
- Cloud sync notifies only the changed key, after it's durable. Don't remount tracking to reload it: a Water goal update would erase an unrelated Workout edit. Replacing the account does remount, for privacy.
- The account scope removes its reconnect subscription before it stops storage.
- Crash recovery sits outside the providers and remounts them without clearing saved records. See [resilience](resilience.md).
- The telemetry SDK loads only when reporting is on in an app runtime. Don't import it from server rendering: its import-time timers keep rendered bundles alive.
- Logged steps (`kinevault-track.steps-log.v1`) is a registered document. Builds from before it synced saved a bare document under the account's local prefix. Storage reads that as an unsynced edit, so it uploads on the next sync or becomes a Cloud conflict.
- Phone steps never reach storage. `src/steps/device-steps.ts` reads them (Core Motion on iOS, Health Connect on Android, nothing on web) for the Selected day while Home shows it.

To add a synced document:

1. Add a domain key constant and a provider from `createDocumentProvider`.
2. Add one registry entry.
3. Add its provider and refresh notice in `src/account/tracking-provider.tsx`.
4. Write a reviewed migration that adds the key to `track_documents_allowed_key`. `scripts/track-documents-steps-log.test.mjs` fails without it.
5. Plan the rollout. Builds from before downloads skipped unknown keys fail every download once the cloud holds a key they don't know, so every device needs the update. See [Logged steps sync](supabase-setup.md#logged-steps-sync).

## Exercise

### Tab view

`src/exercise/tab-view.ts` (`createExerciseTabView`) owns the tab's panel, query and focus, and the `workoutMenu`, `workoutImport` and `liveWorkout` route requests. It subscribes to the exercise store directly. `openLibrary` opens Saved workouts on the Selected day.

- Before a panel changes, it asks Workout edits to save the logs it leaves. It stays put if one can't save.
- Its snapshot places every Workout log and panel. Compact cards stay on the tab; every other panel, the Active workout's page included, is a sheet. The route only switches on the page kind.
- `activeWorkout` (`src/exercise/model.ts`) is the one lookup of the Active workout. The app header opens its page through `liveWorkout`.

### Workout edits

`src/exercise/workout-editing.ts` (`createWorkoutEditing`) owns each Workout log's edit state: the selected exercise, disclosures, notes, edit mode with its Add exercise search, and pending row removals.

- `workoutLogControls` is the one table of the controls each log mode allows (Back, the main action, Discard, Start, Details, Link demo, Retry). The compact card and the editor render it.
- `leave` saves first and stays put if the save fails.
- Update and complete give the library only the notes that differ from the saved log's copy. Other saved logs keep their copy.
- Exercise persistence returns saved, rejected with a reason, or unavailable. Edits and Library drafts show the reason and offer Retry only when nothing was written.

Rules in `src/exercise/model.ts`:

| Function               | Rule                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `parsePlannedSetCount` | Planned counts, for Workout edits and Workout templates                                                            |
| `resizeSets`           | Changing a row's set count: cut from the end, add empty sets. Also for adding a saved workout to a day             |
| `minutesText`          | Writes a duration as the minutes text that `durationMinutes` reads back                                            |
| `setHints`             | Each blank set's Previous sets hint                                                                                |
| `matchingExercises`    | Library search, given the typed query. `exerciseResultPage` is its page size                                       |
| `exerciseHistoryKey`   | Which logs share a history: same Exercise definition and Tracking mode. For the Workout graph and Personal records |

### Set clock, ticker and Rest timer

Workout edits own all three, so they survive the set table unmounting.

| File                                | Owns                                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `set-clock.ts` (`createSetClock`)   | One clock per Workout log. Moves the snapshot's `shownClock` each second                                                |
| `ticker.ts` (`createTicker`)        | The time and the one 250 ms timer. It runs while a clock or rest holds a tick and the tab is attached (`start`, `stop`) |
| `rest-timer.ts` (`createRestTimer`) | The one Rest timer. Its length persists through `restLength`, a device AsyncStorage key                                 |

- A finished countdown or rest buzzes through `onCountdownEnd`. The edit logs a finished countdown once it isn't busy.
- Only the Active workout's snapshot carries `rest`, driven by `toggleRest` and `adjustRest`. A document without an Active workout stops it quietly.

### Workout page

| File                            | Owns                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `workout-workspace.tsx`         | `WorkoutWorkspace`, the page for both a Workout edit and a Workout template draft                                            |
| `exercise-bar.tsx`              | Chips and edit mode tiles: remove badge, drag and add. Pins Back and Next over the caller's main action (`useSheetControls`) |
| `workspace-page.ts`             | Shared page rules: the row on screen is the selected one or the first, and stays on screen when rows move                    |
| `supersets.ts`                  | Supersets: joining and splitting (`linkToNext`), moves that keep them whole (`moveRow`), list text                           |
| `short-name.ts`                 | Row labels: the accessible "Squat exercise 2" and the chip label (three characters at most)                                  |
| `src/components/sheet-page.tsx` | Header overrides and scroll: `useSheetBack`, `useSheetScrollTarget`, `center`. A new `page` starts at the top                |

- On the Active workout, `workspaceView` takes a `done` rule, so Back and Next go through a Superset in rounds. Templates and other logs step in order.

### Library drafts

`src/exercise/library-drafts.ts` keeps per-panel state for Exercise definition (with its KineVault demo search), Workout template, Saved workouts and Workout import. The sheet can unmount when the tab loses focus without losing input. A durable save closes the panel it came from.

- A Workout template draft checks only planned counts. The save command's reason covers a missing name or exercise.
- `duplicateWorkout` names the copy and places it after the original. Linking or unlinking a demo changes the fields and the search in one step.

### Tracking modes

`src/exercise/tracking.ts` owns what each Tracking mode means: its columns, empty set, blank rule, `withSetValue`, hints, what a completed set counts (`setMeasurements`), a Timed or Cardio set's countdown (`timedSeconds`) and Warm-up sets (`isWarmUp`, `withWarmUp`, for `weighted` modes only).

- The set table renders a mode's columns and sends changes. It never builds a set itself. Removing a set changes this log only; Workout templates keep their planned counts.
- A set's `kind` is its exercise's mode. The model only checks they match.
- Sets hold saved text: kilograms, and a Cardio distance in meters. The set table shows and takes them in the chosen units (see [Units](#units)), and `columnText` names each column's unit.
- In edit mode a weighted set's number is a warm-up checkbox (the `warm-up` change), and Timed and Cardio sets hide their clock button.
- `src/exercise/plates.ts` is the Plate calculator: `platesPerSide` loads each side heaviest first in thousandths of the chosen unit, and `plateLines` and `plateLoading` word each set's weight. `plate-sheet.tsx` draws it and keeps the kilogram bar in a device AsyncStorage key, like `restLength`; Imperial shows its pound counterpart (`plateKit`, `barWeight`).

### Demos

`src/exercise/demo/demo-link.ts` picks the demo (the library's current link, else the saved copy's) and turns catalog and clip readings into one notice and Retry target (`demoNotice`). It also holds the reducers `demoPlayback` (the player) and `demoPicker` (the KineVault search). `exercise-demo.tsx` is the expo-video adapter; `demo-picker.tsx` renders the picker.

### Summary and Personal records

| File                      | Owns                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/exercise/summary.ts` | `summarizeSessions`: Completed workout totals from saved sessions and valid sets, with each exercise's `record` and Top set (`top`)  |
| `src/exercise/records.ts` | `personalRecords`: a day's records, from Completed workouts in date and document order. `estimatedOneRepMax` is the one Epley rule   |
| `src/profile/activity.ts` | `workoutGraph`: weekly buckets ending today and the pending message (fewer than two weeks with data). `workout-chart.tsx` only draws |

- Daily activity and test fixtures use the same summary interface. Don't add a separate workout interpreter or a fixture-only measurement model.
- The summary, records and graph each skip Warm-up sets with `isWarmUp`. Cardio distance totals in `meters`; Daily activity shows it in the title, the exercise row and, on a day without reps, the reps column.

## Food

| Module                          | Owns                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/food/tab-view.ts`          | `createFoodTabView`: the query, the page over the log and its owners, and removing a Logged food entry |
| `src/food/logging-attempt.ts`   | The Logging attempt: whether it can submit, its saving state and amount entry                          |
| `src/food/catalog-drafts.ts`    | Custom food and meal drafts: validation, feedback, write exclusion and the Meal destination            |
| `src/food/catalog-selection.ts` | The logging search                                                                                     |
| `src/food/product-provider.ts`  | Barcode lookup: validation, cancellation, request budgets and a bounded cache                          |

- Catalog views survive a day change. Other views return to the new day's log and reset the Meal destination.
- Leaving the tab hides the page without discarding it. Saves that finish while hidden still route their page.
- Removing an entry counts as a write from confirmation until it settles, fade included. Other entries, search and resuming stay locked.
- Entries logged while the log shows, or from a search over it, are fresh and rise into their meal. Entry details and Daily macros show only over a loaded food log.
- The tab view owns the Food copy page (`copyFood`, `copyFrom`, `confirmCopy`), which is locked like the entries. A copy is one food-log write (`copy`, built by `copiedFoodDay`): every copy lands or none does. `foodCopyPreview` (`log-model.ts`) picks the Meals on offer and the nearest other days with food. The page (`copy-food.tsx`) also shows over an unloaded log, with its loading and failure.
- `catalogWriteState` is the one write rule for drafts and forms. Saving means the session's own write; a refresh, another write or an unloaded catalog only locks Save.
- A completed save never discards fields changed while it was pending and never reaches a replacement editor. Deleting an item retires only its own retained edit.
- A Logging attempt shows saving only for its own write. A save started during a food-log refresh waits, then writes the preparation that's current at that point. Servings (`setAmountBy`, `setServings`, `choosePortion`) only compute grams; the entry still saves grams.
- `isFoodGrams` (`src/food/catalog.ts`: more than 0, up to 10,000 g) is the one solid-amount rule. `isDrinkMl` is the drink rule.
- The logging search ranks foods logged on any day first, counting once per document, and pages them with `pagedResults`.
- Barcode responses are capped at 1 MiB before parsing or caching. On native, the fallback checks the decoded size, so the cap doesn't bound native transport buffering.
- The food catalog builds its search index once, on the first real query. Construction, lookup by ID and empty queries don't build it, so server rendering never does.

## Daily activity

`src/daily/activity.ts` reads one day from every source: the food log, Manual water and the Water goal, workouts, Phone steps and Logged steps. Each source reports its own availability and retry. Home, Exercise and the Personal journal read it, not the providers. `useDayActivity` is its React adapter; only Home asks it for Phone steps.

- It owns the wording of the Home Steps, Water and Workout tiles, the Exercise title's summary and the Workout card's rows and records, and the Workout share image's text (`share` on a done tile).
- It computes nutrition progress against the targets (whole kcal, grams to one decimal) and writes the figures. Screens only draw them.
- A missing target shows "—" and reads "unset". "Set your goals" is one link, and pages close before following it.
- While the food log isn't loaded, `unavailableNutrition` gives the journal its figures. The journal's streak comes from the same activity.
- `phoneStepsKind` (`src/steps/summary.ts`) classifies the phone's reading: counted, loading, error, connect, denied, install or unavailable. The Home Steps tile and `phoneStepsStatus` word it in exhaustive switches, so a new value fails typecheck in both.
- `src/daily/workout-share.tsx` is the Workout card's Share workout button. It draws the share image out of sight in the light palette with fixed text sizes and waits for Kine. `share-image.ts` captures it with react-native-view-shot and opens expo-sharing; `share-image.web.ts` is null, so web hides the button.

## Health saving

Save to Apple Health or Health Connect writes completed workouts, Body-weight measurements and daily water to the phone's health store.

| Module                                    | Owns                                                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/health/plan.ts`                      | What to write: `healthRecords` (IDs, times, water as Daily activity counts it), `healthWrites` (versions, removals) and `healthStatus` (Settings wording) |
| `src/health/writer.ts`                    | `createHealthWriter`: the setting, access, one sync at a time and the record ledger                                                                       |
| `src/health/device-health.ts`             | The platform port: HealthKit (`@kingstinct/react-native-healthkit`) on iOS, Health Connect on Android, nothing on web                                     |
| `src/health/provider.tsx`, `settings.tsx` | Feeds the writer the loaded documents, rechecks access on foreground; the Settings switch                                                                 |

- The writer only syncs once Exercise, Food log, Water log and Profile are all loaded. An unloaded document would read as empty and remove its records.
- Records use the app's own IDs (`workout:<log id>`, `weight:<date>`, `water:<date>`) as Health Connect's `clientRecordId` and HealthKit's sync identifier, with a version that only grows, so a save replaces the older copy. A record saves again only when its source values change.
- The ledger (`kinevault-track.health-written.v1`) lists what this account wrote on this device. It lives in account storage, never uploads, and is how a deleted record gets removed. The setting (`kinevault-track.health-write`) and a random owner tag (`kinevault-track.health-owner.v1`) live there too. Every ID sent to the store starts with the tag, so accounts on one phone never share or remove each other's records.
- A failed write sets `failed` and retries on the next change, on foreground or from Try again. It never touches the app's documents, logs or crash reports.
- Records with only a date sit at noon, or now if that's earlier. Water runs from midnight to the day's end or now. Days after today wait.
- Android shares `connect` and `openHealthConnect` with Phone steps (`src/steps/device-steps.android.ts`).

## Plus

KineVault Plus is built but dormant: `plusGatesEnabled` in `src/plus/gate.ts` is the only switch. Off, every feature is unlocked and no Plus entry point shows, so the app behaves as it did before Plus. Turn it on once store billing works ([TODO.md](../TODO.md#paid-plans)).

| Module                              | Owns                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/plus/gate.ts`                  | The switch, who has Plus (`hasPlus`, `plusAccess`), the 7-day membership cache, Free's limits (`freeLimits`, `limitNotice`), the free Workout graph range and the starter demos |
| `src/plus/plans.ts`                 | The price list (`plusPrices`), plan cards, checkout and renewal wording, the store per platform, and the paywall's rows and per-feature strip                                   |
| `src/plus/purchases.ts`             | The purchase interface. Today's only implementation answers `unavailable`; RevenueCat replaces it                                                                               |
| `src/plus/provider.tsx`             | `PlusProvider` and `usePlus`: one membership read per signed-in account, mounted in the tabs layout. Settings' plan badge reads it too                                          |
| `src/plus/paywall.tsx`, `locks.tsx` | `usePaywall` and the paywall sheet; `PlusTag`, `PlusLocked` (a faded view with See Plus) and `LimitNotice`                                                                      |

- Plus is plan `plus` or `pro` with status `active`, `trialing` or `past_due`. `canceled` and `inactive` count as ended.
- A failed or offline read uses the last read on this device (`kinevault-track.membership.v1` in account storage, never uploaded) for up to 7 days, then Free. Nothing is cached while the switch is off, and an unchanged read is saved again at most once a day (`membershipCacheWrite`).
- Gating rules are pure functions in `gate.ts`, so screens only ask `usePlus().unlocked`. With the switch off `unlocked` is always true. The functions take the switch as an argument, so `tests/plus-gate.test.ts` covers both values.
- A locked control looks as usual with the Plus tag and opens the paywall naming its feature. A locked view shows the person's own data faded under one See Plus. Neither is an error or disabled.
- Limits block only creating one more item. Items past a limit after Plus ends stay usable.
- `usePaywall` returns the sheet for the caller to render, so on a phone it stacks over whichever sheet the caller is on (`SheetPage`'s `stacked`).
- Without Plus the health writer gets no sources, so it writes nothing new and removes nothing.
- Plus adds no synced document field or value.

## Durable documents and edits

| Module                                 | Owns                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/persistence/durable-write.ts`     | `createDurableWrite`: the write lifecycle for every durable document                                                    |
| `src/persistence/document-edit.ts`     | `createDocumentEdit`: draft seeding, save exclusion, stale completions, failure feedback, load state and retry          |
| `src/persistence/day-amount-log.ts`    | Manual water and Logged steps (`{ version: 1, days: { date: amount } }`): parsing, `set({ date, amount })` and the edit |
| `src/persistence/day-amount-sheet.tsx` | `DayAmountSheet`, the entry sheet for both. The steps sheet adds its phone panel                                        |
| `src/profile/answers.ts`               | `stepFields`: which Answers fields each step owns. `answerSummary`: one line per answer                                 |
| `src/profile/calories.ts`              | `isCalorieTarget`: whole kcal from 1,200 to 10,000. Answers require age 18 or older                                     |

- `createDurableWrite` serves Profile, Exercise, Food log, Custom foods, Manual water, Logged steps, Water goal and Reminders. Domain modules keep their validation, mutations and results. Callers don't coordinate storage order, write exclusion or stale reads.
- A notification during a write waits until the write settles. Drafts merge their fields into the latest saved document on save.
- A refresh keeps the last ready document visible while it validates the replacement. A failed refresh carries `refreshError` and a retry, keeps drafts, and blocks writes until a valid replacement is read. `refreshing` is separate from `saving`; editors show "Saving…" only for a running write.
- `createDocumentEdit` serves Manual water, Logged steps, Water goal and focused Profile edits. `use-document-edit.ts` is its one React adapter.
- A day amount edit's `adjust` keeps the draft between zero and the safe maximum. Each domain keeps its own storage key, parser and messages.
- Body weight and Body measurements live in the Profile document (`weightEntries`, `bodyMeasurements`), edited through `src/profile/weight-editing.ts`: `createWeightEdit` and `createMeasurementEdit` share one dated edit. Logging a measurement keeps goal answers and doesn't recalculate calorie or macro targets. `weight-chart.tsx` draws both trends, and `measureFigure` (`src/units/units.ts`) writes their figures.
- Profile media (`src/profile/media-editing.ts`) is two-phase: import the image, then commit its metadata. Image files don't sync. Committed metadata keeps its image after a lifecycle change.

## Units

`src/units/units.ts` is the one place that converts measured values (the table is in [language and units](language-and-units.md)). `src/units/provider.tsx` holds the setting (`kinevault-track.units`, a device AsyncStorage key like the appearance) and `useUnits`.

- `measureText` and `measureFigure` write a saved value in the chosen units; `limitText` writes a validation limit, rounded inward.
- `savedText` turns typed text into saved metric text and `fieldText` back. A typed value shows back exactly; text that isn't a number stays as typed, so validation rejects it. `TextField`'s `quantity` and the set table use them.
- Domain rules keep validating metric values. Functions that word a message take `units` (`weightFromInput`, `validateAnswers`, `prepareFoodLogging`, `distanceMessage`), and edits that word messages are created with the units and keyed by them.
- Daily activity takes `units` from `useDayActivity`, so every tile, title and the share image follow the setting.

## Shared controls

| Control                        | File in `src/components`           | Use it for                                                                                                  |
| ------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tappable                       | `tappable.tsx`                     | Every pressable. Owns role, name, state, focus ring, press feedback, `disabledOpacity` and the 44 pt target |
| AppButton, IconButton          | `button.tsx`                       | Buttons. No area-specific variants                                                                          |
| DeleteButton                   | `delete-button.tsx`                | Deleting. Arms, then confirms, on the same node                                                             |
| SegmentedControl               | `segmented-control.tsx`            | An exclusive choice between a few options                                                                   |
| Chip                           | `chip.tsx`                         | Pill choices: a button, radio or checkbox                                                                   |
| TextField                      | `text-field.tsx`                   | Every text field, with `aria-invalid` and exactly one alert for its error                                   |
| InlineMessage                  | `inline-message.tsx`               | Feedback next to a control                                                                                  |
| LoadFailure                    | `load-failure.tsx`                 | A source that couldn't be read: one alert and a Retry                                                       |
| ModalSheet                     | `modal-sheet.tsx`                  | Small modal tasks. A bottom sheet on phones, a dialog on wide windows                                       |
| SheetPage                      | `sheet-page.tsx`                   | Flows that leave the day view. Nested pages take over its header                                            |
| Stepper                        | `stepper.tsx`                      | The round ± for water and steps                                                                             |
| `usePopover`, `PopoverSurface` | `popover.tsx`                      | Popover dismissal, and its surface and entrance                                                             |
| Screen                         | `ui.tsx`                           | A tab's scrolling page. Scrolls to the top on a tab switch, not when a page opens over it                   |
| `pagedResults`, ResultPager    | `paging.ts`, `result-pager.tsx`    | Search results a page at a time                                                                             |
| IconWell, ViewHeader           | `icon-well.tsx`, `view-header.tsx` | Leading icons in rows and cards; a sub-view's title block                                                   |
| PolicyPage                     | `policy-page.tsx`                  | The public text pages, `/privacy` and `/delete-account`                                                     |
| Motion                         | `motion.tsx`                       | `MotionProvider`, `useReducedMotion`, the shared curves and durations                                       |

- Raw `Pressable` is allowed only for the error screen's Reload button, which renders outside the theme, and for tap areas that are deliberately not accessible: the header title area and popover backdrops.
- A Tappable or AppButton with `href` is a route link. Only the exercise set cell, the search boxes and the Profile name field draw their own inputs.
- A ModalSheet caller only says whether it's open. Anything that runs after the sheet is gone, such as opening a picker, goes in `onClosed`.
- `pagedResults` clamps the page, so a list that shrinks under its pager shows its last page. A screen resets the page by remounting on a new query. The ingredient search keeps its own compact pager.
- Popovers: Escape returns focus to the trigger and Android Back closes. Light-dismiss popovers also close on an outside press or when focus leaves. The journal's choice lists close when their tab loses focus.
- The floating tab bar (`FloatingTabBar` in `src/app/(tabs)/_layout.tsx`) reuses SegmentedControl's `Indicator` for its sliding highlight.

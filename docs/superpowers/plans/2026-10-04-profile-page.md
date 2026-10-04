# Personal journal Profile implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build the approved Personal journal Profile page with real streaks, workout graphs, editable goals, and durable local photos.

**Architecture:** Existing activity/profile providers remain the sources of truth. Pure functions derive streaks and chart data; a separate media store owns durable photo metadata/files; focused Profile sections compose those capabilities inside the existing navigation/provider tree.

**Tech stack:** Expo SDK 57, React Native, TypeScript, AsyncStorage, expo-image, expo-image-picker, expo-image-manipulator, expo-file-system, react-native-svg, browser IndexedDB.

**Spec:** `docs/superpowers/specs/2026-10-04-profile-page-design.md`

## Global constraints

- Use the selected Personal journal composition in VariantC of `design/profile-prototype.html` with Overview, Goals, and Photos sections.
- Open Profile through the existing top-right Profile menu entry. Keep the four bottom tabs.
- Preserve Comfortaa, Font Awesome icons, semantic light/dark theme, macro colors, 12px layout spacing, shared controls, safe areas, and scalable text.
- Store the feature on the device. No accounts, cloud upload, public sharing, or backup/sync.
- Only saved food/drinks, positive manual water, and completed workouts qualify for streaks; exclude future dates.
- Start the graph with Volume and the last 12 weeks. Support volume, duration, and selected-exercise weight, with 4/12/52-week ranges.
- Missing duration remains unknown/partial. Bodyweight never invents kilograms. Left/right weight history remains separate.
- Preserve stored profile, food, water, and workout formats. Media uses a separate versioned document.
- Failed saves retain drafts and saved data. Do not add unrelated features or fabricated production records.
- Work on `feat/profile-personal-journal`; do not push, merge, or publish without user authorization.

## Task 1: Derived activity and chart data

**Files:** Create `src/profile/activity.ts`, `tests/profile-activity.test.ts`.

**Consumes:** Validated `FoodLogDocument`, `WaterLogDocument`, and `WorkoutSession` records plus an explicit local `today` date. Reuse local date helpers and real set measurements.

**Produces:**

```ts
type WorkoutMetric = "volume" | "duration" | "weight";
type WorkoutRange = 4 | 12 | 52;
type WorkoutExerciseOption = { key: string; name: string; tracking: "single" | "sides" };
type WorkoutGraphPoint = {
  date: string; total: number | null; left: number | null; right: number | null;
  workouts: number; partialDuration: boolean;
};
type WorkoutGraph = { points: WorkoutGraphPoint[]; unit: "kg x reps" | "min" | "kg"; tracking: "single" | "sides" };
function profileStreak(input: {
  today: string; food: FoodLogDocument; water: WaterLogDocument;
  sessions: readonly WorkoutSession[];
}): { current: number; longest: number; days: string[]; week: { date: string; logged: boolean }[] };
function workoutExerciseOptions(sessions: readonly WorkoutSession[], today: string): WorkoutExerciseOption[];
function workoutGraph(input: {
  today: string; weeks: WorkoutRange; metric: WorkoutMetric;
  sessions: readonly WorkoutSession[]; exerciseKey?: string;
}): WorkoutGraph;
```

- [x] Write failing tests using real validated fixtures. Catch duplicate qualifying sources, today/yesterday grace, clearing/deleting records, future exclusion, leap/year/DST date boundaries, multiple workouts per day, side-specific loads, bodyweight-only records, and missing/partial duration.

```ts
assert.equal(profileStreak({ today: "2026-10-04", food: {version:1,days:{}},
  water: {version:1,days:{"2026-10-02":250,"2026-10-03":250}}, sessions: [] }).current, 2);
assert.equal(profileStreak({ today: "2026-10-05", food: {version:1,days:{}},
  water: {version:1,days:{"2026-10-02":250,"2026-10-03":250}}, sessions: [] }).current, 0);
```

- [x] Run `node --experimental-strip-types --test tests/profile-activity.test.ts`, observe missing-feature failure, then implement the contracts.
- [x] Build sorted unique qualifying dates through today; current ends today or yesterday and longest uses all qualifying dates. Return seven chronological dates ending today.
- [x] Chart points cover every local date in the range. Days without workouts have null values. Volume sums kg-times-reps; duration totals known seconds/60 and records partial duration; weight uses the highest positive kg from sets with positive reps.
- [x] Group exercise options by JSON-encoded `[exercise.id, exercise.tracking]`; use latest historical names, retain deleted definitions, and never merge tracking modes.
- [x] Run the focused suite and strict TypeScript, self-review, commit only task files, and return the task report.

## Task 2: Durable local media

**Files:** Create `src/profile/media-model.ts`, `media-persistence.ts`, `media-files.ts`, `media-files.web.ts`, `media-picker.ts`, `media-provider.tsx`, `photo-image.tsx`; create `tests/profile-media.test.ts` and `tests/profile-media.browser.mjs`.

**Consumes:** AsyncStorage-like metadata storage; platform media-file adapter; unique ID generator. Packages/config are prepared by the parent.

**Produces:**

```ts
type PhotoSource = { uri: string; width: number; height: number; file?: Blob };
type StoredPhoto = { id: string; width: number; height: number };
type ProgressPhoto = { id: string; date: string; note: string; image: StoredPhoto };
type ProfileMediaDocument = { version: 1; avatar: StoredPhoto | null; photos: ProgressPhoto[] };
type MediaFiles = {
  importPhoto(source: PhotoSource, id: string): Promise<StoredPhoto>;
  resolvePhoto(image: StoredPhoto, thumbnail?: boolean): Promise<string>;
  removePhoto(image: StoredPhoto): Promise<void>;
  releaseUri(uri: string): void;
};
function parseProfileMedia(raw: string | null): ProfileMediaDocument;
function createProfileMediaPersistence(input: {
  storage: {getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<void>};
  files: MediaFiles; createId: () => string;
});
```

The store exposes `start`, `stop`, `subscribe`, `getSnapshot`, `retryLoad`,
`saveAvatar(source: PhotoSource | null): Promise<boolean>`,
`addPhoto(input: {source:PhotoSource;date:string;note:string}): Promise<boolean>`,
`updatePhoto(input: {id:string;date:string;note:string;source?:PhotoSource}): Promise<boolean>`,
and `removePhoto(id:string): Promise<boolean>`.
Snapshot shape is `{state: {kind:"loading"}|{kind:"error"}|{kind:"ready";document:ProfileMediaDocument}, saving:boolean, error:string|null}`.

`ProfileMediaProvider` and `useProfileMedia()` expose the snapshot, commands, and
`files` adapter. `pickProfilePhoto(source: "library" | "camera", avatar: boolean)`
returns `Promise<PhotoSource | null>`. `PhotoImage` consumes `image:StoredPhoto`,
`thumbnail?:boolean`, `accessibilityLabel:string`, `style?:StyleProp<ImageStyle>`,
and `contentFit?:"cover"|"contain"`, resolves/releases URIs, and renders a truthful
unavailable state on missing/corrupt images.

- [x] Write and run failing persistence tests using controllable metadata/file storage. Assert observable publication order, write failure/retry, canceled lifecycle reads, duplicate commands, invalid metadata, replacing/deleting without losing unrelated photos, and missing photo IDs.

```ts
// A failed metadata publication must preserve the previously saved avatar.
const before = store.getSnapshot();
storage.setItem = async () => { throw new Error("Disk full"); };
assert.equal(await store.saveAvatar(source), false);
assert.deepEqual(store.getSnapshot().state, before.state);
```

- [x] Parse absent metadata to an empty document under `kinevault-track.profile-media.v1`. Validate safe IDs, positive integer dimensions, ISO local dates, notes up to 2,000 characters, and globally unique image/photo identities. Never accept arbitrary file paths.
- [x] Serialize mutations, validate before imports/writes, and publish only after durable metadata save. On failed metadata write, remove only the newly imported asset. Commit replacement/removal metadata before cleaning old files; cleanup errors must not report the successful metadata save as failed or delete another asset.
- [x] Native adapter uses an owned document directory and modern Expo File/Directory APIs. Resize originals to at most 1,600 px and thumbnails to at most 320 px, JPEG quality 0.85/0.75. Preserve progress-photo aspect ratio. Own filenames are derived solely from safe IDs.
- [x] Keep real-browser adapter checks in the browser suite, which runs after Chromium installation; pure persistence checks remain in the direct suite.
- [x] Web adapter uses IndexedDB blobs for original/thumbnail persistence and canvas resizing. Await transaction completion, handle unavailable storage explicitly, release generated object URLs, and remain inert during static export.
- [x] Picker supports native library/camera, image-only selection, camera permission on demand, cancellation, optional avatar crop, and web file input via Expo ImagePicker. Native camera needs hardware; no web camera parity claim. Denied/canceled selection must not write metadata.
- [x] Add provider and resolved image component. Read/import failures show recovery or unavailable state; failed mutations preserve editable source data in the caller.
- [x] Run focused tests and strict TypeScript, self-review, commit only task files, and return report. Do not alter app routes, providers, package/config, or the Profile screen.

## Task 3: Profile sections and navigation

**Files:** Create `src/app/(tabs)/profile.tsx`, `src/profile/profile-screen.tsx`, `profile-controls.tsx`, `profile-identity.tsx`, `profile-streak.tsx`, `workout-chart.tsx`, `profile-goals.tsx`, `section-editing.ts`, `profile-editor.tsx`, `progress-photos.tsx`, `photo-editor.tsx`, `photo-comparison.tsx`, `water-goal-editor.tsx`; create `tests/profile-section-editing.test.ts`, `tests/profile.browser.mjs`. Modify `src/app/(tabs)/_layout.tsx` and `src/components/app-header.tsx`; update `tests/profile-menu.browser.mjs` for the new Profile destination.

**Consumes:** Task 1/2 contracts, existing profile/activity providers, `useSelectedDay().today`, existing Question/validation/calorie-change functions, shared panels/buttons/delete confirmation.

**Produces:** A working hidden `/profile` tab route and focused Personal journal UI with no extra bottom-tab destination.

- [x] Write failing browser scenarios for Profile-menu navigation from a historical Home date; four bottom tabs; no Profile calendar; returning to the original selected date; section changes; real streak/chart totals; Goals showing today; and direct section editing. Add focused edit tests that prevent unrelated-current-answer overwrites and preserve estimator/teen transitions.
- [x] Reuse the current saved answers at Save time. Apply only the active section's draft through existing calorie-change/validation behavior. Keep the form and fields after errors; use Save/Cancel; Settings/onboarding remains compatible.

```ts
type ProfileEditSection = "name"|"age"|"body"|"goal"|"activity"|"calories";
function editedProfileAnswers(current: Answers, draft: Answers, section: ProfileEditSection): Answers;
// If current weight changed elsewhere while Name was open, a Name save keeps that weight.
assert.equal(editedProfileAnswers({...saved,weight:"81"},{...saved,name:"New name"},"name").weight,"81");
```

- [x] Build a centered avatar/name/goal/activity header and Overview/Goals/Photos controls with accessible selected state. Use actual app typography and touch targets rather than copying the tiny desktop comparison sizes.
- [x] Overview gates streak on all source readiness; shows seven chronological local dates, graph, a today's-nutrition link to Goals, and recent photos with Photos navigation. Each source failure has its own retry action without hiding unrelated usable sections.
- [x] Graph uses react-native-svg, themed colors, labelled left/right series, truthful empty/missing states, and text data access. Support tap/select of points with dates/units and avoid implying measurements between missing data. Controls select metric/range/exercise without changing workout records.
- [x] Goals reuses `interpretDayActivity` for today and existing target functions. Show unset/zero/over-goal values correctly, inline nutrition/personal editors, and an editable water goal through existing water persistence.
- [x] Photos shows dated real images/notes, Add from library/camera, editable date/note, replace/remove with confirmation, and exactly-two selection for comparison. Use contain-fit for comparison and return to the gallery after dismissal. Failed picker/save/remove actions keep data and drafts; show pending state and prevent double submissions.
- [x] Wrap tabs/header with one `ProfileMediaProvider`, register Profile with `href:null`, and route the menu's Profile entry to `/profile`. On Profile, show a back action/title instead of calendar controls; preserve the previous tab and selected day. Shared avatar uses saved media or initials, with recoverable media errors.
- [x] Run focused direct/browser tests and strict TypeScript, inspect light/dark layouts at 320/390/tablet/desktop widths with T3 preview tools, self-review, commit only task files, and return report.

## Task 4: Verification, review, and documentation

**Files:** Update README.md, PRODUCT.md, CONTEXT.md, TODO.md, DESIGN.md, design/README.md, this plan and the approved spec as appropriate. Review all feature files.

- [x] Run `npm run check`, unused-code TypeScript, relevant browser tests, then the full browser suite once source/config is stable. Record exact failures and repair the responsible code/test assumptions.
- [x] Run Expo Doctor and web/iOS/Android bundle exports. Check generated camera/photo permission configuration does not introduce microphone access.
- [x] Independently review the whole feature for persistence races, owned-file cleanup, chart honesty, stale section edits, navigation, and accessibility. Fix material findings and recheck only affected behavior before final verification.
- [x] Check available native device/emulator support with Expo Go before attempting new binary builds. Verify camera/library/durable reopen where accessible; state any native checks that remain for hardware rather than treating web or export evidence as native interaction proof.
- [x] Record the selected Personal journal design and actual behavior in product/domain/readme/design docs. Mark implementation done separately from native photo acceptance.
- [x] Keep user-authorized prototype/reference artifacts outside production routes. Report the feature branch, verification evidence, preview URL, and any material remaining device limitation. No remote operations.

## Completion evidence

Implemented on `feat/profile-personal-journal`, final source `d85ba65`. All 558
direct tests and 136 browser scenarios passed, including the unchanged calendar
regression and new Back coverage. Strict/unused-code TypeScript, Expo Doctor
21/21, and web/iOS/Android exports passed. Independent final review and scoped
fix review are clean. Android emulator photo and Back acceptance passed; the
new physical-iPhone photo flow remains a separate TODO.

See [the verification record](../reviews/2026-10-04-profile-personal-journal.md)
for commands, native limits, review corrections, and every implementation ruling.
The branch and checkout are kept locally; no remote operations were performed.

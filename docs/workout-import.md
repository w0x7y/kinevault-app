# Workout import

Track imports a workout plan shared from [Tracked](https://www.tracked.gg/) as a saved workout template, not a workout log. Share links look like `https://app.tracked.gg/v/workout/<uuid>`.

## Flow

Exercise tab → **Import workouts** → pick a source → paste the link → **Get workout** → preview → **Import workout** → **Open saved workouts** or **Done**.

**Import workouts** shows below the day's workouts when no panel is open, nothing is being searched and no workout is active. **Get workout** and the keyboard's Go key are disabled offline.

`/exercise?workoutImport=tracked` opens the panel with Tracked selected. Any other value opens the source list. The panel is the Exercise tab's `import` `WorkoutView`, so opening it saves pending workout edits.

## Reading the page

Tracked has no public API, so Track parses the public share page. With the header `RSC: 1`, `app.tracked.gg` returns the React Server Components payload; the fallback is the same payload in the HTML page's `self.__next_f.push` scripts. A missing workout returns HTTP 200 with "This workout isn't available". None of this is documented, so it can change.

`src/exercise/import/tracked-page.ts` parses it on the device, on every platform. It handles both page layouts:

| Field    | Older pages                                                    | Table pages (since 2026-10-19)              |
| -------- | -------------------------------------------------------------- | ------------------------------------------- |
| Name     | Nearest `h1` above the first exercise, else `og:title`         | Same                                        |
| Category | The `span` after the `h1`                                      | Not read                                    |
| Label    | Matches `^\d{1,3}[A-Z]$`, such as `1A`. B and C mark supersets | The row's first cell                        |
| Exercise | The first `p` in the block                                     | The link to `/v/exercise/<uuid>`            |
| Chips    | `span`s such as `Sets 1`, `Reps 1-3`, `RIR 0-1`, `Rest 3 min`  | One cell per header column; `—` means empty |

`Sets`, `Reps`, `RIR` and `Rest` become fields. Other chips, and `Sets` values that aren't a whole number from 0 to 100, stay as text in `otherChips`. Exercises are sorted by label.

If imports break, check that these still hold: `RSC: 1` returns server-rendered elements, labels are `<number><letter>` leaf elements, the header has cells reading exactly `Sets` and `Exercise`, and names are `/v/exercise/` links or the first `p`.

The page is untrusted input. Parsing stops at 2,000,000 characters or 2 MB, 20,000 rows, 300,000 nodes, element depth 256, JSON nesting 512 (checked before `JSON.parse`), 100 exercises, 400-character names and 20 chips of 100 characters. Each row expands once, and nothing is evaluated.

| Error kind                        | When                                                                  |
| --------------------------------- | --------------------------------------------------------------------- |
| `invalid-link`                    | The pasted text has no `https://app.tracked.gg/v/workout/<uuid>` link |
| `not-found`                       | HTTP 404/410, or no exercises plus "isn't available" text             |
| `unrecognized`                    | No exercises, no name, malformed rows, or a redirect off Tracked      |
| `too-large`                       | Over 2 MB, over 100 exercises, or too many rows/nodes                 |
| `network`, `timeout`, `cancelled` | Download failures                                                     |
| `signed-out`                      | Web only: no signed-in session, or the function rejected it           |
| `unsupported`                     | Web only: no Supabase settings, or the function isn't deployed        |

## Download

`tracked-download.ts` holds the shared steps: a timeout per request, cancellation, the 2 MB size check, parsing, and one retry with the HTML page if the payload can't be read.

On iOS and Android, `tracked-fetch.ts` builds the URL from the validated UUID, so only `https://app.tracked.gg` is requested. It sends `GET` with `RSC: 1` and `credentials: "omit"`, rejects redirects to other hosts, times out after 15 seconds and rejects bodies over 2 MB. Tracked receives only the workout ID.

### Web

Tracked sends no CORS headers, so on web `tracked-fetch.web.ts` gets the page through the `tracked-workout` Edge Function (`supabase/functions/tracked-workout/`) and parses it in the browser. Link import needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Without them, the panel points to the iOS and Android app. To deploy, see [Supabase setup](supabase-setup.md#edge-functions).

```
POST <Supabase URL>/functions/v1/tracked-workout
Authorization: Bearer <session access token>
apikey: <publishable key>

{"workoutId": "<uuid>", "format": "flight" | "html"}
```

The function requires a signed-in user through `getUser`, since `verify_jwt` alone also passes the anon key. It accepts only `POST` with exactly those two keys in at most 512 bytes, and builds the Tracked URL itself. It sends no cookies, follows at most 3 redirects within `https://app.tracked.gg`, waits 15 seconds, streams at most 2 MiB and passes on only `text/x-component` and `text/html`. It logs and stores nothing, and replies with `Cache-Control: no-store`.

Replies are JSON with `"service": "tracked-workout"`:

| Status   | Body                                                      | Error kind in the app                  |
| -------- | --------------------------------------------------------- | -------------------------------------- |
| 200      | `format` (`flight` or `html`) and `text`, the page        | None; the page is parsed               |
| 404      | `error: "workout-unavailable"` (Tracked answered 404/410) | `not-found`                            |
| 502      | `error: "tracked-error"`, `"unrecognized"`, `"too-large"` | `network`, `unrecognized`, `too-large` |
| 504      | `error: "timeout"`                                        | `timeout`                              |
| 401      | `error: "unauthenticated"`                                | `signed-out`                           |
| 400, 413 | `error: "invalid-request"`, `"request-too-large"`         | `network`, with a generic message      |
| 503      | `error: "auth-unavailable"`                               | `network`, with a generic message      |

A reply without `service` comes from Supabase. A 401 means the platform rejected the token (`signed-out`), and a 404 means the function isn't deployed (`unsupported`). In a browser that 404 has no CORS headers, so it looks like a lost connection. The browser waits 20 seconds, so the function's 15-second timeout answers first.

## Saving

`mapping.ts` turns the plan into a `WorkoutTemplate` with the ID `tracked-<workout uuid>`:

- Exercises keep label order, with supersets flattened. The category isn't stored.
- A name that matches an existing definition, ignoring case, width variants and extra spaces, reuses it unchanged.
- A new definition tracks `sides` if its name contains "Unilateral", else `single`. Its equipment is the first name keyword found: Smith (smith machine), kettlebell, dumbbell, barbell, cable, band, machine. Its notes hold the prescription without sets.
- The set count comes from the Sets chip, else 3. Tracked lists each side as a set, so a `sides` "Unilateral" exercise gets half, rounded up.
- A repeated name is kept once, at its first position, with its set counts added up, capped at 100.

Importing the same link again offers **Replace workout**, which overwrites the template, including edits made in Track, and keeps its position. Workout logs keep their own snapshots, and no exercises are duplicated.

The import is one durable write through `importWorkoutPlan`. It's blocked when the library would pass 10,000 exercise definitions, when there are already 10,000 saved workouts and this isn't a replacement, or while the exercise document has an unresolved cloud conflict. An import saves on the device while offline and syncs later.

## Adding a source

Add an entry to `src/exercise/import/sources.ts` with a label, help text, input label and a `load(text, signal)` that returns an `ImportedWorkoutPlan`. Keep the parsing pure and platform-neutral like `tracked-page.ts`. Mapping, preview, limits and UI are shared.

## Tests

`tests/workout-import.test.ts`, `tests/workout-import-flow.test.ts`, `tests/tracked-workout-function.test.ts` (the Edge Function), `tests/edge-request.test.ts` and `tests/workout-import-web.test.ts` (the web transport against the real handler).

The fixtures in `tests/fixtures/` are scrubbed real responses: `tracked-workout.rsc.txt` (2026-10-12), `tracked-workout-table.rsc.txt` (the 2026-10-19 table layout, which must parse to the same exercises) and `tracked-missing.rsc.txt` (an unknown ID).

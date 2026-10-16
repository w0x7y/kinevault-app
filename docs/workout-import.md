# Workout import

Track can import a workout plan that someone shared from another app. Tracked
(https://www.tracked.gg/) is the first source. Its share links look like
`https://app.tracked.gg/v/workout/<uuid>`. An imported plan becomes a saved
workout template. No workout log is created.

## How Tracked shares a workout

Tracked has no public API. Its privacy policy mentions a JSON export in App
Settings, but that format isn't documented, so Track uses share links instead.
Tracked's sign-in MCP connector only returns training summaries and isn't used.

A share link opens a public Next.js page. With the request header `RSC: 1`,
`app.tracked.gg` returns the page's React Server Components payload
(`text/x-component`). The normal HTML response embeds the same payload in
`self.__next_f.push([1, "…"])` scripts. An unknown or deleted workout still
returns HTTP 200, with the heading "This workout isn't available". These details
come from requests made on 2026-10-12. Tracked doesn't document them and can
change them at any time.

On the page:

- `h1` is the workout name. The `span` after it is the category, such as
  "full body". "Shared by @…" and the sharer's avatar are ignored.
- Exercise groups and the exercises inside them are elements keyed by UUIDs.
  Each exercise has a position label such as `1A`. B and C after the group
  number mark a superset.
- The exercise name is a `p` shown with CSS `capitalize`. Its raw text can be
  lowercase or end with spaces.
- Prescription chips are `span`s such as `Sets 1`, `Reps 1-3`, `RIR 0-1`,
  `Rest 30 sec` and `Rest 3 min`. Some exercises have none.

## Parser

`src/exercise/import/tracked-page.ts` is a pure module with no platform imports.
It runs on the device on every platform. On web the server only relays the page. It reads flight rows (`<hex id>:<json>`,
plus length-prefixed `T` text rows), starts from row `0`, and follows lazy
references (`"$L<id>"`) through rendered `children` only. That skips the
not-found and loading screens that the layout also ships. Nothing depends on
Tailwind class names. Instead the parser looks for:

- position labels matching `^\d{1,3}[A-Z]$`;
- the smallest ancestor of a label that holds a named `p` (the exercise);
- the nearest UUID-keyed ancestor that holds only that label (the exercise ID);
- `span` chips inside the exercise. `Sets`, `Reps`, `RIR` and `Rest` get fields.
  Any other chip, a repeated chip, or a `Sets` value that isn't a whole number
  from 0 to 100 (such as `Sets 3-4`) is kept as text in `otherChips`;
- the nearest `h1` above the first exercise. `og:title` is the fallback name.

Exercises are ordered by label (group number, then letter). Names get the page's
`capitalize` treatment, collapse repeated spaces and lose surrounding spaces.

Typed errors:

| Kind                              | When                                                                  |
| --------------------------------- | --------------------------------------------------------------------- |
| `invalid-link`                    | The pasted text has no `https://app.tracked.gg/v/workout/<uuid>` link |
| `not-found`                       | HTTP 404/410, or no exercises plus "isn't available" text             |
| `unrecognized`                    | No exercises, no name, malformed rows, or a redirect off Tracked      |
| `too-large`                       | Over 2 MB, over 100 exercises, or too many rows/nodes                 |
| `network`, `timeout`, `cancelled` | Download failures                                                     |
| `signed-out`                      | Web only: no signed-in session, or the function rejected it           |
| `unsupported`                     | Web only: no Supabase settings, or the function isn't deployed        |

The page is untrusted input. Limits: 2,000,000 characters and 2 MB, 20,000
rows, 300,000 tree nodes, element depth 256, JSON nesting 512 (checked before
`JSON.parse`), 100 exercises, 400-character names, 20 chips of 100 characters
each. Each row expands at most once, so cyclic or fan-out references can't loop
or multiply work. Row IDs are read from at most 9 characters, so lines without
an ID aren't rescanned. Text facts are computed once while the tree is built,
and each text read stops at its character budget. Parsing time therefore grows
with page size, not with page size times nesting depth. Properties are read
with `Object.hasOwn`, and nothing is evaluated.

### Assumptions to recheck if imports start failing

- `RSC: 1` keeps returning the flight payload, and exercise content stays
  server-rendered as elements rather than client-component props.
- Position labels keep the `<number><letter>` format and stay leaf elements.
- The exercise name stays the first `p` in the exercise block, and chips stay `span`s.
- Superset letters (B, C…) weren't in the captured sample. They're handled
  through the label pattern and ordering.

## Download

`tracked-download.ts` holds the steps both builds share: a timeout per request,
cancellation, the 2 MB UTF-8 size check, parsing, and the fallback. If the
flight payload can't be read, the HTML page is requested once and its embedded
payload is parsed instead. Each build supplies a transport that gets one page.

`tracked-fetch.ts` runs on iOS and Android. It rebuilds the URL from the
validated UUID, so only `https://app.tracked.gg` is requested, with
`credentials: "omit"`. It sends `GET` with `RSC: 1`. A response from another
host after a redirect is rejected. Each request has a 15-second timeout and can
be canceled, and responses over 2 MB are rejected by `Content-Length` and then
by UTF-8 size. Native fetch buffers the whole body before the size check, so the
timeout also bounds a slow, oversized response.

The request sends only the workout ID to Tracked. No account data is attached.

### Web

Tracked sends no CORS headers, so a browser can't read these pages. On web,
`tracked-fetch.web.ts` asks KineVault's `tracked-workout` Supabase Edge Function
(`supabase/functions/tracked-workout/`) for the page, through
`tracked-relay.ts`. Parsing still happens in the browser. Link import is offered
when `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are
set. Without them the panel says it works in the iOS and Android app.

The browser sends `POST <Supabase URL>/functions/v1/tracked-workout` with the
session's access token as `Authorization: Bearer`, the publishable key as
`apikey`, and the body `{"workoutId": "<uuid>", "format": "flight" | "html"}`.
The function:

- answers CORS preflight and accepts only `POST`;
- checks the token with Supabase Auth `getUser`. The platform's `verify_jwt`
  check runs first, but it also accepts the project's public anon key, so this
  check is what requires a signed-in user;
- reads at most 512 bytes of body, accepts exactly those two keys, and requires
  a UUID like the app's link reader does;
- builds `https://app.tracked.gg/v/workout/<uuid>` itself. The browser can't
  supply a URL or host;
- sends the same headers as native, without cookies, and with
  `redirect: "manual"`. It follows at most 3 redirects, each only if it stays on
  `https://app.tracked.gg`;
- gives Tracked 15 seconds, streams at most 2 MiB, and passes on only
  `text/x-component` and `text/html` responses;
- logs and stores nothing. Replies are `Cache-Control: no-store`.

Every reply is JSON with `"service": "tracked-workout"`:

| Status   | Body                                                      | Error kind in the app                  |
| -------- | --------------------------------------------------------- | -------------------------------------- |
| 200      | `format` (`flight` or `html`) and `text`, the page        | None; the page is parsed               |
| 404      | `error: "workout-unavailable"` (Tracked answered 404/410) | `not-found`                            |
| 502      | `error: "tracked-error"`, `"unrecognized"`, `"too-large"` | `network`, `unrecognized`, `too-large` |
| 504      | `error: "timeout"`                                        | `timeout`                              |
| 401      | `error: "unauthenticated"`                                | `signed-out`                           |
| 400, 413 | `error: "invalid-request"`, `"request-too-large"`         | `network`, with a generic message      |
| 503      | `error: "auth-unavailable"`                               | `network`, with a generic message      |

The `service` field tells the function's replies from Supabase's own. Without it,
a 401 is the platform rejecting the session token (`signed-out`), and a 404 is
the platform saying the function doesn't exist (`unsupported`: "Importing from a
link isn't set up for the web yet."). In a browser, that platform 404 has no CORS
headers, so it arrives as a failed request, like a lost connection. The message
for a failed request covers both: check the connection, or use the iOS or
Android app. The browser waits 20 seconds, so the function's own 15-second limit
answers first. To deploy the function, see
[Supabase setup](supabase-setup.md#edge-functions).

## Mapping into the exercise library

`mapping.ts` maps the platform-neutral `ImportedWorkoutPlan` into a
`WorkoutTemplate`:

- Template ID: `tracked-<workout uuid>` (44 characters). Name: the workout name.
- Exercises follow label order, with supersets flattened. An exercise that
  matches an existing Exercise definition by name reuses it. Matching ignores
  case, Unicode width variants and repeated spaces. The template keeps a
  snapshot of that definition, and its notes and tracking aren't changed.
- Other exercises become new definitions:
  - tracking is `sides` when the name contains "Unilateral", else `single`. The
    preview marks these as New · Left and right;
  - equipment comes from the first name keyword found: Smith → smith machine,
    then kettlebell, dumbbell, barbell, cable, band, machine. Otherwise it's empty;
  - muscle group is empty;
  - notes hold the prescription without sets, e.g. `Reps 5-8 · RIR 0-1 · Rest 3 min`.
- `setCounts` are keyed by exercise definition ID. The Sets chip gives the
  count. Without one the count is 3, the default for new templates.
- When the same exercise name appears more than once, the template keeps it once
  at its first position. Its count is the sum of the known Sets values (3 if none
  are known), capped at 100. The preview says so.

The category isn't stored. The template has no field for it, and the persisted
schema is unchanged.

### Importing the same link again

The deterministic template ID finds the earlier import. The preview says
"You imported this workout before" and the button becomes **Replace workout**.
Replacing updates that template's name, exercises and set counts from Tracked
and keeps its position. Existing workout logs keep their own exercise snapshots.
Exercises created by the first import now match by name, so none are duplicated.
A template renamed or edited in Track is overwritten. A deleted template is
created again.

### Limits

The import commits through the Exercise persistence's `importWorkoutPlan` as one durable
write: new definitions plus the template. It goes through the same queue,
document parse and account storage path as other exercise edits. The plan
maps against the latest saved document when its turn comes. The import is
blocked, with a message in the preview, when:

- the library would exceed 10,000 exercise definitions;
- there are already 10,000 saved workouts and the import isn't a replacement;
- the exercise document has an unresolved cloud conflict. The user chooses a
  copy in Settings first.

Offline import still saves on the device and syncs later. Getting the workout
needs a connection, so Get workout is disabled while offline.

## Flow

Exercise tab → **Import workouts**, below the day's workouts when no panel is
open and nothing is being searched → choose a source (a list, with Tracked
first) → paste the link → **Get workout** (with Cancel while loading) → preview: name, category, exercise count,
new-to-library count, each exercise with its label, chips and a New / In your
library marker, plus notes on Unilateral exercises and repeated names →
**Import workout** or **Replace workout** → confirmation with **Open saved
workouts** or **Done**.

The panel is part of the Exercise tab's panel system (`WorkoutView` kind
`import`). Opening it saves pending workout edits like any other panel.
`/exercise?workoutImport=tracked` opens it with Tracked selected, for shortcuts
such as Settings. Any other value opens the source list. If an import panel is
already open, the link is consumed and the open import keeps its link, preview
or pending save. The keyboard's Go key follows the same offline and empty-link
rules as Get workout.

## Adding a source

Add an entry to `src/exercise/import/sources.ts` with its label, help text,
input label and a `load(text, signal)` that returns an `ImportedWorkoutPlan`.
Keep the parsing pure and platform-neutral like `tracked-page.ts`. The mapping,
preview, limits and UI are shared.

## Verification

`tests/workout-import.test.ts` and `tests/workout-import-flow.test.ts` cover link
extraction, the captured page, the HTML fallback, the unavailable page, varied and
hostile payloads, mapping, re-import, repeated names, limits, one-write
persistence and the download errors. `tests/tracked-workout-function.test.ts`
covers the Edge Function: sign-in, request validation, the server-built URL,
redirects, Tracked's errors, content types, size and time limits, and that it
logs nothing. `tests/edge-request.test.ts` covers the request checks it shares
with `delete-account`. `tests/workout-import-web.test.ts` covers the web
transport, including the not-deployed and missing-workout replies, and runs it against the
function's handler. `tests/fixtures/tracked-workout.rsc.txt` is
the real 2026-10-12 response for the example link above. The sharer's username
and avatar URL are replaced and SVG path data is shortened. Rows, keys and
nesting are unchanged. `tests/fixtures/tracked-missing.rsc.txt` is Tracked's
response for an unknown ID.

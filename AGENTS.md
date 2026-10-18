# KineVault Track: working notes

KineVault Track is the Expo app in this repository (Expo SDK 57, React Native 0.86,
Expo Router, Reanimated 4.5, Supabase accounts). It runs on iOS, Android and a web
preview. The sibling `KineVault/` folder is a separate studio project; don't edit it
from here.

## Read first

- [README.md](README.md): features, setup and scripts.
- [docs/architecture.md](docs/architecture.md): module ownership and the shared controls.
- [CONTEXT.md](CONTEXT.md): domain terms. Use these names in code and docs.
- [DESIGN.md](DESIGN.md) and [docs/redesign-2026-10.md](docs/redesign-2026-10.md): the
  current look. The redesign notes win where the two disagree.
- [TODO.md](TODO.md): open work and release blockers.

Files under `docs/superpowers/`, `docs/research/` and the dated `docs/final-check*.md`
reports are records of earlier work. Don't update them to match today's code.

## Commands

- `npm run check`: lint, Prettier, TypeScript and unit tests. CI runs it on every push.
- `npm test`: unit and script tests only (`node --test` with type stripping,
  `tests/*.test.ts` and `scripts/*.test.mjs`).
- `npm run test:browser`: Playwright tests in `tests/*.browser.mjs`. They need the web
  app at `http://localhost:8081` (`npx expo start --web --port 8081`) or at
  `KINE_PREVIEW_URL`. Contexts default to reduced motion.
- `npm run start:cloudflare`: Expo Go over a Cloudflare tunnel. Anyone with the URL can
  load the bundle and its source maps, so stop it when you're done.
- Node 24 (`.nvmrc`).

## Code conventions

- Build UI from the shared controls in `src/components` (Tappable, AppButton,
  IconButton, DeleteButton, SegmentedControl, Chip, TextField, InlineMessage,
  LoadFailure, ModalSheet, popover, SheetPage, IconWell, ViewHeader, Stepper). Don't add
  another pressable, field or sheet; extend the shared one. `docs/architecture.md` lists
  the few places a raw `Pressable` is allowed.
- Colors, spacing, radii and fonts come from `src/theme/tokens.ts`.
- Reanimated on native needs `cubicBezier()` easing objects. A CSS timing string such as
  `"cubic-bezier(...)"` works on web and crashes on a phone. Use the curves in
  `src/components/motion.tsx`.
- Every account-synced document is registered in `src/account/tracking-documents.ts`
  with its storage key and parser. A storage key is written in one place only; changing
  one orphans saved user data.
- Data providers come from `createDocumentProvider` (`src/persistence/document-provider.tsx`).
  Screen logic for Food and Exercise lives in `src/food/tab-view.ts` and
  `src/exercise/tab-view.ts`, which have unit tests.
- Keep accessibility intact: roles, labels, `invalid` and `checked` states, 44pt
  targets and the keyboard focus ring.
- Bug fixes and behavior changes get a test that fails without the change.
- Write US English in code, UI text and docs.

## Before you hand work back

Run `npm run check`. For UI changes, also run the browser suite against a running web
server. The web build is not a phone: say so when a change hasn't been tried on a device.

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->

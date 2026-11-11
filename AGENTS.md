# KineVault Track: working notes

The Expo app in this repo: Expo SDK 58, React Native 0.88, Expo Router, Reanimated 4.7 and Supabase accounts. It runs on iOS, Android and a web preview. Don't edit the sibling `KineVault/` folder; it's a separate project.

## Read first

- [README.md](README.md): features, setup and scripts.
- [docs/architecture.md](docs/architecture.md): which module owns what, and the shared controls.
- [CONTEXT.md](CONTEXT.md): domain terms. Use these names in code and docs.
- [DESIGN.md](DESIGN.md) and [docs/redesign-2026-10.md](docs/redesign-2026-10.md): the current look. The redesign notes win when they disagree.
- [TODO.md](TODO.md): open work and release blockers.

These are records of past work. Don't update them to match the code: `docs/superpowers/`, `docs/research/`, the dated `docs/final-check*.md` reports and `docs/button-layout-review-2026-10-09.md`.

## Commands

- Use Node 24 (`.nvmrc`).
- `npm run check`: lint, Prettier, TypeScript and unit tests. CI runs it on every push.
- `npm test`: unit and script tests only (`tests/*.test.ts`, `scripts/*.test.mjs`).
- `npm run test:browser`: Playwright tests in `tests/*.browser.mjs`. They need the web app at `http://localhost:8081` (`npx expo start --web --port 8081`) or at `KINE_PREVIEW_URL`, and run with reduced motion by default.
- A running dev server can serve a stale bundle after edits. Restart it with `npx expo start --web --port 8081 --clear` before a browser run.
- `npm run start:cloudflare`: Expo Go over a Cloudflare tunnel. Anyone with the URL can load the bundle and its source maps, so stop it when you're done.
- Android release `.apk`: run the manual `Android release build` workflow, optionally named (`gh workflow run android-release-build.yml -f name=2026-10-20`). See [docs/android-apk.md](docs/android-apk.md).

## Code conventions

- Build UI from the shared controls in `src/components`: Tappable, AppButton, IconButton, DeleteButton, SegmentedControl, Chip, TextField, InlineMessage, LoadFailure, ModalSheet, popover, SheetPage, IconWell, ViewHeader, Stepper and ResultPager. Extend one instead of adding another pressable, field or sheet. [Shared controls](docs/architecture.md#shared-controls) lists where a raw `Pressable` is allowed.
- Colors, spacing, radii and fonts come from `src/theme/tokens.ts`.
- Reanimated on native needs `cubicBezier()` easing objects. A CSS string such as `"cubic-bezier(...)"` works on web and crashes on a phone. Use the curves in `src/components/motion.tsx`.
- Register every account-synced document in `src/account/tracking-documents.ts` with its storage key and parser. Write each storage key in one place only. Changing a key orphans saved user data.
- Older app builds reject values they don't know (a new tracking mode) and drop fields they don't know (RIR) when they re-save. Add every new document field or value to TODO.md as a rollout step.
- Data providers come from `createDocumentProvider` (`src/persistence/document-provider.tsx`).
- Food and Exercise screen logic lives in `src/food/tab-view.ts` and `src/exercise/tab-view.ts`, which have unit tests.
- Keep accessibility intact: roles, labels, `invalid` and `checked` states, 44pt targets and the keyboard focus ring.
- Bug fixes and behavior changes need a test that fails without the change.
- Write US English in code, UI text and docs.

## Before you hand work back

- Run `npm run check`.
- For UI changes, also run the browser suite against a running web server.
- The web build isn't a phone. Say so when a change hasn't been tried on a device.


# Home water/profile and architecture final check

Date: October 2, 2026. Comparison base: `39b0190`, inferred from this session's
feature baseline. Reviewed the complete current working tree against that base,
including all 47 changed and relevant untracked files. The index was unchanged.

## Result

No confirmed actionable source, behavior, accessibility-contract, documentation,
or dead-code findings were found. No source fixes, removals, dependency changes,
or staged changes were necessary. This review record is the only added file.

Separate read-only reviews covered the UI, architecture, and documentation/tests.
The final-check controller also performed the repository security pass and fresh
verification. Existing Home water/profile and architecture review records remain
accurate dated records and were preserved.

## Remaining dependency findings

These are confirmed installed vulnerable dependencies, not demonstrated
application exploits. The audit has seven affected entries (four high, three
moderate) in two advisory chains; no critical entry was reported.

1. **High: `node-forge` 1.4.0 through Expo tooling.** The current
   [RSA signature-verification advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
   affects versions through 1.4.0 and lists no patched release. The registry also
   reports 1.4.0 as the latest version. Expo code-signing tooling calls the
   affected certificate/signature verifier. App source does not import it and no
   update-signing configuration is enabled. That does not establish tooling
   safety. Next action: adopt a supported Expo/toolchain update or reviewed
   upstream fix when available; the audit's suggested Expo 44 downgrade is
   incompatible with SDK 57.
2. **Moderate: `decode-uri-component` 0.2.2 through `query-string` 7.1.3 and
   Expo Router 57.0.24.** The
   [malformed-input denial-of-service advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
   is fixed in decoder 0.5.0, which uses ESM. A fresh isolated package-manager
   compatibility probe showed that overriding only the decoder breaks a normal
   `name=hello%20world` parse with `decodeComponent is not a function`. Upgrading
   query-string to current 9.5.1 exposes parse/stringify under its default export,
   while Router's installed call sites use the namespace properties. Router's
   current SDK-compatible release still depends on query-string 7. The active
   Router path parser uses URL searchParams; no application exploit path to the
   vulnerable decoder was confirmed. Next action: a compatible Router update or
   separately reviewed dependency patch/migration, rather than a blind override.

Dependency compatibility probes ran in temporary projects, with scripts disabled.
The application's dependency manifests, lockfile, and installed tree were not
modified. No live exploitation, external source upload, credential rotation,
publishing, or production operation was performed.

## Repository security coverage

Inspected app entry points and routing, local profile/appearance/food/catalog/water
storage and parsing, source/provider input validation, barcode URLs, Open Food
Facts fetch/cancellation/cache/request limits, React text/link rendering, camera
permissions, shell/file/archive operations in all seven tooling scripts, CI,
app configuration, secret exclusions, and dependency resolution/audit metadata.
The app currently has no account authentication, tenant access, API server,
sessions, webhooks, or deployed backend to inspect.

The external provider origin is fixed and barcode input is constrained. Persisted
records are validated before usable publication, with fixed independent storage
keys. Scripts use argument arrays for child processes and validated ports; the
USDA archive reader reads an entry without extracting filesystem paths. CI has
read-only repository permissions and does not configure deployment secrets.

A redacted credential-pattern scan of 205 tracked/untracked text files found no
matches. All 728 lockfile dependency URLs use HTTPS at registry.npmjs.org, with
no embedded credentials. This is not proof that every secret or third-party
vulnerability is absent. Full Git history, every dependency's source, native
binary internals, and external-provider infrastructure were not audited.

## Fresh verification

- `npm run check`: TypeScript and all 431 model tests passed.
- `npx expo-doctor`: all 21 checks passed.
- `KINE_PREVIEW_URL=http://localhost:8087 node --test --test-concurrency=2 tests/*.browser.mjs`:
  all 88 browser tests passed; none failed or skipped. Test contexts and fixture
  storage were isolated from the user's live preview.
- `npx expo export --platform all --max-workers 2`: web (11 static routes), iOS,
  and Android exports passed. Metro's color-variable warning is environmental;
  no app build error occurred.
- `npm audit --json`: exit 1 for the known two dependency advisory chains above.
- Installed CLI argument-parser probe confirmed the documented repeated
  `--platform ios --platform android` selects both platforms correctly.
- `git diff --check`, `git diff --cached --check`, and whitespace checks on
  relevant untracked text files passed; the captured index diff hash matched.
- Read-only live Home inspection confirmed the accessible water label, required
  1,500 ml goal, and 48 by 60 cup. Saved browser storage's hash was unchanged.

Physical-device camera capture, native keyboard/gesture/hardware-back behavior,
text scaling and screen-reader runtime behavior were not exercised. Bundle
exports validate compilation and packaging, not those device interactions.

## Changed-file coverage

Every feature path was reviewed. Existing test files were reviewed through their
changed contracts and relevant surrounding assertions; unrelated historical
onboarding/catalog assertions were outside the UI assignment and still ran in
the full browser suite. Generated output was assessed through unchanged source
scripts, model/asset tests, and the fresh platform exports.

| Changed path | Review coverage |
| --- | --- |
| `CONTEXT.md` | documentation/tests |
| `README.md` | documentation/tests |
| `docs/superpowers/plans/2026-10-02-import-daily-persistence-depth.md` | documentation/tests |
| `docs/superpowers/reviews/2026-10-02-home-water-profile-menu-review.md` | documentation/tests |
| `docs/superpowers/reviews/2026-10-02-import-daily-persistence-depth-review.md` | documentation/tests |
| `docs/superpowers/specs/2026-10-02-import-daily-persistence-depth.md` | documentation/tests |
| `src/app/(tabs)/_layout.tsx` | UI |
| `src/app/(tabs)/exercise.tsx` | architecture |
| `src/app/(tabs)/food.tsx` | architecture |
| `src/app/(tabs)/index.tsx` | UI |
| `src/app/(tabs)/settings.tsx` | UI |
| `src/components/app-header.tsx` | UI |
| `src/components/profile-menu.tsx` | UI |
| `src/daily/activity-widgets.tsx` | UI, architecture |
| `src/daily/activity.ts` | UI, architecture |
| `src/daily/meals-widget.tsx` | architecture |
| `src/daily/model.ts` | architecture |
| `src/daily/use-day.ts` | UI, architecture |
| `src/food/custom-persistence.ts` | architecture |
| `src/food/daily-macros.tsx` | architecture |
| `src/food/log-persistence.ts` | architecture |
| `src/food/product-import-flow.ts` | architecture |
| `src/food/product-import.tsx` | architecture |
| `src/persistence/durable-write.ts` | UI, architecture |
| `src/water/entry-modal.tsx` | UI |
| `src/water/goal-cup.tsx` | UI |
| `src/water/goal-model.ts` | UI |
| `src/water/goal-persistence.ts` | UI, architecture |
| `src/water/goal-provider.tsx` | UI |
| `src/water/goal-settings.tsx` | UI |
| `src/water/model.ts` | UI |
| `src/water/persistence.ts` | UI, architecture |
| `src/water/provider.tsx` | UI |
| `tests/custom-catalog-edit.test.ts` | architecture, documentation/tests |
| `tests/custom-food.test.ts` | architecture, documentation/tests |
| `tests/custom-meal.test.ts` | architecture, documentation/tests |
| `tests/daily-activity.test.ts` | architecture, documentation/tests |
| `tests/drink-hydration.browser.mjs` | UI, documentation/tests |
| `tests/durable-write.test.ts` | architecture, documentation/tests |
| `tests/food-log.test.ts` | architecture, documentation/tests |
| `tests/onboarding.browser.mjs` | UI, documentation/tests |
| `tests/product-import-flow.test.ts` | architecture, documentation/tests |
| `tests/profile-menu.browser.mjs` | UI, documentation/tests |
| `tests/water-goal.browser.mjs` | UI, documentation/tests |
| `tests/water-goal.test.ts` | UI, architecture, documentation/tests |
| `tests/water.browser.mjs` | UI, documentation/tests |
| `tests/water.test.ts` | UI, architecture, documentation/tests |

## CI browser follow-up, October 2, 2026

The pull-request CI browser run passed 85 of 88 tests. Its three failures were
initial `page.goto` calls exceeding 10 seconds in the Drink hydration, Drinks,
and Food expansion helpers, before feature assertions ran. The same feature
tree had passed all 88 tests in push CI and in the earlier local run limited to
two browser files at a time. The browser npm script had allowed all eight files
to start concurrently, and four helpers' 10-second interaction setting also
limited navigation.

`npm run test:browser` now limits file concurrency to two. The four helpers with
10-second interaction limits set a separate 30-second navigation timeout.
Every existing assertion and ordinary interaction timeout remains unchanged;
the other suites and application source are unchanged. README documents these
runner settings. The original 47-file review and evidence above remain intact.

Fresh verification used an isolated preview on port 8088:

- `KINE_PREVIEW_URL=http://localhost:8088 npm run test:browser`: all 88 tests
  passed in 121.7 seconds, with zero failures, cancellations, skips, or todos.
- The executed npm command, running parent/child processes, and installed Node
  option parser confirmed `--test-concurrency=2` is applied as intended.
- Installed Playwright timeout resolution confirms the separate navigation
  setting takes precedence for navigation while interactions retain 10 seconds.
- A byte comparison against HEAD confirmed each helper only adds the single
  navigation setting; all other browser suites remain unchanged.
- `git diff --check` and `git diff --cached --check` passed. Nothing was staged.

Only the isolated preview was stopped. Model tests, Doctor, and platform exports
were not repeated for this harness-only change; their earlier results above
remain the feature verification record. The full local browser run verifies the
revised command, but the hosted pull-request check still requires a fresh run.

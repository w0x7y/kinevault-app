# Final review — October 5, 2026

## Current follow-up against `d30de03`

Reviewed all session changes against the current HEAD, `d30de03`: 34 changed
tracked files and six relevant new files, including the architecture refactors,
dependency patches, Auth configuration script and their tests. The index remains
unchanged. Unrelated mascot images and prompts were preserved and excluded.

| Changed subsystem | Coverage |
| --- | --- |
| Catalog (6 files) | Draft owner, food/meal forms, delete actions, persistence provider and owner tests; validation, current readiness, duplicate exclusion, failure isolation, completion delivery and durable retirement |
| Onboarding (3 files) | Flow, route focus integration and tests; inactive/reentrant actions, abandoned writes, restart, retry and late navigation |
| Profile (7 files) | Media owner, photo/identity/gallery callers, TodayNutrition and unit/browser regressions; shared busy/readiness, attempt feedback, source cleanup and replacement ownership |
| Daily and Exercise (10 files) | Canonical FoodDay/Workout interfaces, activity/widgets/macros, Exercise summary and fixtures/tests; all former interpreter consumers migrated to persisted sessions |
| Dependency fixes (7 files) | Package/lockfile, patch applicator, both patches, patch README and actual-dependency tests; clean installation, pinned versions, query API compatibility and cache restrictions |
| Auth configuration (3 files) | Configuration script/tests and setup guide; preview versus apply, project-key rejection, credential redaction, narrow PATCH and verified read-back |
| Documentation (4 files) | Domain glossary, module ownership, this review and security remediation; current behavior and historical verification counts distinguished |

No additional actionable code defects or proven dead code were found. No source
repair or removal was warranted; this follow-up updates the review record.

The repository security pass inspected account entry/callback/recovery routes,
client configuration, native encrypted and browser session storage, account-owned
providers, guest import, synchronization and remote row validation, both SQL
migrations and their RLS/grants/RPC authorization, product/barcode inputs, local
photo paths and browser file handling, command arguments, CI, static deployment
and environment configuration. Authorization belongs to the database owner
policies and RPC's `auth.uid()` check, rather than client route visibility or
user-editable metadata.

A redacted privileged-credential pattern scan covered 367 maintained text files
and found no candidates. Ignored Auth credentials remain outside Git with mode
0600. A scan of 112 web/native export files found one raw Android bytecode match;
Hermes decoding confirmed it was Supabase's standalone `sb_secret_` format-check
constant followed by unrelated string-pool bytes, not a credential. No locally
configured private credential was present in that bundle.

### Remaining findings

1. **High — upstream dependencies:** A fresh audit still reports 19 high findings
   propagated from `braces@3.0.3` and `node-forge@1.4.0`. Current npm registry
   versions and the [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and
   [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv) advisories still
   provide no patched releases. These affect Expo/Metro and certificate tooling;
   no deployed application exploit was established. Install compatible upstream
   fixes when published; forced SDK downgrades are not a remediation.
2. **Auth configuration — leaked-password protection:** A read-only
   `configure-auth.mjs --security-only` request confirmed the shared project's
   setting remains false. The earlier apply attempt returned HTTP 402, and
   [Supabase documents](https://supabase.com/docs/guides/auth/password-security)
   that protection requires Pro or above. After a plan upgrade, rerun the narrow
   apply command and verify its read-back. This review changed no remote settings
   or billing.

### Final verification and limits

- Clean `npm ci` succeeded and reapplied both dependency patches.
- TypeScript, including an additional unused-local/parameter check, passed.
- All **739 unit and script tests** passed after the clean installation.
- All **159 browser tests** passed; one optional visual export case was skipped.
- Expo Doctor passed **21/21** checks; fresh web, iOS and Android exports succeeded
  with dotenv disabled and synthetic public fixture settings.
- Tracked, staged and all six relevant untracked text whitespace checks passed.
- `npm audit` exits nonzero for the 19 high findings listed above.

Browser verification covers responsive and accessible real screens with synthetic
account transports. Native exports verify bundling, not installed-device behavior.
Live database RLS/SQL mutation tests, production email delivery, installed-device
session storage and native email links were not rerun. SQL migrations were
reviewed locally; the existing live verification remains recorded below and in
[Supabase setup](supabase-setup.md). Marketing/design artifacts received only the
credential-pattern scan, and the sibling KineVault studio was not audited.

## Earlier review against `15af756`

Compared the complete Track working tree with `15af756` (before shared accounts),
including relevant untracked sources. The Git index was left unchanged. Unrelated
mascot images and prompt files were preserved and excluded from feature review.
The sibling KineVault studio was not audited.

### Coverage

| Area | Reviewed |
| --- | --- |
| Accounts | Client configuration, encrypted/native and browser sessions, auth controller, provider, callbacks, password recovery, membership reads and settings |
| Entry and forms | Root/tab/account routing, account-owned providers, onboarding after saved review, password icon, confirmation feedback, keyboard and accessibility behavior |
| Persistence | Shared durable writes, Profile/media lifecycle, document validation, guest import, owner isolation, offline envelopes, sync revisions, conflicts, partial failure and external refresh |
| Tracking | Exercise/Food/Water provider adapters, Water goal drafts, Profile recovery, refresh notices and their callers |
| Database | Both migrations and read-only live schema inspection: all four public tables have RLS, owner predicates, restricted grants and scoped RPC; privileged signup function is private and not client-executable |
| Tooling and deployment | Package/lockfile, Expo app configuration, CI, static Vercel configuration, auth configuration script and environment example |
| Verification and docs | Changed unit/browser tests and fixtures, glossary, README/product/design documents, specs/plans, setup and earlier verification notes |

The existing security pass also inspected fixed-origin product requests, barcode
validation, cancellation/timeouts, camera cleanup, owned-photo IDs and paths,
browser IndexedDB, local command argument handling, and secret-handling patterns.
A local signature-pattern scan covered 361 maintained text files without exposing
matching values and found no credential candidates. Ignored local environments
were not included in that source scan.

### Changes from this review

- CI now provides synthetic public Supabase settings. A clean export with dotenv
  disabled and absent settings reproduced the login test failure; a fresh export
  using the CI fixture settings passed the full browser suite. HTTP fixtures
  intercept the project requests; real credentials are not required.
- Updated transitive `http-cache-semantics` from 4.2.0 to 4.3.0 through npm and
  regenerated the lockfile. This removes its reported affected-version audit
  entry, but does not establish that all unsafe cache behavior is fixed; see below.
- Integration CI exposed a development-preview server shutdown after 51 passing
  tests. Server logs confirmed JavaScript heap exhaustion; a local run with a
  1.5 GB heap reproduced it.
  Browser CI now serves the built web export and uses Metro for the widget and
  hardware-Back fixtures, retaining the complete suite. All 158 browser tests
  passed locally with this arrangement and the smaller Metro heap, and a full
  GitHub CI run also passed. A second run hit a cold development-navigation
  timeout; those fixture navigations now receive the standard 30-second allowance
  while interaction deadlines and assertions remain unchanged. Server logs are
  printed on failure.
- Ignored Supabase CLI `.temp` metadata. No maintained feature code was deleted.

### Remaining security findings

The follow-up [security remediation](security-remediation.md) records changes made
after this review. The findings and counts below describe the original audit.

1. **High dependency advisories:** Installed `braces` 3.0.3 and `node-forge` 1.4.0
   remain affected. The current advisories and npm registry list no fixed releases.
   They enter through Expo/Metro tooling and certificate tooling. No application
   exploit path was demonstrated. Track upstream fixes and update compatibly;
   do not downgrade Expo/React Native using `npm audit fix --force`.
   [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
   [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
2. **Unresolved HTTP-cache behavior:** Even 4.3.0 directly reports that private,
   no-store and no-cache responses can be reused with a large `max-stale` request.
   This was checked locally with synthetic response headers. It is outside the
   current scanner range; the scanner result alone is not a security fix. The
   dependency comes through development tunneling (`ngrok → got → cacheable-request`);
   no shared authenticated HTTP cache in the deployed app was identified. Avoid
   using this dependency for shared sensitive responses and follow the upstream
   remediation. [Cache advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp).
3. **Moderate URL-decoder dependency advisory:** Expo Router 57.0.24 uses
   `query-string` 7.1.3 and `decode-uri-component` 0.2.2. In an isolated local child,
   legitimate parsing succeeded while 800 malformed encoded bytes exceeded the
   1.5-second limit and the child was terminated. An application exploit through
   the active router was not demonstrated. Decoder 0.5.0 and query-string 9.5.1
   exist, but their module export shape is incompatible with the installed
   consumers' CommonJS/named imports. Evaluate a compatible Expo Router/SDK update;
   an override without adapting consumers would break navigation.
   [Decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
4. **Auth configuration warning:** Supabase's security advisor reports leaked
   password protection disabled. No RLS or function-privilege warnings were
   reported. Enable protection in the shared project's Auth settings before
   public release after confirming plan availability. This review did not change
   remote configuration.
   [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Final npm audit reports **22 affected packages: 19 high and 3 moderate**, originating
from three direct advisory records with downstream dependency propagation. These
are not 22 separate demonstrated application exploits. The HTTP-cache behavior
above is additional to the final scanner result.

### Final checks and limits

- TypeScript and all **705 unit tests** passed.
- Both auth configuration script tests passed.
- **158 browser tests** passed; one optional screenshot capture was skipped.
- Expo Doctor passed **21/21** checks.
- Fresh web, iOS and Android exports succeeded using synthetic CI settings with
  dotenv disabled and Metro's cache cleared.
- Tracked/staged diff whitespace checks and relevant untracked text checks passed.

Browser verification covered compact forms, keyboard focus, password visibility,
confirmation guidance, required sign-in, recovery/cancel, owner replacement,
damaged Profile recovery, offline and conflict cases, retained drafts and retries.
Native exports verify bundling; installed-device session storage and email links
were not retested. Live inspection was read-only: no live Auth users were created,
SQL mutation tests rerun, schema changed, SMTP activated, or deployment published.
Earlier live Auth/RLS verification remains documented separately. Production email
and callback setup still follows [Supabase setup](supabase-setup.md).

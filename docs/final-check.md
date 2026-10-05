# Final review — October 5, 2026

Compared the complete Track working tree with `15af756` (before shared accounts),
including relevant untracked sources. The Git index was left unchanged. Unrelated
mascot images and prompt files were preserved and excluded from feature review.
The sibling KineVault studio was not audited.

## Coverage

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

## Changes from this review

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
  Browser CI now serves the built web export and uses Metro only for the isolated
  widget fixture, retaining the complete suite. All 158 browser tests passed with
  this arrangement and the smaller Metro heap. Server logs are printed on failure.
- Ignored Supabase CLI `.temp` metadata. No maintained feature code was deleted.

## Remaining security findings

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

## Final checks and limits

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

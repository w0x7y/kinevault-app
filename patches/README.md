# Dependency security patches

`npm ci` runs `scripts/apply-dependency-patches.mjs`, using Node and Git without
additional npm dependencies. It checks package versions and patch applicability
before writing, accepts already-applied patches, and fails on unexpected files.
Install failures must be fixed; do not skip lifecycle scripts or ignore a patch
that no longer applies.

- `query-string@7.1.3` keeps Expo Router 57's CommonJS/named API and loads the
  default export from the fixed `decode-uri-component@0.5.0`. Both versions
  are pinned in npm overrides. This avoids upgrading the app to SDK 58 merely
  to fix [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
- `http-cache-semantics@4.3.0` rejects reuse of responses that cannot be stored,
  require validation, or have cookies without explicit shared-cache permission.
  Shared stale responses with `proxy-revalidate` or `s-maxage` also require
  validation. The published 4.3.0 still allows `max-stale` to bypass these
  restrictions described in [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp).
  This is a local security patch, not a published upstream fix.

`tests/dependency-security.test.ts` exercises the actual dependencies resolved by
Expo Router and cacheable-request, including serialized cache policies, malformed
URL parsing with a subprocess deadline, and ordinary permitted cache reuse.
Keep these tests when removing patches after upstream releases.

`braces@3.0.3` and `node-forge@1.4.0` still have no published fixed releases as of
2026-10-05. Their 19 propagated high audit findings remain. These patches do not
fix or suppress those advisories. Never use `npm audit fix --force` to downgrade
Expo or React Native; recheck the registries and upstream advisories for fixes.

## Expo upgrade checks

Before changing the SDK or its patch versions:

1. Run `npm ci` with lifecycle scripts enabled. An unexpected patch target must
   fail installation rather than quietly omit its security fix.
2. Run `npm run check`, including `tests/dependency-security.test.ts`, against
   the actual packages resolved by Router and the tunnel dependency.
3. Run Expo Doctor, web/iOS/Android exports, and the browser suite. URL parsing
   needs both the dependency tests and real navigation coverage.
4. Inspect `npm audit` and record remaining advisories in [TODO.md](../TODO.md).

SDK 58 is tracked in TODO.md as a separate upgrade. When its installed Router
no longer resolves query-string, remove the decoder override and adapter patch
together. Keep the URL parsing regressions and update them to exercise the new
resolved implementation. Remove the HTTP cache patch only after a published
compatible version passes the protected-cache regressions. A version outside
npm's advisory range is not proof that this behavior is fixed.

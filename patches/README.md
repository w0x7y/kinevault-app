# Dependency security patches

The `postinstall` script runs `scripts/apply-dependency-patches.mjs` after
`npm ci` or `npm install`, using Node and Git without additional npm
dependencies. It checks package versions and patch applicability before
writing, accepts already-applied patches, and fails on an unexpected package
version or a patch that no longer applies. With `--omit=dev`, ngrok and its
`http-cache-semantics` are absent, and that patch is skipped.
Install failures must be fixed; do not skip lifecycle scripts or ignore a patch
that no longer applies.

- `http-cache-semantics@4.3.0` rejects reuse of responses that cannot be stored,
  require validation, or have cookies without explicit shared-cache permission.
  Shared stale responses with `proxy-revalidate` or `s-maxage` also require
  validation. The published 4.3.0 still allows `max-stale` to bypass these
  restrictions described in [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp).
  This is a local security patch, not a published upstream fix.

npm overrides also pin `uuid@11.1.1` under `@expo/ngrok`, the tunnel tool.
`tests/tooling-dependencies.test.ts` checks that its v3 and v5 generators reject
undersized output buffers, that v4 and Xcode project identifiers still work, and
that `xcode` still has no uuid dependency. This needs no patch file.

`tests/dependency-security.test.ts` exercises the actual dependencies resolved by
Expo Router and cacheable-request, including serialized cache policies, malformed
URL parsing with a subprocess deadline, and ordinary permitted cache reuse.
Keep these tests when removing patches after upstream releases.

These patches do not fix or suppress any other advisory. As of 2026-10-28,
`node-forge` resolves to the fixed 1.4.2 and the braces advisory is withdrawn.
The zod and deepmerge findings remain; see
[security remediation](../docs/security-remediation.md#dependency-audit-2026-10-28).
Never use `npm audit fix --force` to downgrade Expo or React Native; recheck the
registries and upstream advisories for fixes.

## Expo upgrade checks

Before changing the SDK or its patch versions:

1. Run `npm ci` with lifecycle scripts enabled. An unexpected patch target must
   fail installation rather than quietly omit its security fix.
2. Run `npm run check`, including `tests/dependency-security.test.ts`, against
   the actual packages resolved by Router and the tunnel dependency.
3. Run Expo Doctor, web/iOS/Android exports, and the browser suite. URL parsing
   needs both the dependency tests and real navigation coverage.
4. Inspect `npm audit` and record remaining advisories in [TODO.md](../TODO.md).

Remove the HTTP cache patch only after a published compatible version passes
the protected-cache regressions. A version outside npm's advisory range is not
proof that this behavior is fixed.

## SDK 58 upgrade, 2026-10-29

- Expo Router 58.0.13 and later parse links with WHATWG `URL` and
  `URLSearchParams` and no longer depend on query-string. The query-string and
  decode-uri-component overrides and `query-string+7.1.3.patch` are removed.
  The first install after the upgrade failed in `postinstall` because
  `node_modules/query-string` was gone, as intended.
- The URL parsing regressions now call Router's own parser. They also check
  that Router can no longer load query-string. Malformed escapes such as `%FF`
  now become U+FFFD instead of staying as written. Parsing 800 of them still
  finishes well inside the 1.5 second deadline.
- `xcode@4.0.0`, used by Expo's config plugins, makes project identifiers with
  `crypto.randomUUID` and has no uuid dependency. Its uuid override is removed.
  The `@expo/ngrok` override stays because ngrok 4.1.3 still asks for uuid 3.
- `http-cache-semantics@4.3.0` is still the newest release. It is still reached
  through `@expo/ngrok`, got 11 and cacheable-request 7. The override and the
  local patch stay, and the protected-cache regressions pass.
- `npm audit --omit=dev` now reports 8 findings (5 low, 3 high), down from 9.
  All come from two advisories. zod
  ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5))
  stays because `@expo/cli@58.1.17` still requires zod 3 and the fix is only in
  zod 4.6.6. deepmerge
  ([GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4))
  stays because `@expo/config@58` requires deepmerge 4.3.1, the newest release.
  `node-forge` now resolves to 1.4.2.
- The full `npm audit` reports 15 findings (5 low, 3 moderate, 7 high), down
  from 16. The extra ones are dev-only: `@modelcontextprotocol/sdk`,
  body-parser, fast-uri, ip-address and qs. npm lists a fix for each without
  `--force`.

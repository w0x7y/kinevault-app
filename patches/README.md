# Dependency patches

`postinstall` runs `scripts/apply-dependency-patches.mjs` after `npm ci` or `npm install`. It checks each package version and patch before writing, accepts patches already applied, and fails on an unexpected version or a patch that no longer applies. With `--omit=dev`, ngrok is absent and its patch is skipped.

Fix a failed install. Don't skip lifecycle scripts or ignore a patch that no longer applies.

## Fixes

**`http-cache-semantics@4.3.0` patch.** It rejects reuse of responses that can't be stored, need validation, or have cookies without shared-cache permission. Shared stale responses with `proxy-revalidate` or `s-maxage` also need validation. 4.3.0 is the newest release and still lets `max-stale` skip these checks ([GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)). There is no upstream fix. It's reached through `@expo/ngrok`, got 11 and cacheable-request 7.

**`uuid@11.1.1` override under `@expo/ngrok`.** An npm override, not a patch file. ngrok 4.1.3 still asks for uuid 3.

## Tests

- `tests/dependency-security.test.ts` runs the real packages resolved by Expo Router and cacheable-request. It covers serialized cache policies, permitted cache reuse, and malformed URL parsing with a subprocess deadline (800 `%FF` escapes in under 1.5 seconds). It also checks that Router can't load query-string.
- `tests/tooling-dependencies.test.ts` checks that uuid's v3 and v5 reject undersized buffers, that v4 and Xcode project identifiers work, and that `xcode` has no uuid dependency.

Keep both when a patch is removed.

## Open advisories

The patches don't fix or hide any other advisory. `npm audit --omit=dev` reports 8 findings (5 low, 3 high) from two advisories:

| Package   | Advisory                                                                 | Why it stays                                                     |
| --------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| zod       | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | `@expo/cli@58.1.17` requires zod 3; the fix is only in zod 4.6.6 |
| deepmerge | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | `@expo/config@58` requires deepmerge 4.3.1, the newest release   |

The full `npm audit` reports 15 (5 low, 3 moderate, 7 high). The extra ones are dev-only (`@modelcontextprotocol/sdk`, body-parser, fast-uri, ip-address, qs), and npm lists a fix for each without `--force`. `node-forge` resolves to the fixed 1.4.2, and the braces advisory is withdrawn. See [security remediation](../docs/security-remediation.md#dependency-audit-2026-10-28).

Never run `npm audit fix --force`. It downgrades Expo or React Native. Check the registries and upstream advisories for fixes instead.

## Expo upgrade checks

Before changing the SDK or its patch versions:

1. Run `npm ci` with lifecycle scripts on. An unexpected patch target must fail the install, not drop its fix.
2. Run `npm run check`, including `tests/dependency-security.test.ts`.
3. Run Expo Doctor, the web, iOS and Android exports, and the browser suite. URL parsing needs both the dependency tests and real navigation.
4. Check `npm audit` and record what remains in [TODO.md](../TODO.md).

Remove the HTTP cache patch only after a published compatible version passes the protected-cache tests. Being outside npm's advisory range doesn't prove the fix.

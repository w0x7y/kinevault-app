# Security remediation

Security findings for `Application/`, starting from the [final review](final-check.md). Dates are when each was checked.

## Open

### A stolen session can pass the deletion password check

On the hosted project, `security_update_password_require_current_password` and `security_update_password_require_reauthentication` are off. Any session can set a new password with `updateUser`, then confirm `delete-account` with it, even on a Google-only account, and keep a password login. Manual identity linking is off, so a linked Google identity can't pass the Google check.

Requiring the current password fixes this for password accounts. Reauthentication would cover Google-only accounts with an emailed code, but Supabase skips it for sessions under 24 hours old. Both settings exempt recovery sessions, where Track changes passwords. `mailer_notifications_password_changed_enabled` (off) would alert the owner. The settings are shared with the other site on the project. Checked 2026-10-18; nothing changed.

### Google sign-in to a never-confirmed email account

If someone signs up with your email and never confirms it, your later "Continue with Google" links into that user. Supabase Auth's `RemoveUnconfirmedIdentities` first clears the squatter's password, identities and metadata, so it isn't a takeover. Two cases stay open:

- Turning on `mailer_autoconfirm` (off on the hosted project) makes the squatter's account confirmed and linkable.
- Clicking a confirmation email you didn't request confirms the squatter's account before Google links to it.

Checked 2026-10-18 against `supabase/auth` at `ce9a8ee`, not the live project.

### The release signing key is present while Gradle runs

`android-release-build.yml` gives the keystore and its password to `./gradlew assembleRelease`, which runs every native module's Gradle script. A compromised dependency could read the key. The fix is to build unsigned, then sign with `apksigner` in a step that runs no project code. It needs a release run to verify.

### No size caps on account data

`track_documents.payload`, `track_document_partitions.payload` and `save_track_partitioned_document` fragments have no size limit beyond the project's request limits. `profiles.display_name` is cut to 200 characters at signup, but not on later updates.

### No rate limit on `tracked-workout`

Every signed-in request fetches a Tracked page (up to 2 MiB and 3 redirects). Only the request body is capped, at 512 bytes.

### Withdrawn demos stay readable

`catalog_exercises_read` is `using (true)`, so `anon` and `authenticated` can read withdrawn rows' names, credits and media paths, and the files stay in the public `exercise-demos` bucket. A fix must keep linked rows' status readable, since the app uses it to show "Demonstration unavailable." ([exercise demos](exercise-demos.md)).

### Development tunnels are public

`npm run start:cloudflare` and `npm run start:tunnel` (ngrok) publish Metro with no authentication. Anyone with the URL gets the development bundle and source maps, with the app source and `EXPO_PUBLIC_*` values. `metro.config.cjs` keeps `.env.auth.local` and other private env files out. Don't share the URL, and stop the tunnel with Ctrl+C when done.

### Leaked-password protection needs a paid plan

```bash
node --env-file=.env.auth.local scripts/configure-auth.mjs --security-only
node --env-file=.env.auth.local scripts/configure-auth.mjs --security-only --apply
```

This sets only `password_hibp_enabled: true` and checks it with a GET. Put the Management API token in ignored `.env.auth.local` (mode 0600), never in a client variable or a commit; publishable and secret keys are rejected. Supabase answers HTTP 402 because the setting needs the Pro plan, so it's still off. See [password security](https://supabase.com/docs/guides/auth/password-security) and the [API setting](https://supabase.com/docs/reference/api/v1-update-auth-service-config).

### Smaller items

- The Edge Functions have no `deno.lock`, so each deploy resolves transitive packages such as `iceberg-js` fresh.
- On iOS and Android, `src/exercise/import/tracked-fetch.ts` reads a response without `Content-Length` in full before the size check. Only `app.tracked.gg` is read.

## Fixed

### Token-hash email links on a guest device

A token-hash confirmation or recovery link signed a never-signed-in device into the link owner's account, and `importGuest` handed that account the device's guest data. Anyone can get such a link from their own email, and any page, QR code or app can open `kinevaulttrack://auth/callback?token_hash=…`.

Every hosted email template (confirmation, invite, magic link, email change, recovery) uses `{{ .ConfirmationURL }}`, and none uses `{{ .TokenHash }}`. So since 2026-10-18 Track refuses every token-hash link, signed in or not, and the Auth port has no `verifyOtp`. Google sign-in also completes only with a PKCE code.

The friend's site has an `/auth/confirm` route for token-hash links. If the shared templates switch to one that honors `{{ .RedirectTo }}`, Track's confirmation and reset emails break until Track gets its own templates or project.

### Google-only accounts couldn't delete themselves

`delete-account` required `signInWithPassword`. Since 2026-10-18 it accepts the session's own Google sign-in from the last 10 minutes instead (`oauth` in the token's `amr` claim), and Settings offers "Sign in with Google again". See [account management](account-management.md).

### Deletion attempts weren't rate limited

Since 2026-10-18, `delete-account` allows 5 attempts per account per hour through `record_account_deletion_attempt` (migration `20261018120000_account_deletion_attempts.sql`), checked before the password. Over the limit it replies 429. If it can't record the attempt, it replies 503 and deletes nothing.

### The Tracked relay accepted anonymous sign-ins

Fixed in code on 2026-10-18. It wasn't reachable, because anonymous sign-ins are off. The deployed version 1 predates the fix; redeploy with the command in [Supabase setup](supabase-setup.md).

### Android asked to draw over other apps

Since 2026-10-18, `app.json` blocks `SYSTEM_ALERT_WINDOW` in release builds. Debug builds keep it for the development overlay.

### http-cache-semantics reused protected responses

In 4.3.0, `max-stale` could reuse private, `no-store` and `no-cache` responses, and authenticated or cookie responses without shared-cache permission. A local patch rejects those and honors `proxy-revalidate` and `s-maxage` for shared stale responses. Only ngrok development tooling uses it. The published 4.3.0 isn't fixed, so keep the patch. See [patch maintenance](../patches/README.md).

## Dependency audit (2026-10-28)

`npm audit fix`, without `--force`, changed only `package-lock.json`. `node-forge` moved from 1.4.0 to 1.4.2. Development-only packages moved to `@modelcontextprotocol/sdk` 1.32.2, `body-parser` 2.4.0, `fast-uri` 3.1.9, `ip-address` 10.7.5 and `qs` 6.17.0.

| Advisory                                                                                           | Status                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), node-forge               | Fixed. CVE-2026-85393 covers `<= 1.4.0`. 1.4.1 fixes it, and 1.4.2 fixes a PEM regression in 1.4.1                          |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), braces                   | Withdrawn 2026-10-23 as not practically exploitable. `braces@3.0.3`, through `micromatch` in `metro-file-map`, is unchanged |
| [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), zod below 4.6.6          | Open, high. Through `@expo/cli` and development-only `expo-mcp`. Fixed in zod 4.6.6                                         |
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), deepmerge 4.2.0 to 4.3.1 | Open, low. Through `@expo/config`. No fix                                                                                   |

`npm audit` now reports 10 findings (5 high, 5 low), or 8 with `--omit=dev` (3 high, 5 low), all from zod and deepmerge.

Don't run `npm audit fix --force`. It installs `expo@51.0.39` and `expo-mcp@0.3.1`. The latest `@expo/cli`, 58.1.16, still uses zod 3, so the SDK 58 upgrade alone won't clear zod. Don't hide findings or downgrade the SDK to remove them.

## Dependency audit (2026-10-05)

22 affected packages: 19 high, 3 moderate. The decoder ([GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)) was overridden to the fixed 0.5.0, with a one-line adapter keeping query-string at 7.1.3 for Expo Router. Braces and node-forge had no fix until the [2026-10-28 audit](#dependency-audit-2026-10-28).

# Security remediation, 2026-10-05

Follow-up to the [final review](final-check.md), scoped to `Application/`.

## Dependency audit

The initial audit was reproduced: 22 affected packages, 19 high and 3 moderate.
The latest stable Expo is 57.0.26 and Expo Router is 57.0.24. Router 58.0.13
removes query-string but also requires SDK 58 modules; it is not a compatible
single-package upgrade for this SDK 57 application.

The app now overrides the decoder to the published fixed version 0.5.0 and keeps
query-string at 7.1.3 with a one-line default-export adapter. Router's named
query-string API remains intact. The override and adapter apply during clean
installs. See [patch maintenance](../patches/README.md).

The follow-up audit reports 19 high findings and zero moderate findings. The
19 high findings from braces and node-forge remain unresolved. Both npm
registries still report the affected versions as latest, and both advisories
list no patched releases. Upstream fixes cannot be installed yet. Do not hide
the audit findings or downgrade the SDK to remove them.

- [Braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [Node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
- [Decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)

## HTTP cache

Reproduced unsafe reuse in http-cache-semantics 4.3.0 before modifying it.
A persistent patch now rejects protected entries before considering max-stale,
including private shared responses, no-store, no-cache, authenticated responses
without shared-cache permission, and cookie-bearing responses without explicit
permission. It also respects proxy-revalidate and s-maxage for shared stale
responses. Tests cover both live policies and restored cache entries and keep
ordinary public and non-shared private cache behavior working.

This dependency is used by ngrok development tooling. The patch fixes the
dependency's demonstrated behavior; an authenticated shared-cache exploit in the
deployed application was not established. Version 4.3.0 alone is insufficient.

## Supabase leaked-password protection

Use the existing Auth configuration script in security-only mode. It PATCHes
only `password_hibp_enabled: true` and verifies the setting with a separate GET.
It requires no Resend credentials and does not update SMTP, redirects, the Site
URL, or the project's other password rules.

```bash
node --env-file=.env.auth.local scripts/configure-auth.mjs --security-only
node --env-file=.env.auth.local scripts/configure-auth.mjs --security-only --apply
```

The Management API token belongs in ignored `.env.auth.local`, never in a public
client variable or a committed file. Supabase documents this feature as requiring
the Pro plan or above. An inaccessible or plan-restricted setting remains a
remote blocker, even when the local script passes its tests.

Remote status: the supplied Management API token was saved in ignored
`.env.auth.local` with mode 0600 and successfully read the project's settings.
The update was rejected with HTTP 402, with Supabase explaining that this feature
is available on Pro plans and above. A separate GET confirmed that
`password_hibp_enabled` remains false. The organization needs a paid plan before
the command can enable it. No billing change was made.

Project publishable and secret API keys cannot configure Auth settings; the
script rejects them before making a request.

[Password security](https://supabase.com/docs/guides/auth/password-security),
[Management API setting](https://supabase.com/docs/reference/api/v1-update-auth-service-config).

## Verification

- A clean `npm ci` applied both patches. Repeated application, a production-only
  fixture without ngrok, and failure on an unexpected package version were checked.
- TypeScript and all 722 unit tests passed, including the new security tests.
- Expo Doctor passed all 21 checks; web, iOS and Android exports succeeded.
- The browser suite passed 158 tests with one optional visual test skipped.
- Independent code review reported no actionable findings.
- `npm audit` still exits nonzero for the 19 high upstream findings above.

## Open findings, 2026-10-17

A review on 17 October 2026 recorded these. Each was checked against the code;
none was fixed then.

### Token-hash email links on a guest device

`completeAuthLink` in `src/account/controller.ts` refuses token-hash links only
while a session exists. On a device that has never signed in, a token-hash
confirmation or recovery link signs the device into the link owner's account.
`importGuest` in `src/account/storage.ts` then claims the device's guest data for
that account and marks every guest document the account doesn't already have
for upload. Anyone can take such a link from their own account's email, so a
guest who opens it hands their tracking to that account. PKCE links aren't
affected: the code only works with this device's verifier.

The fix needs a product decision: accept token-hash links only while this
device has a pending sign-up or reset request, or ask before importing guest
data into an account reached through an email link.

A review on 18 October 2026 added that the link needn't come from an email: any
web page, QR code or Android app can open `kinevaulttrack://auth/callback?token_hash=…`.
The hosted project's confirmation template uses `{{ .ConfirmationURL }}` (PKCE), so if
every template Track's users receive does too, Track could refuse token-hash links
outright. Google sign-in already completes only with a PKCE code.

Checked 18 October 2026 (read-only Management API): the confirmation, invite, magic
link, email change and recovery templates all link through `{{ .ConfirmationURL }}`;
none uses `{{ .TokenHash }}`. Track now refuses every token-hash link, signed in or
not, and the Auth port no longer has `verifyOtp`. The friend's site has an
`/auth/confirm` route for token-hash links; if the shared templates ever switch to
one that honors `{{ .RedirectTo }}`, Track's confirmation and reset emails stop
working until Track gets its own templates or project.

### Google-only accounts can't delete themselves

Found 18 October 2026, after "Continue with Google" was added. The
`delete-account` function (`supabase/functions/delete-account/handler.ts`) confirms
deletion with `signInWithPassword`, and an account created through Google has no
password, so its deletion always fails. Accounts that also have an email password
are unaffected.

Fixed and deployed on 18 October 2026: without a password, the function
accepts the caller session's own Google sign-in from the last 10 minutes (the `oauth`
entry of the access token's `amr` claim). Settings offers "Sign in with Google again"
for Google-only accounts. `reauthenticate()` wasn't used: its emailed code is only
checked by a password change, so the function couldn't verify it. See
[account management](account-management.md).

### Google sign-in to a never-confirmed email account

Checked 18 October 2026 against the Supabase Auth source (`supabase/auth` at
`ce9a8ee`), not the live project. If someone signs up with another person's email
and never confirms it, that person's later "Continue with Google" (Google reports a
verified email) links into the same user, but `RemoveUnconfirmedIdentities`
(`internal/api/external.go`, `internal/models/user.go`) first clears its password,
deletes its other identities and replaces its metadata, then confirms the email. The
squatter's password stops working, so this isn't a takeover. In the reverse order,
`signUp` for an address that already has a confirmed Google account returns an
obfuscated success and sets no password; Track recognizes that reply and says an
account with this email already exists.

Two cases stay open: turning on `mailer_autoconfirm` (off on the hosted project)
makes a squatter's password account confirmed and linkable, and a person who clicks
a confirmation email they didn't request confirms the squatter's password account
before Google links to it.

### Development tunnels are public

`npm run start:cloudflare` (`scripts/expo-cloudflare.mjs`) publishes Metro
through a Cloudflare quick tunnel. Nothing authenticates requests, so anyone
with the random `trycloudflare.com` URL can download the development bundle and
its source maps, which carry the app source and the `EXPO_PUBLIC_*` values.
`npm run start:tunnel` exposes Metro the same way through ngrok.
`metro.config.cjs` keeps `.env.auth.local` and other private env files out of
the bundle. Don't share the URL, and stop the tunnel with Ctrl+C when you're
done.

### No per-user rate limits in Edge Functions

Neither function limits how often one account can call it. `delete-account`
calls `signInWithPassword` on every request to reauthenticate, so a stolen
session can keep guessing the password. `tracked-workout` fetches a Tracked page
(up to 2 MiB and three redirects) for every signed-in request. Both cap the
request body (2,048 and 512 bytes), not the request count.

`delete-account` is limited since 18 October 2026 (deployed that day): after
authenticating the caller, it records the attempt through
`record_account_deletion_attempt` (migration `20261018120000_account_deletion_attempts.sql`)
and replies 429 once the account made 5 attempts in the past hour, before any
password check. If the database can't record the attempt, it replies 503 and deletes
nothing. `tracked-workout` still has no limit.

### No size caps on account data

`track_documents.payload` and `track_document_partitions.payload` only have to
be JSON objects, and `save_track_partitioned_document` accepts fragments of any
size. `profiles.display_name` is cut to 200 characters at signup, but the
owner's later updates have no length check. A signed-in user can store
arbitrarily large rows within the project's request limits.

### Withdrawn demos stay readable

The `catalog_exercises_read` policy uses `using (true)`, so `anon` and
`authenticated` also read withdrawn rows, including their names, credits and
media paths. The files stay in the public `exercise-demos` bucket. The app reads
withdrawn rows on purpose to show "Demonstration unavailable." (see
[exercise demos](exercise-demos.md)), so a fix must keep the status of linked
rows readable while hiding the rest.

### Dependency audit status

The review's `npm audit` still reports 19 high findings, all from the two
advisories above. `package-lock.json` resolves `node-forge@1.4.0` through
`@expo/cli@57.0.29` and `@expo/code-signing-certificates`, and `braces@3.0.3`
through `micromatch` in `metro-file-map` (Metro 0.84.5). Both run only in
development and build tooling; neither is part of the shipped bundle. The audit
was not rerun for this note.

## Findings, 2026-10-18

A repository-wide review on 18 October 2026 recorded these. The hosted settings below
were read through the Management API; none was changed.

### A stolen session can pass the deletion password check

`delete-account` deletes once `signInWithPassword` succeeds. On the hosted project
both `security_update_password_require_current_password` and
`security_update_password_require_reauthentication` are off, so any session can set a
new password with `updateUser` and then confirm deletion with it. This also works on
Google-only accounts, and it leaves the attacker a password login. Manual identity
linking is off, which stops a linked Google identity from passing the Google check.

Requiring the current password closes this for accounts that have one. A Google-only
account has none to ask for; requiring reauthentication then asks for an emailed code,
but Supabase Auth skips it for sessions created in the last 24 hours. Both settings
exempt recovery sessions, which is the only place Track changes a password.
`mailer_notifications_password_changed_enabled` (also off) would tell the owner when it
happens. These settings are shared with the other site on this project. Still open.

### The Tracked relay accepted anonymous sign-ins

`tracked-workout` checked only that `getUser` returned a user, and an anonymous
sign-in is one. Anonymous sign-ins are off on the hosted project, so this wasn't
reachable. Fixed in code on 18 October 2026: the handler refuses anonymous users, with
a test. The deployed version 1 predates the fix; redeploy with the command in
[Supabase setup](supabase-setup.md).

### The release signing key is present while Gradle runs

`android-release-build.yml` passes the keystore and its password to
`./gradlew assembleRelease`, which runs every native module's Gradle script and the
bundler. A compromised dependency could read the key. Building unsigned and then
signing with `apksigner` in a step that runs no project code would keep the key away
from dependencies. Still open; the change needs a release run to verify.

### Smaller items

- The Edge Functions have no `deno.lock`, so a deploy resolves transitive packages
  such as `iceberg-js` fresh.
- On iOS and Android, the Tracked download reads a response without a
  `Content-Length` header in full before the size check
  (`src/exercise/import/tracked-fetch.ts`). Only `app.tracked.gg` is read.
- The generated Android manifest asked for `SYSTEM_ALERT_WINDOW` (display over other
  apps). Fixed on 18 October 2026: `app.json` blocks it in release builds; debug
  builds keep it for the development overlay.

`npm audit` still reports the same 19 high findings, all from `node-forge` and
`braces` in development tooling.

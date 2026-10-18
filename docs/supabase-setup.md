# Shared KineVault accounts

KineVault Track uses Supabase Auth and account-owned tracking documents in project
`kkywpvkckxniriatelta`. Users sign in with email and password, or with Google, before entering Track.
Onboarding answers stay on the device until sign-in. Credentials belong to Supabase Auth, never to the tracking
documents.

## Application configuration

Create an ignored `.env.local` with:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://kkywpvkckxniriatelta.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<project publishable key>
```

Use the publishable key from the project's API Keys page. These values are included
in the application bundle. Never put a service-role key, secret key, database
password or SMTP password in an `EXPO_PUBLIC_*` variable.

Restart Expo after editing the environment. A build requires these values in its
build environment as well. Account features report unavailable configuration when
the values are missing or invalid.

## Database

The migration in `supabase/migrations/20261005150934_account_cloud_storage.sql`
creates four tables:

| Table             | Purpose                                    | Signed-in client access               |
| ----------------- | ------------------------------------------ | ------------------------------------- |
| `profiles`        | Shared account name and identity           | Read own row; update own display name |
| `roles`           | Shared `user`, `reviewer`, or `admin` role | Read own row                          |
| `subscriptions`   | Server-managed membership                  | Read own row                          |
| `track_documents` | Versioned tracking documents               | Read and write own documents          |

Signup creates a profile, a `user` role and a free active membership. Paid plan
names are reserved for future server-managed membership. There is no payment
provider or purchase flow. Clients cannot promote their role or edit a subscription.

All tables enable row-level security and explicit grants. Signed-out callers have
no table access. Each document belongs to an Auth user. The save RPC also checks the
account captured by the client against the current Auth user, so a delayed request
cannot save account A's tracking after the session changes to account B.

Document saves use compare-and-swap revisions. A stale revision returns no row,
which the application treats as a conflict instead of overwriting newer tracking.
Deleting a document writes a SQL `NULL` tombstone and advances its revision. Only
the six legacy profile, exercise, food log, custom-food, water log and water-goal
document keys are accepted. Payloads remain versioned JSON objects understood by
the existing application parsers. Profile progress-photo documents and image files
are outside this document sync.

Four later migrations are in `supabase/migrations/`:

- `20261005152713_track_role_assignment_index.sql` indexes the role assignment
  foreign key. It is applied.
- `20261008041229_bounded_history_partitions.sql` adds
  `track_document_partitions` and the monthly history RPCs. It is not applied;
  see [monthly cloud history rollout](history-migration-rollout.md).
- `20261013120000_exercise_demo_catalog.sql` adds the public `catalog_exercises`
  table and the `exercise-demos` storage bucket. It was applied on 2026-10-13;
  see [exercise demos](exercise-demos.md).
- `20261018120000_account_deletion_attempts.sql` adds the per-account attempt limit
  that `delete-account` checks. It was applied on 2026-10-18, before the function
  was deployed.

The migration was applied to the inspected empty project. Verification passed for
account isolation, anonymous denial, subscription/role write denial, signup defaults,
revision conflicts and the account-switch guard. Live password login and document
REST calls also passed, and temporary test users were removed. Database security
checks found no RLS or privilege problems. Supabase Auth's optional leaked-password
protection was disabled during the original review. Use the security-only command
below to enable and verify it before public release. The follow-up
[security remediation](security-remediation.md) records dependency fixes and
remaining findings. Grants and RLS must be reviewed together, because
new public tables no longer receive consistent default API access. See
[Supabase's Data API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
and [row-level security documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Edge Functions

| Function          | Purpose                                                        | Status                                                                                                        |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `delete-account`  | Deletes the signed-in account                                  | Deployed 2026-10-18 with `verify_jwt = true`. See [account management](account-management.md#server-rollout). |
| `tracked-workout` | Downloads Tracked share pages for the web app's workout import | Deployed 2026-10-13 with `verify_jwt = true`                                                                  |

`tracked-workout` exists because browsers can't read Tracked's pages. It needs no
secrets and no service-role key: it uses the platform's `SUPABASE_URL` and
`SUPABASE_ANON_KEY` only to check the caller's session with Auth. Keep
`verify_jwt = true` from `supabase/config.toml`. Deploy it from `Application/`
with the Supabase CLI:

```bash
supabase functions deploy tracked-workout --project-ref kkywpvkckxniriatelta
```

Until it's deployed, link import on the web says it isn't set up for the web yet
(or, in most browsers, that it isn't available right now), and the iOS and
Android apps keep importing directly from Tracked. After deploying, import a
share link in the web app while signed in. A request whose bearer token is the
project's legacy anon key passes the platform's JWT check but has no user, so it
should get a 401 reply that includes `"service": "tracked-workout"`. A 401
without that field comes from the platform, before the function runs. See
[workout import](workout-import.md#web) for the request and reply format.

## Email delivery and redirects

Leaked-password protection can be configured independently of email delivery.
Put only `SUPABASE_ACCESS_TOKEN` in ignored `.env.auth.local`, then run the
commands below. `metro.config.cjs` hides root `.env*` files other than Expo's
standard names from Metro; without it, development bundles would include this
token.

```bash
node --env-file=.env.auth.local scripts/configure-auth.mjs --security-only
node --env-file=.env.auth.local scripts/configure-auth.mjs --security-only --apply
```

The first command previews the change. The second enables protection and reads it
back to verify. It changes only `password_hibp_enabled`, so shared website and SMTP
settings are preserved. Supabase requires a Pro plan or above for this feature.
The follow-up attempt was rejected with HTTP 402 because the current plan does
not include it; a read-back confirmed protection is still disabled. The local
Management API token is ready for a retry after upgrading the organization.

Account emails currently go through Gmail SMTP (`smtp.gmail.com`, sender
`kinevault.track@gmail.com`, name "KineVault"), set by hand in the project's Auth
settings. Gmail caps how many messages an account sends a day, so Resend SMTP with a
verified sender domain is still the plan before a public release. Use Vercel for the
exported Track web app.
`vercel.json` defines the static build and clean routes. Create the Vercel project
from `Application/`, add the two public Supabase environment variables (and
`EXPO_PUBLIC_SENTRY_DSN` if you use Sentry), and use its
actual production origin for the web callback. No production URL has been reserved
or deployed yet.

`vercel.json` also sets a Content-Security-Policy. `script-src` allows the bundle
from the same origin plus Expo Router's one inline script by its SHA-256 hash
(`tests/web-headers.test.ts` fails if an Expo Router upgrade changes that script).
`connect-src` allows the Supabase project, Open Food Facts and the Sentry ingest host
`o4512218785120256.ingest.de.sentry.io`; a DSN for another Sentry organization or
region needs its host added. Images, video, styles and fonts aren't restricted.

Neither Resend nor Vercel credentials are connected in this workspace. The full
configuration script below replaces the Gmail SMTP settings with Resend's. Public email
delivery also requires a verified sender domain that you own. Once those are ready,
the prepared configuration script appends callbacks and leaves the Site URL and
existing redirects as they are. Put server credentials in an ignored
`.env.auth.local`, separate from the client `.env.local`:

```dotenv
SUPABASE_ACCESS_TOKEN=<Supabase account Management API token>
RESEND_API_KEY=<Resend sending key>
KINEVAULT_AUTH_EMAIL_FROM=<verified sender email>
# Optional until the web app is deployed; native email callbacks work independently.
KINEVAULT_TRACK_WEB_URL=<actual HTTPS Vercel production origin>
```

```bash
node --env-file=.env.auth.local scripts/configure-auth.mjs
node --env-file=.env.auth.local scripts/configure-auth.mjs --apply
```

The first command shows the proposed settings without credentials. The second
applies Resend SMTP and the additive redirect list, and sets the server password
minimum to at least 10 characters while preserving stricter existing settings. It
hasn't been run, so Resend and the password minimum aren't applied yet.
The native and localhost callbacks listed below were added to the redirect allowlist
by hand on 2026-10-18. Before that the list was empty, so confirmation links fell back
to the default Site URL, `http://localhost:3000`.

Keep email confirmation enabled. Configure a custom SMTP provider in the project's
Auth email settings before inviting users outside the project team. Supabase's
default mail service restricts recipients and sending volume and is intended for
evaluation. Store SMTP credentials in the Supabase dashboard. See
[custom SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

Add Track's callback URLs to Auth's redirect allowlist. Preserve existing redirects
and the shared Site URL. Add exact production URLs and narrowly scoped
development URLs rather than replacing the shared project's configuration. A native
deep link needs the installed application's registered scheme. Expo Go needs its
own development callback URL and is not a stable production email target. See
[redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

The application uses `/auth/callback` for confirmation and recovery. Add both
confirmation and recovery variants for the environments you use:

```text
kinevaulttrack://auth/callback
kinevaulttrack://auth/callback?flow=recovery
https://YOUR-TRACK-WEB-HOST/auth/callback
https://YOUR-TRACK-WEB-HOST/auth/callback?flow=recovery
http://localhost:8081/auth/callback
http://localhost:8081/auth/callback?flow=recovery
```

Adjust the localhost port to the running Expo server. Expo Go uses
`exp://YOUR-DEV-HOST:PORT/--/auth/callback` and its `?flow=recovery` variant instead
of the standalone scheme. Add those only for devices and development hosts you
actually use. Recovery continues to the application's `/auth/reset-password` screen.

Keep the confirmation and reset templates' `{{ .ConfirmationURL }}` link. A
hardcoded redirect to the friend's website would send Track's users to the wrong
application. The application uses PKCE and accepts only a PKCE code. It refuses
token-hash links and links that carry session tokens, because anyone can take one
from their own account's email; see
[security remediation](security-remediation.md#token-hash-email-links-on-a-guest-device).

Test confirmation and password reset through links sent to a real inbox. Open each
link in both the installed app and the deployed web app before releasing. A successful
email-request response alone does not verify delivery or deep-link handling.

## Google sign-in

"Continue with Google" opens Supabase's Google OAuth page in an in-app browser
session (`expo-web-browser`) and returns to the same `/auth/callback` URLs as email
links, so the redirect allowlist above already covers it. The web app follows the
redirect in the same tab. Supabase links a Google login to an existing account
with the same verified email.

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and
   configure the OAuth consent screen as External, with only the `openid`, `email`
   and `profile` scopes. Publish it, or add each tester while it stays in Testing.
2. Create an OAuth client ID of type Web application. Add
   `https://kkywpvkckxniriatelta.supabase.co/auth/v1/callback` as an authorized
   redirect URI.
3. In Supabase, enable Authentication → Sign In / Providers → Google and paste the
   client ID and secret.

`expo-web-browser` is a native module, so the change needs a new Android and iOS
build. Sign in with Apple needs a paid Apple Developer Program team; the free
Personal Team used for iPhone installs can't enable it. Add it before an App Store
release: apps that offer Google sign-in must also offer a privacy-focused login
service, which in practice means Sign in with Apple.

## Connecting the friend's KineVault program

The shared `profiles`, `roles` and `app_role` definitions use the identifiers in
`arielhagay10-ui/KineVault`. Both applications must use the same Supabase project to
share accounts. Each application has its own local session, so signing into one
does not automatically sign into the other.

Do not apply the friend's entire migration history blindly. Its foundation scripts
create core tables and the signup trigger that Track already provisions. Reconcile
those objects and establish a shared migration baseline first. Keep the Track
subscription provisioning when extending or replacing `private.handle_new_user`.
The friend's exercise, moderation and workshop schema still needs its own reviewed
migrations and integration.

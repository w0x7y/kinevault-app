# Shared KineVault accounts

KineVault Track uses Supabase Auth and account-owned tracking documents in project
`kkywpvkckxniriatelta`. Users sign in with email and password before entering Track.
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

| Table | Purpose | Signed-in client access |
| --- | --- | --- |
| `profiles` | Shared account name and identity | Read own row; update own display name |
| `roles` | Shared `user`, `reviewer`, or `admin` role | Read own row |
| `subscriptions` | Server-managed membership | Read own row |
| `track_documents` | Versioned tracking documents | Read and write own documents |

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

The migration was applied to the inspected empty project. Verification passed for
account isolation, anonymous denial, subscription/role write denial, signup defaults,
revision conflicts and the account-switch guard. Live password login and document
REST calls also passed, and temporary test users were removed. Database security
checks found no RLS or privilege problems. Supabase Auth's optional leaked-password
protection remains at its project default; review it in the Auth dashboard before
public release. The latest [final review](final-check.md) confirms it is disabled
and records the remaining dependency findings. Grants and RLS must be reviewed together, because
new public tables no longer receive consistent default API access. See
[Supabase's Data API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
and [row-level security documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Email delivery and redirects

Use Resend SMTP for account emails and Vercel for the exported Track web app.
`vercel.json` defines the static build and clean routes. Create the Vercel project
from `Application/`, add the two public Supabase environment variables, and use its
actual production origin for the web callback. No production URL has been reserved
or deployed yet.

Neither Resend nor Vercel credentials are connected in this workspace. Public email
delivery also requires a verified sender domain that you own. Once those are ready,
the prepared configuration script appends callbacks while preserving the friend's
Site URL and existing redirects. Put server credentials in an ignored
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
minimum to at least 10 characters while preserving stricter existing settings. The current MCP server cannot
manage Auth configuration, so these settings have not been applied automatically.

Keep email confirmation enabled. Configure a custom SMTP provider in the project's
Auth email settings before inviting users outside the project team. Supabase's
default mail service restricts recipients and sending volume and is intended for
evaluation. Store SMTP credentials in the Supabase dashboard. See
[custom SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

Add Track's callback URLs to Auth's redirect allowlist. Preserve existing redirects
and the friend's website Site URL. Add exact production URLs and narrowly scoped
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

Keep the confirmation and reset templates' `{{ .ConfirmationURL }}` link, or use a
reviewed token-hash template that honors `{{ .RedirectTo }}`. A hardcoded redirect
to the friend's website would send Track's users to the wrong application. The
application primarily uses PKCE and handles legacy token-hash and implicit-session
callbacks for compatible existing templates.

Test confirmation and password reset through links sent to a real inbox. Open each
link in both the installed app and the deployed web app before releasing. A successful
email-request response alone does not verify delivery or deep-link handling.

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

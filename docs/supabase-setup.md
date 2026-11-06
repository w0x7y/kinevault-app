# Supabase setup

Track and KineVault share accounts in Supabase project `kkywpvkckxniriatelta`. Users sign in with email and password, or with Google. Onboarding answers stay on the device until sign-in. Credentials live in Supabase Auth, never in tracking documents.

## App config

Create `.env.local` (Git ignores it):

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://kkywpvkckxniriatelta.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<project publishable key>
```

The key is on the project's API Keys page. Restart Expo after editing. Builds need the same values in their build environment. Without them, account features show as unavailable.

These values ship inside the app. Never put a service-role key, secret key, database password or SMTP password in an `EXPO_PUBLIC_*` variable.

## Database

`supabase/migrations/20261005150934_account_cloud_storage.sql` creates four tables:

| Table             | Holds                            | Signed-in client can                  |
| ----------------- | -------------------------------- | ------------------------------------- |
| `profiles`        | Shared account name and identity | Read own row; update own display name |
| `roles`           | `user`, `reviewer` or `admin`    | Read own row                          |
| `subscriptions`   | Server-managed membership        | Read own row                          |
| `track_documents` | Versioned tracking documents     | Read and write own documents          |

- Signup creates a profile, a `user` role and a free active membership. There is no payment flow. Clients can't change their role or subscription.
- Every table has row-level security and explicit grants. Signed-out callers get no table access.
- Review grants and RLS together. New public tables no longer get Data API access by default ([grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security)).
- The save RPC checks the client's account against the current Auth user, so a delayed save can't write account A's data into account B.
- Saves use compare-and-swap revisions. A stale revision returns no row, and the app shows a conflict instead of overwriting.
- Deleting a document writes a SQL `NULL` tombstone and bumps the revision.
- Accepted keys are profile, exercise, food log, custom foods, water log, water goal and [Logged steps](#logged-steps-sync). Progress photos don't sync.

| Migration                                        | Adds                                                         | Applied                                                               |
| ------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `20261005152713_track_role_assignment_index.sql` | Index on the role assignment foreign key                     | Yes                                                                   |
| `20261008041229_bounded_history_partitions.sql`  | `track_document_partitions` and monthly history RPCs         | No, see [monthly cloud history rollout](history-migration-rollout.md) |
| `20261013120000_exercise_demo_catalog.sql`       | Public `catalog_exercises` table and `exercise-demos` bucket | 2026-10-13, see [exercise demos](exercise-demos.md)                   |
| `20261018120000_account_deletion_attempts.sql`   | Per-account attempt limit for `delete-account`               | 2026-10-18, and recorded in the migration history                     |
| `20261029120000_track_documents_steps_log.sql`   | The Logged steps key                                         | 2026-10-29                                                            |

Don't run `supabase db push`. It would also apply the history partitions migration.

Supabase's leaked-password protection is still off; see [Email and redirects](#email-and-redirects). Open dependency findings are in [security remediation](security-remediation.md).

## Logged steps sync

`20261029120000_track_documents_steps_log.sql` adds `kinevault-track.steps-log.v1` to the `track_documents_allowed_key` check, so Logged steps sync like the water log. It adds no table, grant, policy or function. History partitions stay food and exercise only. Account deletion and export include the row. Phone steps have no key and never upload.

`scripts/track-documents-steps-log.test.mjs` runs every migration in PGlite on each `npm test` and checks that every registered key saves.

### Older builds

Builds from 2026-10-05 that lack the unknown-key skip (`unknownCloud` in `src/account/storage.ts`) reject a cloud key they don't know (`checkedCloud`). An account gets a Logged steps row the first time an updated device syncs Logged steps, including steps saved before the update or while signed out. From then on, an older build signed in to it:

- Fails every download with "Cloud sync couldn't finish" and gets no changes from other devices.
- Still uploads edits to documents no other device changed. An edit to a changed document fails with the same error instead of a Cloud conflict, and stays on the device.
- Can't open the account on a device with no saved Profile for it, such as a new install. It shows "Couldn't load this account's saved data."
- Can't export cloud copies. Export device copy still works.

Nothing is lost, and accounts that never log steps aren't affected. Pending edits sync after the update. Steps logged on an older build upload after the update if the cloud has none. Otherwise Settings shows a Logged steps Cloud conflict and the user keeps one copy. Days aren't merged.

Rollout rule:

1. Apply the migration before installing a build with Logged steps sync anywhere. Against the old constraint, every sync on that device fails.
2. Update every device on an account, web preview included, before logging steps on any of them.

### Apply

Run in bash from `Application/`, with the Management API token from `.env.auth.local` exported as `SUPABASE_ACCESS_TOKEN`:

```bash
project=https://api.supabase.com/v1/projects/kkywpvkckxniriatelta
query() {
  jq -n --arg query "$1" '{query: $query}' |
    curl -sS --fail-with-body "$project/database/query$2" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" --data-binary @-
  echo
}
```

1. Record the baseline. The constraint lists six keys, the history has no `20261029120000`, and note the counts:

   ```bash
   query "select pg_get_constraintdef(oid) from pg_constraint where conname = 'track_documents_allowed_key'" /read-only
   curl -sS "$project/database/migrations" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"; echo
   query "select document_key, count(*) as rows, max(revision) as max_revision from public.track_documents group by document_key order by document_key" /read-only
   ```

2. Apply the file and record it in one transaction:

   ```bash
   jq -n --rawfile migration supabase/migrations/20261029120000_track_documents_steps_log.sql \
     --arg record "insert into supabase_migrations.schema_migrations (version, name) values ('20261029120000', 'track_documents_steps_log');" \
     '{query: "begin;\n\($migration)\n\($record)\ncommit;"}' |
     curl -sS --fail-with-body "$project/database/query" \
       -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
       -H "Content-Type: application/json" --data-binary @-
   ```

3. Verify. Rerun the three baseline checks. The constraint ends with `'kinevault-track.steps-log.v1'::text`, the history lists `20261029120000` `track_documents_steps_log`, and the counts match. Then log steps on a test account and check that Settings says "All changes saved to your account." and another device shows them.

### Roll back

Roll back only before any build with Logged steps sync is installed. This deletes every account's cloud copy of Logged steps, and a device that already synced them then fails every sync. After release, fix forward.

```bash
query "begin;
delete from public.track_documents where document_key = 'kinevault-track.steps-log.v1';
alter table public.track_documents
  drop constraint track_documents_allowed_key,
  add constraint track_documents_allowed_key check (document_key in (
    'kinevault-track.profile.v1', 'kinevault-track.exercise.v1',
    'kinevault-track.food-log.v1', 'kinevault-track.custom-foods.v1',
    'kinevault-track.water-log.v1', 'kinevault-track.water-goal.v1'));
delete from supabase_migrations.schema_migrations where version = '20261029120000';
commit;"
```

## Edge Functions

| Function          | Does                                               | Status                                                                                             |
| ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `delete-account`  | Deletes the signed-in account                      | Deployed with `verify_jwt = true`. See [account management](account-management.md#server-rollout). |
| `tracked-workout` | Fetches Tracked share pages for the web app import | Deployed with `verify_jwt = true`                                                                  |

Keep `verify_jwt = true` from `supabase/config.toml`. `tracked-workout` needs no secrets or service-role key. It uses the platform's `SUPABASE_URL` and `SUPABASE_ANON_KEY` only to check the caller's session. Deploy from `Application/`:

```bash
npx supabase functions deploy tracked-workout --project-ref kkywpvkckxniriatelta --use-api
```

To test, import a share link in the web app while signed in. A request with the legacy anon key, or an anonymous sign-in, should get a 401 that includes `"service": "tracked-workout"`. A 401 without that field comes from the platform. Without the function, web link import says it isn't available, and the phone apps import from Tracked directly. See [workout import](workout-import.md#web).

## Email and redirects

### Leaked-password protection

It's off. It needs a Supabase Pro plan, and the last try failed with HTTP 402. After upgrading, run these. They need only `SUPABASE_ACCESS_TOKEN` in `.env.auth.local`, which Git ignores.

```bash
node --env-file=.env.auth.local scripts/configure-auth.mjs --security-only           # preview
node --env-file=.env.auth.local scripts/configure-auth.mjs --security-only --apply   # enable and read back
```

It changes only `password_hibp_enabled`. `metro.config.cjs` hides root `.env*` files other than Expo's standard names from Metro, which keeps this token out of development bundles.

### Email delivery

Account emails go through Gmail SMTP (`smtp.gmail.com`, sender `kinevault.track@gmail.com`, name "KineVault"), set by hand in Auth settings. Gmail caps daily sends. Switch to Resend with a verified sender domain you own before a public release.

1. Put server credentials in `.env.auth.local`, never in `.env.local`:

   ```dotenv
   SUPABASE_ACCESS_TOKEN=<Supabase account Management API token>
   RESEND_API_KEY=<Resend sending key>
   KINEVAULT_AUTH_EMAIL_FROM=<verified sender email>
   # Optional until the web app is deployed; native email callbacks work without it.
   KINEVAULT_TRACK_WEB_URL=<actual HTTPS Vercel production origin>
   ```

2. Preview, then apply:

   ```bash
   node --env-file=.env.auth.local scripts/configure-auth.mjs
   node --env-file=.env.auth.local scripts/configure-auth.mjs --apply
   ```

The script replaces Gmail SMTP with Resend, appends redirect URLs without touching the Site URL or existing redirects, and sets the password minimum to at least 10 characters. It hasn't been run. The password minimum is already 10.

- Keep email confirmation on.
- Store SMTP credentials only in the Supabase dashboard ([custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).
- Keep `{{ .ConfirmationURL }}` in the confirmation and reset templates. A hardcoded link to the KineVault website sends Track users to the wrong app.
- The app accepts only PKCE codes. It refuses token-hash links and links with session tokens; see [security remediation](security-remediation.md#token-hash-email-links-on-a-guest-device).
- Before release, open real confirmation and reset emails in the installed app and the deployed web app. A successful send request doesn't prove delivery.

### Redirect URLs

Add these to Auth's redirect allowlist. Don't replace the shared Site URL or existing redirects ([redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)). The native and localhost ones are already there.

```text
kinevaulttrack://auth/callback
kinevaulttrack://auth/callback?flow=recovery
https://YOUR-TRACK-WEB-HOST/auth/callback
https://YOUR-TRACK-WEB-HOST/auth/callback?flow=recovery
http://localhost:8081/auth/callback
http://localhost:8081/auth/callback?flow=recovery
```

Match the localhost port to the running Expo server. Expo Go uses `exp://YOUR-DEV-HOST:PORT/--/auth/callback` and its `?flow=recovery` variant. Add those only for hosts you use. Recovery opens `/auth/reset-password`.

## Web hosting

The web app goes on Vercel. `vercel.json` defines the build and routes. It isn't deployed yet. [Web deploy](web-deploy.md) has the full steps.

1. Create the Vercel project from `Application/`.
2. Add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and, for Sentry, `EXPO_PUBLIC_SENTRY_DSN`.
3. Use the production origin for the web callback URLs above.

`vercel.json` also sets a Content-Security-Policy:

- `script-src` allows same-origin scripts and Expo Router's inline script by SHA-256 hash. `tests/web-headers.test.ts` fails if an Expo Router upgrade changes that script.
- `connect-src` allows the Supabase project, Open Food Facts and `o4512218785120256.ingest.de.sentry.io`. A DSN for another Sentry organization or region needs its host added.

## Google sign-in

"Continue with Google" opens Supabase's Google OAuth page with `expo-web-browser` and returns to the same `/auth/callback` URLs. Supabase links it to an existing account with the same verified email.

1. In [Google Cloud Console](https://console.cloud.google.com/), set the OAuth consent screen to External with only the `openid`, `email` and `profile` scopes. Publish it, or add each tester while it's in Testing.
2. Create a Web application OAuth client ID with redirect URI `https://kkywpvkckxniriatelta.supabase.co/auth/v1/callback`.
3. In Supabase, enable Authentication > Sign In / Providers > Google and paste the client ID and secret.

`expo-web-browser` is native, so this needs new Android and iOS builds. Before an App Store release, add Sign in with Apple. Apps with Google sign-in must also offer a privacy-focused login, and in practice that means Apple's. It needs a paid Apple Developer Program team; the free Personal Team can't enable it.

## KineVault accounts

`profiles`, `roles` and `app_role` match `arielhagay10-ui/KineVault`. Both apps must use the same Supabase project. Each app has its own session, so signing in to one doesn't sign in to the other.

Don't apply KineVault's whole migration history. Its foundation scripts create core tables and the signup trigger that Track already has. Reconcile them and set a shared migration baseline first. Keep Track's subscription provisioning when changing `private.handle_new_user`. KineVault's exercise, moderation and workshop schema needs its own reviewed migrations.

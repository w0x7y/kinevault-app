# Account export and deletion

## Export

Settings → Data & account → **Export account data**. Web downloads a JSON file. iOS and Android open the share sheet, which needs the installed `expo-sharing` module, then delete the temporary file.

The versioned `kinevault-track-account-export` file holds the account ID, export time, every tracking document (Logged steps and body-weight history included), local and cloud copies with their revisions and conflict flags, recovered setup answers, and photo metadata with base64 JPEG contents. It leaves out passwords, session tokens, auth storage, internal history fragments and other accounts' records.

- Local and cloud copies stay separate, so unsynced edits are never replaced. A cloud document this build doesn't know is kept unparsed.
- Online, any cloud failure fails the export. Offline, **Export device copy** marks cloud data as unchecked.
- A missing or unreadable photo or document fails the export instead of being dropped.
- Photos from other devices aren't included, because photos are local only.
- It isn't a transactional backup. Two exports can differ if another device changes data in between.

## Deletion

Deletion asks for the current password and the word `DELETE`. A Google-only account (`app_metadata.providers` has `google` but not `email`) uses **Sign in with Google again** instead, which unlocks the delete button for 10 minutes. On web and Android that sign-in returns through the callback route, so reopen Settings and the deletion form afterwards. The button needs a connection. The password is cleared on submit and never saved or logged.

The disclosure says KineVault apps share the login, and deleting it removes the shared account records, Track documents and history, and membership.

On the device:

1. The app freezes writes and media work for that account, waits for pending uploads and writes, then saves `deleted.v1 = "pending"`.
2. If the server rejects the first request, it removes the marker and resumes. If that fails, or an earlier attempt's outcome is unknown, data stays frozen.
3. Once the server confirms, it saves `deleted.v1 = "1"` and removes the account's records, fragments, claimed guest recovery and owned photos.

Every write checks the marker, so a pending marker still blocks writes after a restart. `cleanupDeletedData` cleans up only with a confirmed `"1"` marker.

Photo ownership is tracked in the local-only `kinevault-track.profile-media.v1.ownership.v1` document, so deletion also finds orphaned files and skips photos another account references. It's never uploaded. A browser without Web Locks won't clear the session automatically and shows a device-cleanup error rather than risk another tab's login.

If cleanup fails, the app says the server deleted the account but data is left on this device, and asks the user to clear the app's device or site storage. Other devices' photos and caches have to be removed on those devices. If the server's response is lost, the app can't confirm success and keeps local data; the account can no longer sign in, so clear the leftovers through device storage settings.

## Server rollout

`delete-account` was deployed on 2026-10-18 (version 1, `verify_jwt = true`) to the shared KineVault project, after applying `supabase/migrations/20261018120000_account_deletion_attempts.sql` on its own. Don't apply it with `supabase db push`, which would also apply the unapplied history migration. Without that migration the function fails closed with 503.

Redeploy from `Application/` with `SUPABASE_ACCESS_TOKEN` set:

```bash
npx supabase functions deploy delete-account --project-ref kkywpvkckxniriatelta --use-api
```

`supabase/functions/delete-account/index.ts` imports pinned `@supabase/supabase-js@2.117.2` and needs `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Never put the service key in an `EXPO_PUBLIC_*` setting or the client bundle. Keep `verify_jwt = true` from `supabase/config.toml` ([auth headers](https://supabase.com/docs/guides/functions/auth-headers)).

The request is a `POST` with a bearer token and JSON `{password, confirmation: "DELETE"}`, or `{confirmation: "DELETE"}` for Google-only accounts. Other fields, including a target user ID, are rejected, and the body is capped at 2,048 bytes. Never log request bodies or credentials. The handler:

1. checks the caller with `getUser(token)`, then allows 5 attempts per account per hour through `record_account_deletion_attempt`. It replies 429 over the limit and 503 if it can't record the attempt;
2. with a password, signs in on a fresh nonpersistent client, checks it's the same user and calls `auth.admin.signOut(freshAccessToken, "global")`. Without one, the caller's own token must show an OAuth sign-in (`amr` method `oauth`) from the last 10 minutes; refreshing a token keeps the original time;
3. calls `auth.admin.deleteUser(callerId, false)`. It never returns `{deleted: true}` after a failed step.

Before enabling production deletion:

- Audit every app's data tied to the shared account, including Storage objects and tables without `auth.users` foreign keys. Track's tables use `ON DELETE CASCADE`, and the endpoint relies on that. Add server cleanup for anything else before claiming it's removed.
- Storage objects a user owns can block Auth deletion. This build creates none.
- Never test on real users. Use a disposable user in an isolated project, and check the refresh token fails, the Auth user is gone and no audited table has rows for it.
- Revoking sessions kills refresh tokens, but issued access JWTs work until they expire. See [signOut](https://supabase.com/docs/reference/javascript/auth-admin-signout), [deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) and [getUser](https://supabase.com/docs/reference/javascript/auth-getuser).

## Tests

`tests/account-management.test.ts`, `tests/account-auth.test.ts`, `tests/account-session-adapter.test.ts`, `tests/account-deletion-regressions.test.ts`, and `scripts/account-deletion-attempts.test.mjs` for the attempt-limit migration in PGlite. Browser tests check the real JSON download and JPEG contents. None of them deploy the function, delete a real user or test cleanup on a device.

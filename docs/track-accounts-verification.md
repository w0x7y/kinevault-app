# Track account verification (2026-10-05)

Project `kkywpvkckxniriatelta`, with `20261005150934_account_cloud_storage` and `20261005152713_track_role_assignment_index` applied, matching the checked-in migrations.

- `npm run check` (668 unit tests), `node --test scripts/configure-auth.test.mjs`, the browser suite (153 tests, all 12 account scenarios) and the web, iOS and Android exports passed.
- On live Supabase, password login and document saves worked, and new members defaulted to Free/active. Anonymous and cross-account access, role promotion and client membership changes were denied.
- The test users were removed afterwards.

Native SecureStore, foreground refresh and email links in the installed app still need a device or simulator.

Run the browser suite against an exported app on port 8082, with a development server on 8081 for the native Back-handler cases. The development server alone runs out of heap.

```bash
KINE_PREVIEW_URL=http://localhost:8082 KINE_DEV_PREVIEW_URL=http://localhost:8081 npm run test:browser
```

Public email (Resend SMTP) and production hosting (Vercel) are prepared but not active. They need provider credentials, a verified sender domain and Management API access. See [Supabase setup](supabase-setup.md).

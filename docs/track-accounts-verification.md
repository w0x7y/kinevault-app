# Track account verification — 2026-10-05

Supabase project: `kkywpvkckxniriatelta`. Applied migrations:
`20261005150934_account_cloud_storage` and
`20261005152713_track_role_assignment_index`. Checked-in versions match the remote
migration history.

- `npm run check`: TypeScript passed; 668 unit tests passed.
- `node --test scripts/configure-auth.test.mjs`: two configuration tests passed.
- Full browser regression: 153 passed, zero failures, one existing optional
  screenshot test skipped. All 12 account scenarios passed, including review save
  before login, session reload, confirmation without a session, login errors,
  expired callback cleanup, recovery while cloud loading fails, password fields
  surviving a slow download, and logout/retry after an initial download failure.
- Web, iOS and Android JavaScript exports succeeded. This verifies bundling;
  native SecureStore, foreground refresh and installed-app email links still need
  physical-device or simulator testing.
- Live Supabase Auth password login and document REST saves succeeded. Membership
  defaulted to Free/active. Anonymous access, cross-account access, role promotion,
  and client membership changes were denied. Revision conflicts and deletion
  tombstones behaved as expected. Separate rolled-back SQL checks also exercised
  signup defaults, profile update triggers and owner policies.
- Temporary verification users were removed. The database contains zero users and
  zero tracking documents after cleanup. Existing preview-device profile data was
  retained, and temporary account storage/claim keys were removed.

For the full browser run, the exported app was served on port 8082. A development
server on port 8081 supplied three native Back-handler introspection cases and an
isolated widget bundle:

```bash
KINE_PREVIEW_URL=http://localhost:8082 KINE_DEV_PREVIEW_URL=http://localhost:8081 npm run test:browser
```

The Expo development server exhausted its heap during the earlier broad run.
Testing the exported app avoided repeated development SSR requests. The final
development preview was restarted and is available on port 8081.

Public email delivery and production hosting have not been activated. Resend SMTP
and Vercel build configuration are prepared; provider credentials, a verified
sender domain and Supabase Management API access are still needed. See
[Supabase setup](supabase-setup.md) for exact inputs and additive callback settings.

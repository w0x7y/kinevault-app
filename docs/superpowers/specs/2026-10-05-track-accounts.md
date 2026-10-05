# Track accounts and cloud storage

Use the existing Supabase project `kkywpvkckxniriatelta` and Supabase Auth email/password identities shared with KineVault. Require a session before entering Track. Keep signup/login after onboarding review is durably saved, with an earlier login entry for returning users. Signup may require email confirmation; requesting an email never opens Home.

Use native SecureStore for session credentials and browser storage on web. Handle confirmation and recovery callbacks outside profile restrictions. Match KineVault's ten-character signup password minimum. Logout ends this app's session.

Keep private domain persistence behind an account-scoped storage adapter. Sync profile/goals, custom exercises/templates/full workout sessions, and nutrition/hydration source documents used to derive stats. Keep photos on the device. Preserve local writes while offline using a durable pending envelope. Compare server revisions to prevent simultaneous devices silently overwriting each other; expose explicit conflict choices. Import existing guest data into the first account only, retaining a recovery copy and preserving existing cloud documents.

Add owner-isolated Track document storage alongside compatible KineVault profiles and roles. Use explicit authenticated grants and ownership RLS. Membership defaults to free/active and clients can only read their own status; no payments or self-upgrade API.

Verify auth state transitions, account isolation, offline restart, conflict/deletion handling, browser onboarding/auth flows, real SQL role checks, TypeScript, unit tests, and web export. Document email delivery and redirect dashboard settings that cannot be changed with the available MCP tools.

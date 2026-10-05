# Implementation plan

1. Auth: singleton Supabase client, secure session adapter, testable controller, React provider, callback and recovery routes. Validate confirmation, errors, cleanup and recovery transitions.
2. Persistence: durable account namespaces, selected document sync with compare-and-set revisions, one-time legacy import, tombstones and explicit conflicts. Test offline restart and account switches.
3. Database: compatible shared profiles/roles, private signup trigger, owner-protected Track documents, server-owned memberships, authenticated revision RPC, checked-in migration and client remote adapter. Apply reviewed migration and verify privileges under authenticated/anonymous roles in rolled-back transactions.
4. App: mount auth/storage before profile providers, scope every private provider, block tabs without auth, connect account forms after profile save, add returning login and settings membership/sync/logout controls.
5. Configuration and verification: ignored public-key environment configuration plus checked-in example; add callback setup documentation; update browser fixtures for required auth and test success/failure/confirmation/logout/recovery. Run check, relevant browser suites, export and database advisors.

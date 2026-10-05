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

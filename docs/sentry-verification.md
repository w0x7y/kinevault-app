# Sentry delivery verification

Track uses organization `idan-gilboa`, project `kinevault-track` (React Native), in
Sentry's EU region. Its public DSN is configured as `EXPO_PUBLIC_SENTRY_DSN` in
ignored `.env.local`. Existing local configuration is preserved. No Sentry auth
token is needed in the app or its public environment.

## Verification scope

On 2026-10-08, a temporary isolated Metro entry loaded the actual
`initializeCrashReporting()` and `AppErrorBoundary`. A button caused a real React
render failure with a fixed synthetic error. The boundary displayed its recovery
screen and called the actual `reportCrash` path; the SDK flushed successfully.
Sentry MCP retrieved the matching event by the SDK's event ID.

This verifies local JavaScript delivery. It does not verify a deployed staging
build, a production build, or physical iOS/Android behavior. No hosting deployment
was performed. No arbitrary environment or release values were added to the
strict event allowlist.

## Privacy acceptance

The stored error must read `Error: Application runtime error`. The raw synthetic
message, health data, authentication data, account identifiers, breadcrumbs,
request data, arbitrary contexts and local paths must be absent. Frames retain
only approved bundle basenames and numeric line/column positions.

The first event revealed Sentry's server-side IP-to-location enrichment despite
the SDK removing user data. Deleting the event's user field is not sufficient to
prevent that enrichment. [Sentry's scrubbing documentation](https://docs.sentry.io/security-legal-pii/scrubbing/server-side-scrubbing/#geographic-information)
also states that disabling stored IP addresses alone does not remove geographic
information.

The verified issue is
[KINEVAULT-TRACK-1](https://idan-gilboa.sentry.io/issues/KINEVAULT-TRACK-1), with
description `Error: Application runtime error`. The fresh event
`b69a34f3b1f24fb9985435632a0002b4`, captured at `2026-10-08T05:02:51.910Z`,
passed the final privacy check after the sanitizer rebuilt `user` as the constant
`{ ip_address: "0.0.0.0" }`. The outgoing event was inspected using the SDK's
`beforeEnvelope` hook. It contained only event ID/timestamp, JavaScript platform,
error level, the constant sentinel, sanitized exception/frames, and SDK
name/version/package/settings metadata. Sentry MCP retrieved this exact event
with no `user.geo`, account identity or raw canary message. Its user/tag display
was `ip:0.0.0.0`; the reported one-user count represents this constant bucket,
not a distinct application user.

The earlier synthetic event remains in the same issue; the fix does not rewrite
historical events. No event or issue was deleted. Server-generated event/trace
identifiers are delivery metadata and do not imply that tracing is enabled.

The temporary fixture was removed and its helper server stopped after
verification. All five crash-policy regression tests pass.

## Operational limits

Tracing, profiling, replay, logs, sessions and native crash collection remain
disabled. Source-map and native debug-artifact uploads were not configured.
Retained bundle locations permit correlation, but the verified stack has no
source context or function names; production symbolication remains deferred until
its artifact and privacy policy is reviewed. See the
[React Native source-map guide](https://docs.sentry.io/platforms/react-native/sourcemaps/)
before changing build tooling.

For a future verification, use an isolated synthetic fixture that imports the
actual initializer and boundary. Confirm the SDK client exists, trigger a render
failure, flush the SDK, and retrieve that exact event through Sentry MCP. Inspect
both the post-scrub outgoing event and the stored event, including user/IP/geo
fields. Remove the trigger afterward. A standalone `captureException` script
does not prove the app's initialization and error-boundary wiring.

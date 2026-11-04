# Sentry verification

Track reports to Sentry organization `idan-gilboa`, project `kinevault-track` (React Native), in the EU region. The public DSN is `EXPO_PUBLIC_SENTRY_DSN` in ignored `.env.local`; the app needs no auth token. The iOS unsigned build workflow reads the DSN from the repository variable of the same name ([step 5 of the xtool runbook](ios-linux-xtool.md#5-configure-the-github-repository)).

## What was verified

On 2026-10-08, a temporary Metro entry loaded the real `initializeCrashReporting()` and `AppErrorBoundary` and threw a synthetic render error, and Sentry MCP fetched the event. That proves local JavaScript delivery only, not a staging, production or device build.

Event `b69a34f3b1f24fb9985435632a0002b4` in [KINEVAULT-TRACK-1](https://idan-gilboa.sentry.io/issues/KINEVAULT-TRACK-1) passed the privacy check. It reads `Error: Application runtime error`, keeps only bundle basenames and line and column numbers, and has no raw message, health, auth or account data, breadcrumbs, request data, contexts, local paths or `user.geo`. The user is the constant `{ ip_address: "0.0.0.0" }`, so the issue's one user is that constant.

The first event got Sentry's IP-based location even with the user removed, and [Sentry's docs](https://docs.sentry.io/security-legal-pii/scrubbing/server-side-scrubbing/#geographic-information) say turning off stored IPs doesn't remove it either. That's why the IP is a constant.

## Not set up

Tracing, profiling, replay, logs, sessions, native crash collection and source map uploads are off, so stacks have no source or function names. Review the artifacts and privacy policy, and read the [React Native source-map guide](https://docs.sentry.io/platforms/react-native/sourcemaps/), before changing build tooling.

## Verify again

1. Write a synthetic fixture that imports the real initializer and error boundary. A standalone `captureException` script doesn't prove the app's wiring.
2. Trigger a render failure, flush the SDK and fetch that exact event through Sentry MCP.
3. Check the outgoing event (the SDK's `beforeEnvelope` hook) and the stored event, including user, IP and geo fields.
4. Remove the trigger.

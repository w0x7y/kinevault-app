# Crash recovery, reporting and offline sync

The root `AppErrorBoundary` wraps the theme, connectivity, account and document providers. Its fallback uses platform text and controls, hides the startup splash, shows a fixed message, and provides an accessible Reload button. Reload remounts the providers without modifying persisted tracking. On web, after two failed remount attempts, Reload refreshes the page. Native recovery remounts the application subtree. A JavaScript boundary catches render/lifecycle failures, not every event-handler error or a native process crash.

## Optional Sentry reporting

Reporting is disabled when `EXPO_PUBLIC_SENTRY_DSN` is absent or empty. To configure it, create a Sentry React Native project and put its **public DSN** into your local/deployment environment:

```dotenv
EXPO_PUBLIC_SENTRY_DSN=https://public-key@your-sentry-host/project-id
```

Restart Metro or rebuild/export after setting it; Expo public environment variables are included at build time. A Sentry authentication token must never be an `EXPO_PUBLIC_` variable or committed to the repository. Having the SDK installed does not mean production crash reporting is active. Confirm an event arrives in the intended project in a staging build before relying on reporting.

`initializeCrashReporting` initializes the SDK in the root module when configured. It retains JavaScript runtime error handlers and reports caught render crashes via `captureException`. `beforeSend` rebuilds each error event from a strict allowlist:

- Known JavaScript exception names and a fixed replacement message.
- Numeric stack locations and recognized bundle filenames without URL queries or fragments.
- A valid event ID, numeric timestamp, and fixed platform/severity.
- A constant `user.ip_address` of `0.0.0.0`, which prevents ingestion from inferring the sender's real IP and location. The original user object is never copied.

Names, emails, account identifiers, health records, food/workout entries, tokens, passwords, requests, user objects, breadcrumbs, tags, extra fields, source snippets, local paths, stack function names and arbitrary contexts are removed. Unknown error names become `Error`. Non-error events are dropped. Error messages are intentionally omitted even when they would improve diagnostics.

Default PII collection, native reporting, session tracking, logs, tracing, profiling and replay are disabled. The SDK integrations are restricted to runtime handlers, deduplication and frame rewriting. Native reporting remains disabled because native crash files can bypass the JavaScript `beforeSend` filter; this setup reports JavaScript crashes only. No account identity is attached to Sentry.

Removing the user field alone is insufficient: Sentry can infer IP/location from the ingestion request. The constant address replaces that inference without retaining identity. Sentry can still add delivery metadata such as trace/event identifiers. The network service receives the request as part of delivery; this application filter controls the event contents, not the vendor's network infrastructure. Project-side IP and geographic scrubbing provide additional protection. See [Sentry's geographic scrubbing guidance](https://docs.sentry.io/security-legal-pii/scrubbing/server-side-scrubbing/#geographic-information) and the [live verification record](sentry-verification.md).

The public DSN controls JavaScript runtime reporting; it does not require a Sentry auth token. The native/source-map Expo plugin is intentionally absent while native reporting is disabled. Source map uploads are a separate build-service step. The local npm policy blocks the Sentry CLI postinstall binary download. If source map uploads are needed, configure an approved CLI installation and secret `SENTRY_AUTH_TOKEN` in the build environment, then follow the [Expo Sentry setup guide](https://docs.expo.dev/guides/using-sentry/) for the Expo plugin, project/organization and Metro/source map configuration. Source map upload and native symbolication have not been configured or verified here. Bundle-only frame locations are retained; arbitrary source paths are stripped.

## Connectivity and account ownership

NetInfo drives three states: `unknown`, `offline` and `online`. `offline` requires an explicit disconnected or unreachable reading; nullable initial reachability never displays an offline warning. `online` requires both a connection and confirmed internet reachability. The root warning and account settings explain confirmed offline operation. A network reading does not guarantee the account service is available; failed sync still shows its own recovery state.

Domain saves continue using the existing durable account cache. Pending changes remain local on a network failure. Each account storage owner installs its own reconnect listener; a transition into confirmed online retries cloud sync after storage initialization settles. Successful reconnect also clears an initial account-load failure. Signing out, switching owners, retrying hydration or unmounting removes that listener before stopping storage. Old initialization and retry completions cannot publish into the replacement provider. Duplicate online notifications do not schedule duplicate retries. Native authentication refresh pauses during confirmed offline/background operation and resumes on reconnection while active.

Connectivity does not bypass cloud conflict handling: reconnect downloads cloud revisions, and conflicting copies still require the user's existing explicit choice.

## Verification

```sh
node --experimental-strip-types --test tests/error-boundary.test.ts tests/crash-reporting.test.ts tests/connectivity.test.ts
```

These tests cover private error-text exclusion, hostile thrown values, reload escalation, telemetry payload scrubbing, reporting opt-in, unknown reachability, delayed hydration, listener cleanup and retry failures. Device/native behavior and delivery to a configured Sentry project require a staging build and project credentials.

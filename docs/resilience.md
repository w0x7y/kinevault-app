# Crash recovery, reporting and offline sync

## Error boundary

The root `AppErrorBoundary` wraps the theme, connectivity, account and document providers. On a crash it shows a fixed message and a Reload button, which remounts the providers without touching saved tracking. On web, after two failed remounts, Reload refreshes the page. It catches render and lifecycle errors, not every event-handler error or a native crash.

## Sentry reporting

Reporting is off unless `EXPO_PUBLIC_SENTRY_DSN` holds a Sentry React Native project's public DSN:

```dotenv
EXPO_PUBLIC_SENTRY_DSN=https://public-key@your-sentry-host/project-id
```

Restart Metro or rebuild after setting it. Never put a Sentry auth token in an `EXPO_PUBLIC_` variable or commit it. Confirm an event reaches the right project from a staging build before relying on it. Track's project is in [Sentry verification](sentry-verification.md).

`beforeSend` rebuilds every error event from this allowlist:

- known JavaScript exception names (others become `Error`) and a fixed message;
- numeric stack locations and bundle filenames, without queries or fragments;
- the event ID, timestamp, platform and severity;
- `user.ip_address` set to `0.0.0.0`, so Sentry can't infer the sender's IP and location.

Everything else is dropped, including identities, health and tracking data, tokens, passwords, requests, breadcrumbs, local paths and error messages. So are non-error events. Default PII, sessions, logs, tracing, profiling, replay and native reporting are off; native crash files would bypass `beforeSend`. Also turn on project-side IP and geographic scrubbing ([guidance](https://docs.sentry.io/security-legal-pii/scrubbing/server-side-scrubbing/#geographic-information)).

Source maps aren't set up. The local npm policy blocks the Sentry CLI's postinstall download. To add them, install an approved CLI, set the secret `SENTRY_AUTH_TOKEN` in the build environment, and follow the [Expo Sentry guide](https://docs.expo.dev/guides/using-sentry/).

## Offline sync

| NetInfo state | When                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| `unknown`     | No firm reading yet, including a null initial reachability. No warning |
| `offline`     | An explicit disconnected or unreachable reading                        |
| `online`      | Connected, with internet reachability confirmed                        |

Saves always go to the durable account cache, and pending changes stay on the device when the network fails. Going `online` retries cloud sync once storage has initialized, and clears an initial account-load failure. Reconnecting still downloads cloud revisions first, and conflicts still need the user's choice. Being online doesn't mean the account service works, so a failed sync shows its own recovery state. Native auth refresh pauses while offline or in the background.

## Tests

```sh
node --experimental-strip-types --test tests/error-boundary.test.ts tests/crash-reporting.test.ts tests/connectivity.test.ts
```

Native behavior and delivery to a real Sentry project need a staging build.

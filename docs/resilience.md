# Crash recovery and offline sync

## Error boundary

The root `AppErrorBoundary` wraps the theme, connectivity, account and document providers. On a crash it shows a fixed message and a Reload button, which remounts the providers without touching saved tracking. On web, after two failed remounts, Reload refreshes the page. It catches render and lifecycle errors, not every event-handler error or a native crash. Track sends no crash reports.

## Offline sync

| NetInfo state | When                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| `unknown`     | No firm reading yet, including a null initial reachability. No warning |
| `offline`     | An explicit disconnected or unreachable reading                        |
| `online`      | Connected, with internet reachability confirmed                        |

Saves always go to the durable account cache, and pending changes stay on the device when the network fails. Going `online` retries cloud sync once storage has initialized, and clears an initial account-load failure. Reconnecting still downloads cloud revisions first, and conflicts still need the user's choice. Being online doesn't mean the account service works, so a failed sync shows its own recovery state. Native auth refresh pauses while offline or in the background.

## Tests

```sh
node --experimental-strip-types --test tests/error-boundary.test.ts tests/connectivity.test.ts
```

Native behavior needs a staging build.

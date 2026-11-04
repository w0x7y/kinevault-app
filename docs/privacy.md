# Privacy

Track keeps a local copy of each account's tracking so logging works offline.

| Data                                                                                                                                      | On the device                                                 | Uploaded                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Tracking: profile, body measurements, goals, food, water, hand-logged steps (`kinevault-track.steps-log.v1`), workouts, imported workouts | AsyncStorage on native, browser storage on web. Not encrypted | When signed in, to the account's private Supabase documents |
| Sign-in tokens                                                                                                                            | Expo SecureStore on native, localStorage on web               | No                                                          |
| Passwords                                                                                                                                 | Never saved                                                   | No                                                          |
| Profile photos and their metadata                                                                                                         | The app's private file directory on native. Not encrypted     | No                                                          |
| Reminders                                                                                                                                 | The account's local storage                                   | No                                                          |
| Rest timer length (`kinevault-track.rest-seconds`)                                                                                        | A device setting, kept after sign-out                         | No                                                          |
| Phone step count                                                                                                                          | Not stored                                                    | No                                                          |

- Account namespaces only stop one account from seeing another's records in the app. Never call them encryption, or say web localStorage protects tokens like native secure storage.
- Signing out hides the account's local records and keeps pending saves for the next sign-in. It doesn't erase them. Clearing browser storage or uninstalling can lose local-only records and pending changes.
- Don't move history into SecureStore. It's for tokens and wouldn't cover photos. App-level encryption needs a threat model and a key, migration and recovery design before it touches saved data.

## Steps

With permission, Home reads the day's step total on the device: Core Motion on iOS (Motion & Fitness; Apple keeps 7 days) and Health Connect on Android (read steps). Track reads nothing else from them, doesn't use HealthKit, and never saves, syncs or uploads phone steps. Hand-logged steps sync like the water log. The export includes them, and account deletion removes both copies.

## Workout import

On iOS and Android, Track fetches the share page straight from `app.tracked.gg`. It sends only the workout ID, with no cookies or account data, and Tracked sees the device's network address.

On web, the browser sends the workout ID, in the request body, and the session token to the `tracked-workout` Edge Function. The function checks the session, fetches the page without cookies or account data, and returns it. It doesn't store or log the ID, the page or the token. Tracked sees Supabase's network. See [workout import](workout-import.md).

## Reminders

The device's notification system schedules reminders. There's no push server or push token. Signing out cancels them and clears ones already shown; the next sign-in schedules that account's reminders again.

## Export and deletion

Settings exports tracking data and local photos. Deletion runs through the `delete-account` endpoint and removes the account's local records and photos on this device. Other devices have to be cleaned up on those devices. See [account management](account-management.md).

## Error reporting

Crash reports follow [the reporting setup](resilience.md). They carry no identity, food or workout payloads, request bodies or auth links, and use a constant `0.0.0.0` IP so Sentry can't infer location. Turn reporting on only with the configured destination, and put the vendor's retention settings in the published policy. Only local delivery is verified ([Sentry verification](sentry-verification.md)).

## Proposed privacy-policy text

> To support offline logging, KineVault Track stores a local copy of your
> profile, goals, food, water, logged steps, and workout records on your
> device. These records and locally saved profile photos are not encrypted by
> the app. Native sign-in tokens are stored separately in the device's secure
> storage. The web preview stores sign-in tokens in browser storage. Signing
> out hides your account's local tracking and keeps pending changes for your
> next sign-in. Your synced tracking is associated with your account; profile
> photos stay on this device.
> When you import a workout shared from Tracked, the iOS and Android app
> downloads the shared page directly from Tracked; only the workout ID is sent,
> without your KineVault account details. On the web, your browser sends the
> workout ID to KineVault's server, which downloads the page from Tracked for you
> and does not keep it. Reminders are scheduled on your device and are not
> uploaded. If you allow it, the app reads your daily step count from your
> phone's motion data (iOS) or Health Connect (Android) to show it on Home; that
> count stays on your device and is never uploaded. Steps you log by hand are
> synced to your account with the rest of your tracking.

The published policy still needs the operator, contact details and retention rules. Release work is in [TODO.md](../TODO.md).

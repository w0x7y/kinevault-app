# Privacy

Track keeps a local copy of each account's tracking so logging works offline.

The public policy is the `/privacy` route ([`src/app/privacy.tsx`](../src/app/privacy.tsx)), built from this page. It renders signed out, before setup, and past storage or Profile errors, because `entryRoute` treats it like the email-link routes. Settings → Data & account and the sign-in screen link to it. The web export serves it at `/privacy`. Change the page and this file together.

`/delete-account` ([`src/app/delete-account.tsx`](../src/app/delete-account.tsx)) explains account deletion for people without the app, as Google Play requires. It renders in the same states, and its button opens sign-in or, signed in, Settings. The policy's Export and deletion section links to it. Both pages use `PolicyPage`. [Web deploy](web-deploy.md) puts them online.

| Data                                                                                                                                                          | On the device                                                 | Uploaded                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Tracking: profile, body measurements, goals, food, water, hand-logged steps (`kinevault-track.steps-log.v1`), workouts, imported workouts                     | AsyncStorage on native, browser storage on web. Not encrypted | When signed in, to the account's private Supabase documents |
| Sign-in tokens                                                                                                                                                | Expo SecureStore on native, localStorage on web               | No                                                          |
| Passwords                                                                                                                                                     | Never saved                                                   | No                                                          |
| Profile photos and their metadata                                                                                                                             | The app's private file directory on native. Not encrypted     | No                                                          |
| Reminders                                                                                                                                                     | The account's local storage                                   | No                                                          |
| Rest timer length (`kinevault-track.rest-seconds`)                                                                                                            | A device setting, kept after sign-out                         | No                                                          |
| Phone step count                                                                                                                                              | Not stored                                                    | No                                                          |
| Health saving setting (`kinevault-track.health-write`) and its record list (`kinevault-track.health-written.v1`: IDs, versions, values)                       | Both in the account's local storage on this device            | No                                                          |
| Last membership read (`kinevault-track.membership.v1`: plan, status and when it was read), the 7-day offline fallback for Plus. Only once Plus is switched on | The account's local storage on this device                    | No                                                          |

- Account namespaces only stop one account from seeing another's records in the app. Never call them encryption, or say web localStorage protects tokens like native secure storage.
- Signing out hides the account's local records and keeps pending saves for the next sign-in. It doesn't erase them. Clearing browser storage or uninstalling can lose local-only records and pending changes.
- Don't move history into SecureStore. It's for tokens and wouldn't cover photos. App-level encryption needs a threat model and a key, migration and recovery design before it touches saved data.

## Steps

With permission, Home reads the day's step total on the device: Core Motion on iOS (Motion & Fitness; Apple keeps 7 days) and Health Connect on Android (read steps). Track reads nothing else from them and never saves, syncs or uploads phone steps. Hand-logged steps sync like the water log. The export includes them, and account deletion removes both copies.

## Health saving

Only when Save to Apple Health or Save to Health Connect is on, Track writes completed workouts, body-weight entries and daily water totals to the phone's health store. It asks for write access only and reads nothing back. The setting and the list of written records stay on the device and never reach Supabase or the export. Turning it off or deleting the account leaves the records already saved there; the user removes them in Health or Health Connect.

## Workout import

On iOS and Android, Track fetches the share page straight from `app.tracked.gg`. It sends only the workout ID, with no cookies or account data, and Tracked sees the device's network address.

On web, the browser sends the workout ID, in the request body, and the session token to the `tracked-workout` Edge Function. The function checks the session, fetches the page without cookies or account data, and returns it. It doesn't store or log the ID, the page or the token. Tracked sees Supabase's network. See [workout import](workout-import.md).

## Barcode lookups

A scanned or typed barcode goes straight from the device or browser to Open Food Facts (`world.openfoodfacts.org`) with no account data. Open Food Facts sees the device's network address.

## Reminders

The device's notification system schedules reminders. There's no push server or push token. Signing out cancels them and clears ones already shown; the next sign-in schedules that account's reminders again.

## Export and deletion

Settings exports tracking data and local photos. Deletion runs through the `delete-account` endpoint and removes the account's local records and photos on this device. Other devices have to be cleaned up on those devices. See [account management](account-management.md).

## Error reporting

Track sends no crash reports or analytics. A crash shows a recovery screen, and nothing about it leaves the device ([resilience](resilience.md)).

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
> If you turn on saving to Apple Health or Health Connect, the app saves your
> completed workouts, body weight and daily water there. It doesn't read your
> health data.

## Before publishing

Fill these placeholders on `/privacy` and `/delete-account`:

| Placeholder        | Where                                                  |
| ------------------ | ------------------------------------------------------ |
| `[Effective date]` | Under the title                                        |
| `[Contact email]`  | Contact, and If you can't sign in on `/delete-account` |

Health Connect's privacy policy link opens `/privacy`. Its intents (`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` through Android 13, `android.intent.action.VIEW_PERMISSION_USAGE` from Android 14) reach `MainActivity` with no URL, and React Native passes Expo Router a URL only for `ACTION_VIEW` intents. `plugins/with-health-connect-privacy-link.cjs` turns both into an `ACTION_VIEW` intent for `kinevaulttrack://privacy`, in `MainActivity.onCreate` before `super.onCreate` for a cold start and in `onNewIntent` for a running app. It needs a new Android build. On an Android 15 emulator with a local release build, Health Connect's Read privacy policy link opened Privacy policy with the app closed and with it open (2026-11-06). It hasn't run on a phone yet. Check it on Android 13 and on Android 14 or newer, once with the app closed and once with it open: Health Connect → App permissions → KineVault Track → the privacy policy link should open Privacy policy. Release work is in [TODO.md](../TODO.md).

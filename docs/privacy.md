# Tracking data on this device

## Storage decision

Track keeps an account-scoped local copy so logging works offline. Tracking
records use AsyncStorage on iOS and Android, and browser storage in the web
preview. This includes profile body measurements, goals, food, water, and
workout history. These records are not encrypted by Track. Device account
namespaces prevent one signed-in account from seeing another account's records
through the app; they are not an encryption boundary.

Native authentication tokens use Expo SecureStore separately. In the web
preview, authentication tokens use browser localStorage. Passwords are not saved
in tracking documents. Profile photos and their metadata remain on the device;
native photos use the app's private file directory. Track does not apply its own
encryption to photo files either.

For the current offline implementation, retain this storage approach and state
it plainly. Moving arbitrary history blobs into SecureStore would misuse token
storage and would not protect photo files. App-level encryption would require
an authenticated encryption format, a per-device key in native secure storage,
crash-safe migration, recovery and key-loss rules, and a separate web design.
That work should be evaluated against a defined threat model before changing
saved user data. Never describe account namespacing as encryption or claim that
web localStorage provides native token protection.

Logging out hides the account's local records. It retains pending cloud saves
for the next login; it does not erase the device copy. Clearing browser storage
or uninstalling the app can lose local-only records and pending changes. Synced
tracking is stored in the account's private Supabase documents. Photos are not
included in cloud document sync.

## Workout import

On iOS and Android, importing a Tracked share link fetches the public share
page directly from `app.tracked.gg`; no KineVault server relays the request. The
request URL carries only the workout ID from the pasted link, the request sends
no cookies, and no KineVault account data is attached. Tracked receives it like
any other page visit from the device's network address.

Browsers can't read Tracked's pages, so on the web the workout ID passes through
KineVault's `tracked-workout` Supabase Edge Function. The browser sends the ID
and the signed-in session token to the function. The function checks the
session, fetches the share page from Tracked without cookies or account data,
and returns the page to the browser, which reads it as the apps do. The function
doesn't store or log the workout ID, the page or the token. The ID travels in
the request body, not the URL. Tracked sees the request coming from Supabase's
network instead of the device.

Imported exercises and workout templates are then saved like other Account
tracking: in the local copy and, when signed in, the account's private Supabase
documents. See [workout import](workout-import.md).

## Reminders

Reminders are device settings, not Account tracking. They are stored in the
signed-in account's local storage on this device and are never uploaded.
Notifications are scheduled locally by the device's notification system; there
is no push server and no push token. Signing out cancels the scheduled
notifications and removes reminders already shown in the notification list, and
the next sign-in schedules that account's reminders again.

## Steps

Home's step count comes from the phone, with the user's permission: Core Motion
on iOS (the Motion & Fitness permission; Apple keeps the last 7 days) and Health
Connect on Android (the read-steps permission). Track reads only the step total
for the day it shows, on the device, while Home shows it. It never uploads,
syncs or saves phone steps, and it reads nothing else from Core Motion or Health
Connect. It doesn't use HealthKit.

Steps logged by hand are stored in the signed-in account's local storage on this
device (`kinevault-track.steps-log.v1`), unencrypted like other tracking. They
are not uploaded or synced to other devices, and the account export doesn't
include them yet. Account deletion's local cleanup removes them with the rest of
the account's device records; uninstalling the app or clearing its storage loses
them.

## Proposed privacy-policy text

> To support offline logging, KineVault Track stores a local copy of your
> profile, goals, food, water, and workout records on your device. These records
> and locally saved profile photos are not encrypted by the app. Native sign-in
> tokens are stored separately in the device's secure storage. The web preview
> stores sign-in tokens in browser storage. Signing out hides your account's
> local tracking and keeps pending changes for your next sign-in. Your synced
> tracking is associated with your account; profile photos stay on this device.
> When you import a workout shared from Tracked, the iOS and Android app
> downloads the shared page directly from Tracked; only the workout ID is sent,
> without your KineVault account details. On the web, your browser sends the
> workout ID to KineVault's server, which downloads the page from Tracked for you
> and does not keep it. Reminders are scheduled on your device and are not
> uploaded. If you allow it, the app reads your daily step count from your
> phone's motion data (iOS) or Health Connect (Android) to show it on Home; that
> count stays on your device. Steps you log by hand are saved only on this
> device and are not uploaded.

This is the storage disclosure for the current implementation. The published
policy still needs the product's actual operator, contact details and retention
rules. Settings now exports tracking data and local photos; account deletion runs through the deployed `delete-account` server endpoint. Confirmed deletion removes the current owner's local records and owned photos on this device; other devices' local copies require cleanup on those devices. See [account management](account-management.md). Release work is tracked in
[TODO.md](../TODO.md).

## Error reporting

Crash reporting must follow [the reporting setup](resilience.md): no user
identity, food/workout payloads, request bodies, or auth links in reports. Enable
it only with the configured reporting destination. A reporting vendor's
retention settings belong in the published policy when the service is enabled.
New reports carry a constant `0.0.0.0` IP sentinel to prevent inferred user location. Local delivery has been verified; deployed staging and native verification remain pending. See [Sentry verification](sentry-verification.md).

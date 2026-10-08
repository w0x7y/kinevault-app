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

## Proposed privacy-policy text

> To support offline logging, KineVault Track stores a local copy of your
> profile, goals, food, water, and workout records on your device. These records
> and locally saved profile photos are not encrypted by the app. Native sign-in
> tokens are stored separately in the device's secure storage. The web preview
> stores sign-in tokens in browser storage. Signing out hides your account's
> local tracking and keeps pending changes for your next sign-in. Your synced
> tracking is associated with your account; profile photos stay on this device.

This is the storage disclosure for the current implementation. The published
policy still needs the product's actual operator, contact details and retention
rules. Settings now exports tracking data and local photos; account deletion is implemented but its server endpoint remains undeployed. Confirmed deletion removes the current owner's local records and owned photos on this device; other devices' local copies require cleanup on those devices. See [account management](account-management.md). Release work is tracked in
[TODO.md](../TODO.md).

## Error reporting

Crash reporting must follow [the reporting setup](resilience.md): no user
identity, food/workout payloads, request bodies, or auth links in reports. Enable
it only with the configured reporting destination. A reporting vendor's
retention settings belong in the published policy when the service is enabled.
New reports carry a constant `0.0.0.0` IP sentinel to prevent inferred user location. Local delivery has been verified; deployed staging and native verification remain pending. See [Sentry verification](sentry-verification.md).

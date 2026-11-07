import { PolicyPage, type PolicySection } from "../components/policy-page";
import { AppText } from "../components/ui";

// Bracketed text is for the operator to fill in before the policy is published (docs/privacy.md).
const sections: PolicySection[] = [
  {
    title: "On your device",
    body: [
      "So logging works offline, the app keeps a copy of your tracking on your device:",
      [
        "your profile, goals and body measurements",
        "food, water and the steps you log by hand",
        "workouts, including workouts you import",
      ],
      "The app doesn't encrypt these records. Profile and progress photos are kept in the app's own storage on the device, also unencrypted, and are never uploaded.",
      "On iOS and Android, your sign-in token is kept in the device's secure storage. On the web, it's kept in browser storage. Your password is never saved on the device.",
      "Signing out hides your account's records on the device and keeps changes that haven't synced yet for your next sign-in. It doesn't erase them. Clearing the browser's storage or uninstalling the app can lose records and changes that haven't synced.",
    ],
  },
  {
    title: "Your account",
    body: [
      "You sign in with an email address and password, or with Google. Accounts are hosted on Supabase, which keeps your email address, your sign-in details and your membership plan. Other KineVault apps use the same account.",
      "If you continue with Google, Google shares your email address and basic profile for sign-in, and the account is linked to an existing KineVault account with the same verified email.",
      "When you're signed in, your tracking syncs to private documents in your account, so it appears on your other devices: your profile, goals, body measurements, food, water, logged steps and workouts.",
      "Photos, reminders, your phone's step count, the rest timer length and the health saving setting aren't synced.",
    ],
  },
  {
    title: "Steps",
    body: [
      "If you allow it, Home shows the day's step total from your phone: Motion & Fitness on iOS and Health Connect on Android. The app reads only the step count. It doesn't save, sync or upload it.",
      "Steps you log by hand sync to your account with the rest of your tracking.",
    ],
  },
  {
    title: "Apple Health and Health Connect",
    body: [
      "Saving to Apple Health or Health Connect is off until you turn it on in Settings. Then the app saves your completed workouts, body-weight entries and daily water totals there. It asks for write access only and reads nothing back.",
      "The setting and the list of records the app has saved stay on the device. They're never sent to your account or included in exports.",
      "Turning saving off or deleting your account leaves the records already saved. You can remove them in the Health app or in Health Connect.",
    ],
  },
  {
    title: "Workout import",
    body: [
      "When you import a workout shared from Tracked, the iOS and Android app downloads the shared page straight from Tracked. It sends only the workout ID, with no cookies or account details. Tracked sees your device's network address.",
      "On the web, your browser sends the workout ID and your sign-in token to KineVault's server. The server checks your sign-in, downloads the page from Tracked without cookies or account details, and returns it. It doesn't store or log the ID, the page or your token. Tracked sees the server's network address instead of yours.",
    ],
  },
  {
    title: "Barcode lookups",
    body: [
      "When you scan or enter a barcode, the app looks the product up on Open Food Facts. The request carries only the barcode, nothing about your account. Open Food Facts sees your device's network address.",
    ],
  },
  {
    title: "Reminders",
    body: [
      "Your device's notification system schedules reminders. There's no push server, and reminders aren't uploaded. Signing out cancels them and clears ones already shown.",
    ],
  },
  {
    title: "Export and deletion",
    body: [
      "Settings → Data & account → Export account data saves your tracking, any changes that haven't synced and this device's photos as a JSON file.",
      "Settings → Data & account → Delete account permanently deletes your KineVault account with its synced tracking and membership, and removes the account's records and photos from this device. It can't be undone. Records and photos on your other devices have to be removed on those devices, for example by clearing the app's storage or uninstalling it.",
      { label: "How to delete your account", href: "/delete-account" },
    ],
  },
  {
    title: "How long data is kept",
    body: [
      "Records on your device stay until you delete them, delete your account, clear the app's storage or uninstall the app.",
      "Your account and synced tracking are kept until you delete your account.",
    ],
  },
  {
    title: "Children",
    body: [
      "KineVault Track is for adults. Setup asks you to confirm you're 18 or older, and the app isn't meant for children.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "If this policy changes, the new version is posted on this page with a new effective date.",
    ],
  },
  {
    title: "Contact",
    body: ["Questions or requests about your data: [Contact email]."],
  },
];

/** The public privacy policy. It renders signed out, before setup and past data errors. */
export default function PrivacyPolicyScreen() {
  return (
    <PolicyPage
      title="Privacy policy"
      sections={sections}
      intro={
        <>
          <AppText variant="caption" muted>
            Effective [Effective date]
          </AppText>
          <AppText>
            Idan Gilboa runs KineVault Track, a food, water, steps and workout log for iOS, Android
            and the web. This policy explains what the app keeps on your device, what it sends to
            your account and to other services, and how to export or delete your data.
          </AppText>
        </>
      }
    />
  );
}

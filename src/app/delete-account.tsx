import { useAccount } from "../account/provider";
import { AppButton } from "../components/button";
import { PolicyPage, type PolicySection } from "../components/policy-page";
import { AppText } from "../components/ui";

// Bracketed text is for the operator to fill in before the page is published (docs/privacy.md).
const sections: PolicySection[] = [
  {
    title: "In the app",
    body: [
      "Open Settings → Data & account → Delete account.",
      [
        "Enter your current password, type DELETE and choose Permanently delete my account.",
        "If you sign in only with Google, there's no password to enter. Choose Sign in with Google again, then type DELETE and delete within 10 minutes. On Android and the web, signing in again leaves Settings, so open Delete account again when you're back.",
      ],
      "Deleting needs an internet connection.",
    ],
  },
  {
    title: "On the web",
    body: [
      "The web app works the same way. Sign in on this site, open Settings and choose Delete account.",
    ],
  },
  {
    title: "What's deleted",
    body: [
      [
        "Your KineVault account: your email address, sign-in details and membership",
        "The tracking synced to your account: profile, goals, body measurements, food, water, logged steps and workouts",
        "The account's records and photos on the device you delete it from",
      ],
      "Other KineVault apps use the same account, so you can't sign in to them with it afterwards. Deletion can't be undone.",
    ],
  },
  {
    title: "What isn't deleted",
    body: [
      [
        "Records and photos on your other devices. Remove them on each device, for example by clearing the app's storage or uninstalling it.",
        "Records already saved to Apple Health or Health Connect. Remove them in the Health app or in Health Connect.",
        "Crash reports, if the app sent any. They carry nothing that identifies you, so they aren't linked to your account. Sentry keeps them for [Retention period].",
      ],
    ],
  },
  {
    title: "Export your data first",
    body: [
      "Settings → Data & account → Export account data saves your tracking, any changes that haven't synced and this device's photos as a JSON file. Export before you delete if you want a copy.",
    ],
  },
  {
    title: "If you can't sign in",
    body: [
      "Choose Forgot password? on the sign-in screen to reset your password. If you still can't sign in, email [Contact email] with the address you sign in with and ask for your account to be deleted.",
    ],
  },
];

/** How to delete an account, for the store listings. It renders signed out, before setup and past data errors. */
export default function DeleteAccountScreen() {
  const { user } = useAccount();
  return (
    <PolicyPage
      title="Delete your account"
      sections={sections}
      intro={
        <>
          <AppText>
            You can delete your KineVault Track account and the data synced to it yourself, in the
            iOS or Android app or on this website.
          </AppText>
          {user ? (
            <AppButton label="Open Settings" tone="primary" icon="gear" href="/settings" />
          ) : (
            <AppButton
              label="Sign in to delete your account"
              tone="primary"
              icon="right-to-bracket"
              href="/account"
            />
          )}
        </>
      }
    />
  );
}

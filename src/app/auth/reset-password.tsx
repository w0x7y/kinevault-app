import { useState } from "react";
import { Keyboard, View } from "react-native";
import { router, type Href } from "expo-router";
import { useAccount } from "../../account/provider";
import { AppText } from "../../components/ui";
import { AppButton } from "../../components/button";
import { InlineMessage } from "../../components/inline-message";
import { TextField } from "../../components/text-field";
import { StatusScreen } from "../../onboarding/status-screen";
import { spacing } from "../../theme/tokens";

export default function ResetPasswordScreen() {
  const account = useAccount();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function save() {
    if (account.busy || saved) return;
    Keyboard.dismiss();
    if (password !== confirmation) {
      setError("The passwords don't match.");
      return;
    }
    setError(null);
    if (await account.updatePassword(password)) {
      setPassword("");
      setConfirmation("");
      setSaved(true);
    }
  }
  const canReset = Boolean(account.session && account.recovery);
  async function leave() {
    if (account.busy || account.loading) return;
    // A recovery session cannot return to normal account routing unchanged:
    // that routing deliberately redirects it straight back to this screen.
    if (canReset && !(await account.signOut())) return;
    setPassword("");
    setConfirmation("");
    router.replace("/account" as Href);
  }
  return (
    <StatusScreen
      icon={saved ? "check" : "key"}
      tone={saved ? "success" : "brand"}
      title={saved ? "Password updated" : "Choose a new password"}
      documentTitle={saved ? "Password updated" : "Choose a new password"}
      message={
        account.loading ? (
          <AppText muted style={{ textAlign: "center" }}>
            Loading your account…
          </AppText>
        ) : saved ? (
          <AppText role="status" accessibilityLiveRegion="polite" style={{ textAlign: "center" }}>
            Your new password is ready to use in KineVault.
          </AppText>
        ) : canReset ? (
          <AppText muted style={{ textAlign: "center" }}>
            Use at least 10 characters. This password belongs to your KineVault account.
          </AppText>
        ) : (
          <AppText accessibilityRole="alert" muted style={{ textAlign: "center" }}>
            Open the password reset link from your email before choosing a new password.
          </AppText>
        )
      }
    >
      <View style={{ gap: spacing.md }}>
        {!account.loading && !saved && canReset && (
          <>
            <TextField
              size="large"
              label="New password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                setError(null);
                account.clearFeedback();
              }}
              kind="password"
              autoComplete="new-password"
              disabled={account.busy}
            />
            <TextField
              size="large"
              label="Confirm new password"
              value={confirmation}
              onChange={(value) => {
                setConfirmation(value);
                setError(null);
              }}
              kind="password"
              autoComplete="new-password"
              disabled={account.busy}
              onSubmit={() => void save()}
            />
            <InlineMessage>{error ?? account.error}</InlineMessage>
            <View style={{ marginTop: spacing.xs }}>
              <AppButton
                label={account.busy ? "Updating password…" : "Save new password"}
                tone="primary"
                disabled={account.busy}
                onPress={() => void save()}
              />
            </View>
          </>
        )}
        <AppButton
          label={saved ? "Continue" : account.busy ? "Please wait…" : "Back to account"}
          tone={!saved && canReset ? "secondary" : "primary"}
          disabled={account.busy || account.loading}
          onPress={() => void leave()}
        />
      </View>
    </StatusScreen>
  );
}

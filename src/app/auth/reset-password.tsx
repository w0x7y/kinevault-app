import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { useAccount } from "../../account/provider";
import { AppText } from "../../components/ui";
import { Button, Field } from "../../onboarding/controls";
import { useTheme } from "../../theme/provider";
import { spacing } from "../../theme/tokens";

export default function ResetPasswordScreen() {
  const account = useAccount();
  const { colors } = useTheme();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: spacing.layout,
            gap: spacing.layout,
            width: "100%",
            maxWidth: 560,
            alignSelf: "center",
          }}
        >
          <AppText variant="title" accessibilityRole="header">
            {saved ? "Password updated" : "Choose a new password"}
          </AppText>
          {account.loading ? (
            <AppText muted>Loading your account…</AppText>
          ) : saved ? (
            <AppText role="status" accessibilityLiveRegion="polite">
              Your new password is ready to use in KineVault.
            </AppText>
          ) : canReset ? (
            <>
              <AppText muted>
                Use at least 10 characters. This password belongs to your KineVault account.
              </AppText>
              <View style={{ gap: spacing.layout }}>
                <Field
                  label="New password"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError(null);
                    account.clearFeedback();
                  }}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!account.busy}
                />
                <Field
                  label="Confirm new password"
                  value={confirmation}
                  onChangeText={(value) => {
                    setConfirmation(value);
                    setError(null);
                  }}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!account.busy}
                  returnKeyType="done"
                  onSubmitEditing={() => void save()}
                />
              </View>
              {(error || account.error) && (
                <AppText accessibilityRole="alert" style={{ color: colors.error }}>
                  {error ?? account.error}
                </AppText>
              )}
              <Button
                label={account.busy ? "Updating password…" : "Save new password"}
                disabled={account.busy}
                onPress={() => void save()}
              />
            </>
          ) : (
            <AppText accessibilityRole="alert">
              Open the password reset link from your email before choosing a new password.
            </AppText>
          )}
          <Button
            label={saved ? "Continue" : account.busy ? "Please wait…" : "Back to account"}
            secondary={!saved}
            disabled={account.busy || account.loading}
            onPress={() => void leave()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

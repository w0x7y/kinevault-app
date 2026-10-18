import { useState } from "react";
import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { AppButton } from "../components/button";
import { InlineMessage } from "../components/inline-message";
import { StatusScreen } from "../onboarding/status-screen";
import { spacing } from "../theme/tokens";
import { useProfile, useProfilePersistence } from "./provider";
import { useAccount } from "../account/provider";

export function ProfileRecovery() {
  const { retryLoad, saving, error } = useProfile();
  const { reset } = useProfilePersistence();
  const account = useAccount();
  const { user } = account;
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <StatusScreen
      icon="user-shield"
      title="Couldn't load your profile"
      documentTitle="Profile"
      message="Your saved answers haven't been changed. Try loading them again."
    >
      <View style={{ gap: spacing.md }}>
        <AppButton
          label="Try again"
          tone="primary"
          icon="rotate-right"
          onPress={retryLoad}
          disabled={saving}
        />
        {confirmReset ? (
          <Panel style={{ gap: spacing.md }}>
            <AppText accessibilityRole="alert">
              {user
                ? "Starting fresh removes this account's saved profile and goals from this device and cloud storage, then opens setup again."
                : "Starting fresh removes this device's saved profile and opens setup again."}
            </AppText>
            <AppButton
              label={saving ? "Resetting…" : "Reset saved profile"}
              tone="destructive"
              icon="trash-can"
              onPress={() => void reset()}
              disabled={saving}
            />
            <AppButton
              label="Keep my profile"
              icon="user-shield"
              onPress={() => setConfirmReset(false)}
              disabled={saving}
            />
          </Panel>
        ) : (
          <AppButton label="Start fresh" icon="rotate-left" onPress={() => setConfirmReset(true)} />
        )}
        {error && <InlineMessage>{error}</InlineMessage>}
        {user && (
          <AppButton
            label={account.busy ? "Signing out…" : "Log out"}
            icon="right-from-bracket"
            disabled={saving || account.busy}
            onPress={() => void account.signOut()}
          />
        )}
        {account.error && <InlineMessage>{account.error}</InlineMessage>}
      </View>
    </StatusScreen>
  );
}

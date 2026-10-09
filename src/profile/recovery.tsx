import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../components/ui";
import { Button } from "../onboarding/controls";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { useProfile } from "./provider";
import { useAccount } from "../account/provider";

export function ProfileRecovery() {
  const { colors } = useTheme();
  const { retryLoad, reset, saving, error } = useProfile();
  const account = useAccount();
  const { user } = account;
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignSelf: "center",
          width: "100%",
          maxWidth: 480,
          padding: spacing.layout,
          gap: spacing.layout,
        }}
      >
        <AppText variant="title" accessibilityRole="header">
          Couldn't load your profile
        </AppText>
        <AppText muted>Your saved answers haven't been changed. Try loading them again.</AppText>
        <Button label="Try again" icon="rotate-right" onPress={retryLoad} disabled={saving} />
        {confirmReset ? (
          <View style={{ gap: spacing.layout }}>
            <AppText accessibilityRole="alert">
              {user
                ? "Starting fresh removes this account's saved profile and goals from this device and cloud storage, then opens setup again."
                : "Starting fresh removes this device's saved profile and opens setup again."}
            </AppText>
            <Button
              label={saving ? "Resetting…" : "Reset saved profile"}
              destructive
              icon="trash-can"
              onPress={() => void reset()}
              disabled={saving}
            />
            <Button
              label="Keep my profile"
              icon="user-shield"
              secondary
              onPress={() => setConfirmReset(false)}
              disabled={saving}
            />
          </View>
        ) : (
          <Button
            label="Start fresh"
            icon="rotate-left"
            secondary
            onPress={() => setConfirmReset(true)}
          />
        )}
        {error && (
          <AppText accessibilityRole="alert" style={{ color: colors.error }}>
            {error}
          </AppText>
        )}
        {user && (
          <Button
            label={account.busy ? "Signing out…" : "Log out"}
            secondary
            disabled={saving || account.busy}
            onPress={() => void account.signOut()}
          />
        )}
        {account.error && (
          <AppText accessibilityRole="alert" style={{ color: colors.error }}>
            {account.error}
          </AppText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

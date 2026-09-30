import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../components/ui";
import { Button } from "../onboarding/controls";
import { useTheme } from "../theme/provider";
import { useProfile } from "./provider";

export function ProfileRecovery() {
  const { colors } = useTheme();
  const { retryLoad, reset, saving, error } = useProfile();
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignSelf: "center",
          width: "100%",
          maxWidth: 480,
          padding: 24,
          gap: 24,
        }}
      >
        <AppText variant="title" accessibilityRole="header">
          Couldn't load your profile
        </AppText>
        <AppText muted>
          Your saved answers haven't been changed. Try loading them again.
        </AppText>
        <Button label="Try again" onPress={retryLoad} disabled={saving} />
        {confirmReset ? (
          <View style={{ gap: 12 }}>
            <AppText accessibilityRole="alert">
              Starting fresh removes this device's saved profile and opens setup
              again.
            </AppText>
            <Button
              label={saving ? "Resetting…" : "Reset saved profile"}
              onPress={() => void reset()}
              disabled={saving}
            />
            <Button
              label="Keep my profile"
              secondary
              onPress={() => setConfirmReset(false)}
              disabled={saving}
            />
          </View>
        ) : (
          <Button
            label="Start fresh"
            secondary
            onPress={() => setConfirmReset(true)}
          />
        )}
        {error && (
          <AppText accessibilityRole="alert" style={{ color: colors.error }}>
            {error}
          </AppText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

import { SafeAreaView } from "react-native-safe-area-context";
import { useAccount } from "../account/provider";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { useConnectivity } from "./provider";

export function OfflineNotice() {
  const status = useConnectivity();
  const { user } = useAccount();
  const { colors } = useTheme();
  if (status !== "offline") return null;
  return (
    <SafeAreaView
      edges={["top"]}
      style={{
        paddingHorizontal: spacing.layout,
        paddingVertical: spacing.sm,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <AppText variant="caption" accessibilityRole="alert" accessibilityLiveRegion="polite">
        {user
          ? "You're offline. Saved changes stay on this device. Sync retries when you reconnect."
          : "You're offline. Sign-in needs an internet connection."}
      </AppText>
    </SafeAreaView>
  );
}

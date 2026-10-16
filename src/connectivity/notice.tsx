import { View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccount } from "../account/provider";
import { Icon } from "../components/icon";
import { AppText } from "../components/ui";
import { useAppear } from "../components/motion";
import { useTheme } from "../theme/provider";
import { fonts, spacing } from "../theme/tokens";
import { useConnectivity } from "./provider";

/** A slim strip above the app chrome, so it never covers the header's controls. */
export function OfflineNotice() {
  const status = useConnectivity();
  const { user } = useAccount();
  const { appearance } = useTheme();
  // It drops in from the top edge it's attached to, so the shift below it reads as caused.
  const appear = useAppear("drop", { duration: 240 });
  if (status !== "offline") return null;
  const dark = appearance === "dark";
  // Honey tint: reads as a caution without the alarm of an error.
  const tint = dark ? "#2a2216" : "#f6ecd9";
  const ink = dark ? "#f0c27a" : "#6b4210";
  return (
    <Animated.View style={appear}>
      <SafeAreaView
        edges={["top"]}
        style={{
          backgroundColor: tint,
          borderBottomWidth: 1,
          borderBottomColor: dark ? "#3a2e1c" : "#ead9b8",
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 768,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.gutter,
            paddingVertical: spacing.sm,
          }}
        >
          <Icon name="cloud" size={16} color={ink} />
          <AppText
            variant="caption"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ flex: 1, color: ink, fontFamily: fonts.semibold }}
          >
            {user
              ? "You're offline. Saved changes stay on this device. Sync retries when you reconnect."
              : "You're offline. Sign-in needs an internet connection."}
          </AppText>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

import { Image } from "expo-image";
import { View } from "react-native";
import { kineAssets } from "../onboarding/kine-assets";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";

export function KineLoading({
  label = "Loading KineVault...",
  compact = false,
  fill = false,
}: {
  label?: string;
  compact?: boolean;
  fill?: boolean;
}) {
  const { colors } = useTheme();
  const size = compact ? 104 : 152;
  return (
    <View
      testID="kine-loading"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      aria-busy
      aria-live="polite"
      style={{
        flex: fill ? 1 : undefined,
        minHeight: compact ? 128 : 200,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.layout,
        backgroundColor: fill ? colors.background : undefined,
      }}
    >
      <Image
        source={kineAssets.loading}
        contentFit="contain"
        priority="high"
        loading="eager"
        cachePolicy="memory-disk"
        transition={0}
        accessible={false}
        aria-hidden
        style={{ width: size, height: size }}
      />
    </View>
  );
}

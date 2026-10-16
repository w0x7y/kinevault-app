import { Image } from "expo-image";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { cssEaseInOut, useReducedMotion } from "./motion";
import { kineAssets } from "../onboarding/kine-assets";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

// A slow bob says the app is still working; it loops only while something is loading.
const bob = {
  animationName: {
    from: { transform: [{ translateY: 0 }] },
    to: { transform: [{ translateY: -5 }] },
  },
  animationDuration: 1100,
  animationIterationCount: "infinite",
  animationDirection: "alternate",
  // Reanimated on native accepts only named curves or cubicBezier() objects, not CSS strings.
  animationTimingFunction: cssEaseInOut,
} as const;

/** Kine resting on a soft brand disc while data loads. The label is for assistive tech only.
 * Kine bobs gently on the disc unless motion is reduced. */
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
  const reduced = useReducedMotion();
  const size = compact ? 96 : 140;
  const stage = Math.round(size * 1.18);
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
      <View
        style={{
          width: stage,
          height: stage,
          borderRadius: radius.pill,
          backgroundColor: colors.brandSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View style={reduced ? undefined : bob}>
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
        </Animated.View>
      </View>
    </View>
  );
}

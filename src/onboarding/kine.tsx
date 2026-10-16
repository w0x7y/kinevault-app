import { memo, useEffect } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useIsFocused } from "expo-router";
import { useReducedMotion } from "../components/motion";
import { useTheme } from "../theme/provider";
import { kineAssets, warmUpcomingKine, type KinePose } from "./kine-assets";
export type { KinePose } from "./kine-assets";

export const Kine = memo(function Kine({
  size = 152,
  pose = "welcome",
}: {
  size?: number;
  pose?: KinePose;
}) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const { appearance } = useTheme();
  const greeting = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(greeting);
    greeting.set(0);
    if (!reduced && focused) {
      greeting.set(
        withSequence(
          ReduceMotion.Never,
          withTiming(1, {
            duration: 180,
            easing: Easing.out(Easing.quad),
            reduceMotion: ReduceMotion.Never,
          }),
          withTiming(-0.3, {
            duration: 210,
            easing: Easing.inOut(Easing.quad),
            reduceMotion: ReduceMotion.Never,
          }),
          withTiming(0, {
            duration: 180,
            easing: Easing.out(Easing.quad),
            reduceMotion: ReduceMotion.Never,
          }),
        ),
      );
    }
    return () => cancelAnimation(greeting);
  }, [pose, greeting, reduced, focused]);
  const livelyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduced ? 0 : -6 * greeting.get() },
      { rotate: `${reduced ? 0 : 3 * greeting.get()}deg` },
      { scale: 1 + (reduced ? 0 : 0.025 * greeting.get()) },
    ],
  }));
  const shadowWidth = size * 0.56;
  const shadowHeight = size * 0.065;
  return (
    <Animated.View
      testID={`kine-${pose}`}
      style={[{ width: size, height: size, flexShrink: 0 }, livelyStyle]}
    >
      <View
        accessible={false}
        aria-hidden={true}
        style={{
          position: "absolute",
          pointerEvents: "none",
          left: size * 0.245,
          bottom: size * 0.015 - (shadowWidth - shadowHeight) / 2,
          width: shadowWidth,
          height: shadowWidth,
          borderRadius: size,
          // A soft contact shadow that reads on light and dark pages alike.
          backgroundColor: appearance === "dark" ? "rgba(0, 0, 0, 0.55)" : "rgba(22, 24, 28, 0.16)",
          // Flatten a circle into an ellipse on both native and web.
          transform: [{ scaleY: shadowHeight / shadowWidth }],
        }}
      />
      <Image
        source={kineAssets[pose]}
        contentFit="contain"
        cachePolicy="memory-disk"
        priority="high"
        loading="eager"
        transition={0}
        recyclingKey={pose}
        onLoad={() => warmUpcomingKine(pose)}
        accessibilityLabel="Kine, your friendly blue companion"
        accessible={false}
        aria-hidden={true}
        style={{ width: size, height: size }}
      />
    </Animated.View>
  );
});

/** Kine standing on a soft brand-tinted disc. The disc stays still while Kine greets. */
export function KineStage({ size = 136, pose = "welcome" }: { size?: number; pose?: KinePose }) {
  const { colors } = useTheme();
  const disc = Math.round(size * 0.86);
  return (
    <View
      accessible={false}
      aria-hidden={true}
      style={{ width: size, height: size, alignSelf: "center", flexShrink: 0 }}
    >
      <View
        style={{
          position: "absolute",
          pointerEvents: "none",
          left: (size - disc) / 2,
          top: size * 0.08,
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          backgroundColor: colors.brandSoft,
        }}
      />
      <Kine size={size} pose={pose} />
    </View>
  );
}

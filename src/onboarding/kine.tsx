import { memo, useEffect } from "react";
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
  return (
    <Animated.View
      testID={`kine-${pose}`}
      style={[{ width: size, height: size, flexShrink: 0 }, livelyStyle]}
    >
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

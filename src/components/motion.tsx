import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AccessibilityInfo, Platform, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export const motionEase = Easing.bezier(0.23, 1, 0.32, 1);
const MotionContext = createContext(true);

// This live preference owns animation policy. Reanimated's System value is
// captured at startup and does not follow browser media changes on its own.

export function MotionProvider({ children }: PropsWithChildren) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (Platform.OS === "web") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(media.matches);
      const changed = () => setReduced(media.matches);
      media.addEventListener("change", changed);
      return () => media.removeEventListener("change", changed);
    }
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return (
    <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>
  );
}

export function useReducedMotion() {
  return useContext(MotionContext);
}

// One question arrives at a time. Inputs keep their identity while being edited.
export function PageTransition({
  children,
  direction = 1,
  style,
  testID,
}: PropsWithChildren<{ direction?: number; style?: ViewStyle; testID?: string }>) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);
  useEffect(() => {
    progress.set(reduced ? 1 : 0);
    if (!reduced)
      progress.set(
        withTiming(1, {
          duration: 220,
          easing: motionEase,
          reduceMotion: ReduceMotion.Never,
        }),
      );
    return () => cancelAnimation(progress);
  }, [progress, reduced]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.65 + progress.get() * 0.35,
    transform: [
      { translateX: reduced ? 0 : direction * 16 * (1 - progress.get()) },
    ],
  }));
  return (
    <Animated.View testID={testID} style={[style, animatedStyle]}>{children}</Animated.View>
  );
}

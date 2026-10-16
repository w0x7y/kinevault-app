import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  AccessibilityInfo,
  Platform,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  cancelAnimation,
  cubicBezier,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type EasingFunctionFactory,
} from "react-native-reanimated";

/** Strong ease-out for anything entering or settling. */
export const motionEase = Easing.bezier(0.23, 1, 0.32, 1);
/** For elements moving or morphing while on screen. */
export const motionEaseInOut = Easing.bezier(0.77, 0, 0.175, 1);
export const motionDuration = { press: 120, toggle: 180, enter: 300, value: 650 };
/**
 * The same curves for Reanimated CSS animations and transitions. Native accepts only predefined
 * names or these objects; a "cubic-bezier(...)" string throws there.
 */
export const cssEase = cubicBezier(0.23, 1, 0.32, 1);
export const cssEaseInOut = cubicBezier(0.77, 0, 0.175, 1);
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
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
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
    transform: [{ translateX: reduced ? 0 : direction * 16 * (1 - progress.get()) }],
  }));
  return (
    <Animated.View testID={testID} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

/**
 * Layout animations for content that appears, leaves or reflows (cards on first load, a logged
 * food joining its meal). With reduced motion they are all undefined, so nothing moves.
 */
export function useLayoutMotion() {
  const reduced = useReducedMotion();
  if (reduced)
    return { enter: () => undefined, fade: undefined, exit: undefined, layout: undefined };
  return {
    /**
     * A short rise and fade, staggered by position for groups of cards. It stays the built-in
     * FadeInDown: on web, Reanimated pins an element with a custom entering keyframe (such as
     * `withInitialValues`) absolutely at its old position once the animation is cleaned up.
     */
    enter: (index = 0) =>
      FadeInDown.duration(motionDuration.enter)
        .delay(Math.min(index, 6) * 45)
        .easing(motionEase)
        .reduceMotion(ReduceMotion.Never),
    fade: FadeIn.duration(200).easing(motionEase).reduceMotion(ReduceMotion.Never),
    exit: FadeOut.duration(160).reduceMotion(ReduceMotion.Never),
    layout: LinearTransition.duration(220).easing(motionEaseInOut).reduceMotion(ReduceMotion.Never),
  };
}

/**
 * Animates a 0–1 progress value toward its target whenever it changes, starting from 0 on mount
 * so a value is explained as it appears. Reduced motion jumps straight to the target.
 */
export function useProgressValue(target: number) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(progress);
      progress.set(target);
      return;
    }
    progress.set(
      withTiming(target, {
        duration: motionDuration.value,
        // Clamped: on web a timing can start between frames and briefly run the curve backwards.
        easing: clampedEasing(motionEase),
        reduceMotion: ReduceMotion.Never,
      }),
    );
  }, [progress, reduced, target]);
  return progress;
}

/**
 * The filled part of a progress track: absolutely positioned and childless, so animating its
 * width never re-lays-out its neighbours. `fraction` is clamped to 0–1.
 */
export function ProgressFill({
  fraction,
  color,
  style,
  testID,
}: {
  fraction: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const progress = useProgressValue(Math.max(0, Math.min(1, fraction)));
  const animated = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return (
    <Animated.View
      testID={testID}
      style={[
        { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: color },
        style,
        animated,
      ]}
    />
  );
}

const appearKeyframes = {
  fade: { from: { opacity: 0 }, to: { opacity: 1 } },
  /** A small mark arriving: a check dot, a badge. */
  pop: {
    from: { opacity: 0, transform: [{ scale: 0.9 }] },
    to: { opacity: 1, transform: [{ scale: 1 }] },
  },
  /** A strip arriving from the top edge. */
  drop: {
    from: { opacity: 0, transform: [{ translateY: -8 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
} as const;

/**
 * A one-off entrance that plays when the element mounts: spread into an Animated component's
 * style. Undefined under reduced motion, so the element simply appears.
 */
export function useAppear(
  kind: keyof typeof appearKeyframes,
  {
    duration = motionDuration.toggle,
    delay = 0,
    easing = cssEase,
  }: { duration?: number; delay?: number; easing?: typeof cssEase } = {},
) {
  const reduced = useReducedMotion();
  return useMemo(
    () =>
      reduced
        ? undefined
        : {
            animationName: appearKeyframes[kind],
            animationDuration: duration,
            animationDelay: delay,
            animationTimingFunction: easing,
            animationFillMode: "backwards" as const,
          },
    [reduced, kind, duration, delay, easing],
  );
}

/**
 * Eases state-driven style changes (a selected card's border and fill, a switch's thumb) instead
 * of snapping. Spread into an Animated component's style; undefined under reduced motion.
 */
export function useStateTransition(
  properties: readonly ("backgroundColor" | "borderColor" | "transform" | "opacity")[],
  duration = motionDuration.toggle,
) {
  const reduced = useReducedMotion();
  const key = properties.join(",");
  return useMemo(
    () =>
      reduced
        ? undefined
        : {
            transitionProperty: key.split(",") as (typeof properties)[number][],
            transitionDuration: duration,
            transitionTimingFunction: cssEase,
          },
    [reduced, key, duration],
  );
}

/**
 * Content of a page whose steps replace each other in place (create, then the saved item; an
 * import moving to its preview). Each new `step` fades in over 200 ms; the first step arrives
 * with its sheet and doesn't fade. Children remount when `step` changes. Still under reduced
 * motion.
 */
export function StepFade({
  step,
  style,
  children,
  ...props
}: PropsWithChildren<
  { step: string | number; style?: StyleProp<ViewStyle> } & Pick<ViewProps, "onLayout" | "testID">
>) {
  const { fade } = useLayoutMotion();
  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View key={step} entering={fade} style={style} {...props}>
        {children}
      </Animated.View>
    </LayoutAnimationConfig>
  );
}

/**
 * Holds a timing curve at its start for time before the start. On web a timing animation begun
 * between frames can be stepped with a frame timestamp earlier than its own start, and an
 * unclamped bezier then runs backwards past the start value for a frame.
 */
export function clampedEasing(easing: EasingFunctionFactory) {
  const curve = easing.factory();
  return (time: number) => {
    "worklet";
    return curve(Math.min(1, Math.max(0, time)));
  };
}

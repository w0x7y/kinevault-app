import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, usePathname, type Href } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewInstance,
} from "react-native";
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppButton, IconButton } from "../components/button";
import { clampedEasing, motionEase, useLayoutMotion, useReducedMotion } from "../components/motion";
import { AppText, Overline } from "../components/ui";
import { useTheme } from "../theme/provider";
import { cardShadow, radius, spacing } from "../theme/tokens";
import { bubblePlacement, spotlight, type Box } from "./layout";
import { isChrome, tourSteps, type TourTargetId } from "./steps";
import { TourTargets } from "./targets";

/** Set once the App tour is finished or skipped on this device. A device setting; it never syncs. */
const storageKey = "kinevault-track.app-tour";
const steps = tourSteps(Platform.OS);
/** A step's screen may still be mounting, loading or rising in, so it is measured a few times. */
const measureDelays = [0, 60, 200, 450, 900];
/** The dim is the border of one view around the highlight; this is wider than any screen. */
const dimBorder = 4000;
const ease = clampedEasing(motionEase);

type TargetRef = RefObject<ViewInstance | null>;

const StartTour = createContext<() => void>(() => {});

/** Starts the App tour again, as Settings does. */
export function useStartTour() {
  return useContext(StartTour);
}

/**
 * Shows the App tour the first time the tabs open on this device, and again on request. It dims
 * the app around one tagged view at a time and explains it in a bubble. Tapping the highlight,
 * or Next, moves on; steps on another screen switch to it, and closing returns to where it began.
 * `insets` are the header and tab bar heights, which content scrolls between.
 */
export function AppTourProvider({
  insets,
  children,
}: PropsWithChildren<{ insets: { top: number; bottom: number } }>) {
  const pathname = usePathname();
  const here = useRef(pathname);
  useLayoutEffect(() => {
    here.current = pathname;
  });
  const origin = useRef(pathname);
  const [index, setIndex] = useState<number | null>(null);
  const targets = useRef(new Map<TourTargetId, TargetRef>());
  const showing = useRef<TourTargetId | null>(null);
  showing.current = index === null ? null : steps[index]!.target;
  // Bumped when the shown step's view mounts, so the overlay measures it again.
  const [arrivals, setArrivals] = useState(0);
  const registry = useMemo(
    () => ({
      add(id: TourTargetId, target: TargetRef) {
        targets.current.set(id, target);
        if (showing.current === id) setArrivals((count) => count + 1);
        return () => {
          if (targets.current.get(id) === target) targets.current.delete(id);
        };
      },
    }),
    [],
  );
  const show = useCallback((next: number) => {
    setIndex(next);
    router.navigate(steps[next]!.path);
  }, []);
  const start = useCallback(() => {
    origin.current = here.current;
    show(0);
  }, [show]);
  const close = useCallback(() => {
    setIndex(null);
    router.navigate(origin.current as Href);
    // A lost write only means the tour shows again on the next launch.
    AsyncStorage.setItem(storageKey, "seen").catch(() => {});
  }, []);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(storageKey)
      .then((saved) => {
        if (live && saved === null) start();
      })
      // Unreadable storage skips the tour rather than risk showing it on every launch.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [start]);
  const active = index !== null;
  useEffect(() => {
    if (!active) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    if (Platform.OS === "web") document.addEventListener("keydown", escape);
    return () => {
      back.remove();
      if (Platform.OS === "web") document.removeEventListener("keydown", escape);
    };
  }, [active, close]);
  // The app behind can't be reached by screen readers or, on the web, the keyboard.
  const behind = useRef<ViewInstance>(null);
  useEffect(() => {
    if (Platform.OS === "web" && behind.current)
      (behind.current as unknown as HTMLElement).inert = active;
  }, [active]);
  return (
    <TourTargets.Provider value={registry}>
      <StartTour.Provider value={start}>
        <View style={{ flex: 1 }}>
          {/* Never flattened, so hiding it doesn't rebuild the app's native views. */}
          <View ref={behind} collapsable={false} aria-hidden={active} style={{ flex: 1 }}>
            {children}
          </View>
          {index !== null && (
            <TourOverlay
              index={index}
              target={targets.current.get(steps[index]!.target)}
              arrivals={arrivals}
              insets={insets}
              onBack={() => show(index - 1)}
              onNext={() => (index === steps.length - 1 ? close() : show(index + 1))}
              onSkip={close}
            />
          )}
        </View>
      </StartTour.Provider>
    </TourTargets.Provider>
  );
}

function TourOverlay({
  index,
  target,
  arrivals,
  insets,
  onBack,
  onNext,
  onSkip,
}: {
  index: number;
  target: TargetRef | undefined;
  arrivals: number;
  insets: { top: number; bottom: number };
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const step = steps[index]!;
  const last = index === steps.length - 1;
  const { colors, appearance } = useTheme();
  const reduced = useReducedMotion();
  const motion = useLayoutMotion();
  const screen = useWindowDimensions();
  const root = useRef<ViewInstance>(null);
  const next = useRef<ViewInstance>(null);
  // What the current step measured: undefined while looking, null when its view isn't on screen.
  const [found, setFound] = useState<{ index: number; box: Box | null }>();
  useEffect(() => {
    let live = true;
    const chrome = isChrome(step.target);
    const settle = (box: Box | null, final: boolean) => {
      if (!live || (!box && !final)) return;
      setFound((previous) =>
        previous?.index === index && sameBox(previous.box, box) ? previous : { index, box },
      );
    };
    const measure = (final: boolean) =>
      root.current?.measureInWindow((left, top, width, height) => {
        const view = target?.current;
        if (!view) return settle(null, final);
        view.measureInWindow((x, y, w, h) =>
          settle(
            spotlight(
              { x: x - left, y: y - top, width: w, height: h },
              chrome ? 2 : 6,
              chrome
                ? { top: 0, bottom: height, width }
                : { top: insets.top, bottom: height - insets.bottom, width },
            ),
            final,
          ),
        );
      });
    const timers = measureDelays.map((delay, attempt) =>
      setTimeout(() => measure(attempt === measureDelays.length - 1), delay),
    );
    return () => {
      live = false;
      timers.forEach(clearTimeout);
    };
  }, [
    index,
    target,
    step.target,
    insets.top,
    insets.bottom,
    arrivals,
    screen.width,
    screen.height,
  ]);
  const box = found?.index === index ? found.box : undefined;

  // The highlight glides from one view to the next; it opens from a point the first time.
  const x = useSharedValue(screen.width / 2);
  const y = useSharedValue(screen.height / 2);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  useEffect(() => {
    if (box === undefined) return;
    const to = box ?? { x: screen.width / 2, y: screen.height / 2, width: 0, height: 0 };
    for (const [value, end] of [
      [x, to.x],
      [y, to.y],
      [width, to.width],
      [height, to.height],
    ] as const)
      value.set(
        reduced
          ? end
          : withTiming(end, { duration: 320, easing: ease, reduceMotion: ReduceMotion.Never }),
      );
  }, [box, reduced, screen.width, screen.height, x, y, width, height]);
  const corner = (w: number, h: number) => {
    "worklet";
    return Math.min(radius.panel, w / 2, h / 2);
  };
  const dimStyle = useAnimatedStyle(() => ({
    left: x.get() - dimBorder,
    top: y.get() - dimBorder,
    width: width.get() + dimBorder * 2,
    height: height.get() + dimBorder * 2,
    borderRadius: corner(width.get(), height.get()) + dimBorder,
  }));
  const holeStyle = useAnimatedStyle(() => ({
    left: x.get(),
    top: y.get(),
    width: width.get(),
    height: height.get(),
  }));
  const ringStyle = useAnimatedStyle(() => ({ borderRadius: corner(width.get(), height.get()) }));
  // A ring keeps spreading from the highlight to say it can be tapped.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    pulse.set(
      withRepeat(
        withTiming(1, { duration: 1400, easing: ease, reduceMotion: ReduceMotion.Never }),
        -1,
      ),
    );
    return () => cancelAnimation(pulse);
  }, [reduced, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.8 * (1 - pulse.get()),
    transform: [{ scale: 1 + 0.08 * pulse.get() }],
  }));

  // Each step's bubble arrives once its view is measured: the web focuses Next, phones announce it.
  const arrived = box !== undefined;
  useEffect(() => {
    if (!arrived) return;
    if (Platform.OS === "web") (next.current as unknown as HTMLElement | null)?.focus();
    else AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.text}`);
  }, [arrived, step]);

  const placement = bubblePlacement(box ?? null, screen);
  return (
    <Animated.View
      ref={root}
      entering={motion.fade}
      exiting={motion.exit}
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, { overflow: "hidden", zIndex: 2 }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.dim,
          {
            borderColor: appearance === "dark" ? "rgba(0, 0, 0, 0.66)" : "rgba(14, 15, 17, 0.55)",
          },
          dimStyle,
        ]}
      />
      <Animated.View style={[styles.hole, holeStyle]}>
        {/* For pointers only: Next in the bubble does the same for keyboards and screen readers.
            It waits for the step's bubble, so a quick second tap can't skip a step unseen. */}
        <Pressable
          testID="app-tour-highlight"
          accessible={false}
          importantForAccessibility="no"
          tabIndex={-1}
          aria-hidden
          disabled={!arrived}
          onPress={onNext}
          style={StyleSheet.absoluteFill}
        />
        {box && (
          <>
            <Animated.View
              pointerEvents="none"
              style={[styles.ring, { borderColor: colors.ring }, ringStyle, pulseStyle]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.ring, { borderColor: colors.ring }, ringStyle]}
            />
          </>
        )}
      </Animated.View>
      {arrived && (
        <Animated.View
          key={index}
          entering={motion.fade}
          testID="app-tour"
          role="dialog"
          aria-label={step.title}
          style={[
            styles.bubble,
            {
              left: placement.left,
              width: placement.width,
              top: placement.top,
              bottom: placement.bottom,
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              boxShadow: cardShadow(colors),
            },
          ]}
        >
          {placement.arrow !== undefined && (
            <View
              pointerEvents="none"
              style={[
                styles.arrow,
                {
                  left: placement.arrow - 7,
                  backgroundColor: colors.elevated,
                  borderColor: colors.border,
                },
                placement.top !== undefined
                  ? {
                      top: -7,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderLeftWidth: StyleSheet.hairlineWidth,
                    }
                  : {
                      bottom: -7,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderRightWidth: StyleSheet.hairlineWidth,
                    },
              ]}
            />
          )}
          <View style={{ gap: spacing.xs }}>
            <Overline>{`Tour · ${index + 1} of ${steps.length}`}</Overline>
            <AppText variant="heading" accessibilityRole="header">
              {step.title}
            </AppText>
            <AppText muted>{step.text}</AppText>
          </View>
          <View style={styles.controls}>
            {last ? <View /> : <AppButton tone="link" label="Skip tour" onPress={onSkip} />}
            <View style={styles.controls}>
              {index > 0 && (
                <IconButton
                  label="Back"
                  icon="arrow-left"
                  appearance="secondary"
                  onPress={onBack}
                />
              )}
              <AppButton
                ref={next}
                tone="primary"
                size="compact"
                label={last ? "Done" : "Next"}
                icon={last ? "check" : "arrow-right"}
                iconAfter={!last}
                onPress={onNext}
              />
            </View>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function sameBox(a: Box | null, b: Box | null) {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height)
  );
}

const styles = StyleSheet.create({
  dim: { position: "absolute", borderWidth: dimBorder },
  hole: { position: "absolute" },
  ring: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2.5 },
  bubble: {
    position: "absolute",
    gap: spacing.md,
    padding: spacing.layout + 2,
    borderRadius: radius.panel,
    borderWidth: StyleSheet.hairlineWidth,
  },
  arrow: { position: "absolute", width: 14, height: 14, transform: [{ rotate: "45deg" }] },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
});

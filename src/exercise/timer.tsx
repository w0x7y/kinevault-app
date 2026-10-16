import { useEffect, useState } from "react";
import { useIsFocused } from "expo-router";
import Animated from "react-native-reanimated";
import { useReducedMotion } from "../components/motion";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts } from "../theme/tokens";
import { elapsedSeconds, type WorkoutSession } from "./model";

/** Colors of the live workout header: ink in light mode, a deep Kine blue in dark mode. */
export function useLiveTone() {
  const { colors, appearance } = useTheme();
  return appearance === "dark"
    ? {
        background: colors.brandSoft,
        foreground: colors.foreground,
        muted: "#a9b9cb",
        pulse: "#6fc59c",
      }
    : {
        background: colors.primary,
        foreground: colors.primaryForeground,
        muted: "#c3d3e2",
        pulse: "#6fc59c",
      };
}

const breathe = {
  "0%": { opacity: 1, transform: [{ scale: 1 }] },
  "50%": { opacity: 0.35, transform: [{ scale: 0.75 }] },
  "100%": { opacity: 1, transform: [{ scale: 1 }] },
} as const;

/**
 * The small dot beside "Live": it breathes slowly while a workout is under way, so the state
 * reads as running. Still under reduced motion and while its screen is out of view.
 */
export function LiveDot({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: color,
        ...(!reduced &&
          focused && {
            animationName: breathe,
            animationDuration: 1600,
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          }),
      }}
    />
  );
}

export function ActiveWorkoutTimer({ session }: { session: WorkoutSession }) {
  const [now, setNow] = useState(Date.now);
  const tone = useLiveTone();
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    // Each tick lands just past the next whole second, so jitter never skips or repeats one.
    const tick = () => {
      const current = Date.now();
      setNow(current);
      timeout = setTimeout(tick, 1010 - ((current - (session.startedAt ?? 0)) % 1000));
    };
    tick();
    return () => clearTimeout(timeout);
  }, [session.id, session.startedAt]);
  const elapsed = elapsedSeconds(session, now);
  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");
  return (
    <AppText
      testID="active-workout-timer"
      variant="hero"
      accessibilityLabel={`Elapsed workout time ${minutes}:${seconds}`}
      style={{
        color: tone.foreground,
        fontFamily: fonts.extrabold,
        fontSize: 40,
        lineHeight: 46,
        letterSpacing: -1.2,
        textAlign: "right",
        fontVariant: ["tabular-nums"],
      }}
    >
      {minutes}:{seconds}
    </AppText>
  );
}

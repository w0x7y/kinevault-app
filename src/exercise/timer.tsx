import { useEffect, useState } from "react";
import { View } from "react-native";
import { useIsFocused } from "expo-router";
import Animated from "react-native-reanimated";
import { Icon } from "../components/icon";
import { useReducedMotion } from "../components/motion";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { elapsedSeconds, type WorkoutSession } from "./model";

/** Colors of the live workout timer: primary blue in light mode, a deep Kine blue in dark mode. */
export function useLiveTone() {
  const { colors, appearance } = useTheme();
  return appearance === "dark"
    ? { background: colors.brandSoft, foreground: colors.foreground }
    : { background: colors.primary, foreground: colors.primaryForeground };
}

const breathe = {
  "0%": { opacity: 1, transform: [{ scale: 1 }] },
  "50%": { opacity: 0.35, transform: [{ scale: 0.75 }] },
  "100%": { opacity: 1, transform: [{ scale: 1 }] },
} as const;

/**
 * The small dot beside Home's "Live" badge: it breathes slowly while a workout is under way, so the state
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

/** The Active workout's elapsed time as "m:ss", ticking on each whole second. */
export function useElapsedTime(session: WorkoutSession) {
  const [now, setNow] = useState(Date.now);
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
  return `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
}

/** The pill's look, shared by the workout page's timer and the app header's button. */
export const timerPill = {
  height: 36,
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingHorizontal: spacing.md,
  borderRadius: radius.pill,
} as const;

/** A stopwatch and the elapsed time; the icon keeps it from reading as the time of day. */
export function TimerPillContent({ time, icon = true }: { time: string; icon?: boolean }) {
  const tone = useLiveTone();
  return (
    <>
      {icon && <Icon name="stopwatch" size={15} color={tone.foreground} />}
      <AppText
        style={{
          color: tone.foreground,
          fontFamily: fonts.extrabold,
          fontSize: 16,
          lineHeight: 22,
          fontVariant: ["tabular-nums"],
        }}
      >
        {time}
      </AppText>
    </>
  );
}

/** The live workout page's elapsed time, centered in its top bar. */
export function ActiveWorkoutTimer({ session }: { session: WorkoutSession }) {
  const time = useElapsedTime(session);
  const tone = useLiveTone();
  return (
    <View
      testID="active-workout-timer"
      accessible
      accessibilityLabel={`Elapsed workout time ${time}`}
      style={[timerPill, { backgroundColor: tone.background }]}
    >
      <TimerPillContent time={time} />
    </View>
  );
}

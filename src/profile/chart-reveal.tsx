import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { cssEase, useLayoutMotion, useReducedMotion } from "../components/motion";

const wipeDuration = 500;
// The clip slides in from the left while its content slides back by the same amount, so the
// drawing stays put and appears from left to right, in the order the weeks happened.
const clipFrom = {
  from: { transform: [{ translateX: "-100%" }] },
  to: { transform: [{ translateX: "0%" }] },
} as const;
const contentFrom = {
  from: { transform: [{ translateX: "100%" }] },
  to: { transform: [{ translateX: "0%" }] },
} as const;
const wipe = (keyframes: typeof clipFrom | typeof contentFrom) => ({
  animationName: keyframes,
  animationDuration: wipeDuration,
  animationTimingFunction: cssEase,
  animationFillMode: "backwards" as const,
});
const clipWipe = wipe(clipFrom);
const contentWipe = wipe(contentFrom);

/**
 * A chart's plotted series, layered over its axes in the same box. The first time the chart
 * appears the series draws in from the left; when `dataKey` changes (another metric, range or
 * new data) the new series crossfades over the old. Reduced motion shows it at once. The layer
 * never takes touches, so the chart's own hit area keeps working.
 */
export function ChartSeriesLayer({ dataKey, children }: { dataKey: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const motion = useLayoutMotion();
  const [firstKey] = useState(dataKey);
  const [changed, setChanged] = useState(false);
  if (!changed && dataKey !== firstKey) setChanged(true);
  const drawIn = !reduced && !changed;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* The wipe wraps the crossfading layers, so a series leaving never replays it. */}
      <Animated.View style={[StyleSheet.absoluteFill, { overflow: "hidden" }, drawIn && clipWipe]}>
        <Animated.View style={[StyleSheet.absoluteFill, drawIn && contentWipe]}>
          <Animated.View
            key={dataKey}
            entering={changed ? motion.fade : undefined}
            exiting={motion.exit}
            style={StyleSheet.absoluteFill}
          >
            {children}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

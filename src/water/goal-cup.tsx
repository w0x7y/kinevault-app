import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTheme } from "../theme/provider";
import { AppText } from "../components/ui";
import { useProgressValue, useReducedMotion } from "../components/motion";

export const waterCupSize = { width: 44, height: 58 };

/** A rounded tumbler that fills with water toward the daily goal. */
export function WaterGoalCup({ progress }: { progress: number | null }) {
  const { colors } = useTheme();
  const percent = progress === null ? null : Math.round(progress * 100);
  return progress === null ? (
    <View
      testID="water-cup-unavailable"
      accessibilityLabel="Progress unavailable"
      style={[
        styles.glass,
        {
          borderColor: colors.border,
          borderStyle: "dashed",
          justifyContent: "center",
          alignItems: "center",
        },
      ]}
    >
      <AppText variant="heading" muted accessible={false}>
        —
      </AppText>
    </View>
  ) : (
    <View
      testID="water-goal-cup"
      accessibilityRole="progressbar"
      accessibilityLabel="Daily water goal"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: percent!,
        text: `${percent}% of daily water goal`,
      }}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent!}
      aria-valuetext={`${percent}% of daily water goal`}
      style={[
        styles.glass,
        // A faint wash of the water color reads as an empty glass on both themes.
        { borderColor: `${colors.water}55`, backgroundColor: `${colors.water}12` },
      ]}
    >
      <CupFill progress={progress} color={colors.water} />
      <View
        style={{
          position: "absolute",
          top: 6,
          left: 6,
          width: 3,
          height: 20,
          borderRadius: 2,
          backgroundColor: "rgba(255, 255, 255, 0.5)",
        }}
      />
    </View>
  );
}

/** The water level rises toward the day's progress when it shows and after each change. It is
 * absolute and childless, so animating its height re-lays-out nothing else. Reduced motion
 * renders the final level in the same commit. */
function CupFill({ progress, color }: { progress: number; color: string }) {
  const reduced = useReducedMotion();
  const level = useProgressValue(progress);
  const rising = useAnimatedStyle(() => ({ height: `${Math.max(0, level.get()) * 100}%` }));
  return (
    <Animated.View
      key={reduced ? "settled" : "rising"}
      testID="water-cup-fill"
      style={[
        styles.fill,
        { backgroundColor: color },
        reduced ? { height: `${progress * 100}%` } : rising,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", bottom: 0, left: 0, right: 0 },
  glass: {
    width: waterCupSize.width,
    height: waterCupSize.height,
    flexShrink: 0,
    overflow: "hidden",
    borderWidth: 1.5,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
});

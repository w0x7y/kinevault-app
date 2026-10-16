import { useEffect } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "../components/ui";
import { motionEase, useReducedMotion } from "../components/motion";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { steps } from "../profile/answers";
import { AppButton } from "../components/button";

const totalSteps = steps.length - 1;

/** Back on the left, a slim progress track in the middle, and the step count or Cancel. */
export function SetupTopBar({
  stepIndex,
  editing,
  saving,
  cancel,
  back,
}: {
  stepIndex: number;
  editing: boolean;
  saving: boolean;
  cancel: () => void;
  /** Present when the step can go back; shown as the bar's leading control. */
  back?: () => void;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(stepIndex / totalSteps);
  useEffect(() => {
    progress.set(
      withTiming(stepIndex / totalSteps, {
        duration: reduced ? 0 : 260,
        easing: motionEase,
        reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.Never,
      }),
    );
  }, [progress, stepIndex, reduced]);
  const progressStyle = useAnimatedStyle<ViewStyle>(() => ({
    width: `${progress.get() * 100}%`,
  }));
  const started = stepIndex > 0;
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {back ? (
          <AppButton
            label="Back"
            size="compact"
            icon="chevron-left"
            disabled={saving}
            onPress={back}
          />
        ) : (
          editing && (
            <AppText variant="label" style={{ paddingHorizontal: spacing.sm }}>
              Edit profile
            </AppText>
          )
        )}
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: totalSteps, now: stepIndex }}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={stepIndex}
        accessibilityLabel="Setup progress"
        style={[
          styles.track,
          { backgroundColor: colors.muted, opacity: started || editing ? 1 : 0 },
        ]}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
            },
            progressStyle,
          ]}
        />
      </View>
      <View style={[styles.side, { alignItems: "flex-end" }]}>
        {editing ? (
          <AppButton
            label="Cancel"
            size="compact"
            icon="xmark"
            disabled={saving}
            onPress={cancel}
          />
        ) : (
          started && (
            <AppText
              variant="caption"
              muted
              accessibilityLabel={`Step ${stepIndex} of ${totalSteps}`}
              style={{ fontFamily: fonts.semibold, fontVariant: ["tabular-nums"] }}
            >
              {stepIndex} of {totalSteps}
            </AppText>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  side: { minWidth: 84, flexShrink: 0, justifyContent: "center" },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
});

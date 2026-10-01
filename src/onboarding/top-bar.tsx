import { useEffect } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "../components/ui";
import {
  motionEase,
  PageTransition,
  useReducedMotion,
} from "../components/motion";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { steps } from "../profile/answers";
import { Button } from "./controls";

const totalSteps = steps.length - 1;

export function SetupTopBar({
  stepIndex,
  editing,
  saving,
  cancel,
}: {
  stepIndex: number;
  editing: boolean;
  saving: boolean;
  cancel: () => void;
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
  return (
    <>
      <PageTransition direction={0} style={styles.bar}>
        <AppText variant="label">{editing ? "Edit profile" : "Setup"}</AppText>
        {editing ? (
          <Button label="Cancel" icon="xmark" secondary disabled={saving} onPress={cancel} />
        ) : (
          stepIndex > 0 && (
            <PageTransition key={stepIndex} direction={0}>
              <AppText
                variant="caption"
                muted
                accessibilityLabel={`Step ${stepIndex} of ${totalSteps}`}
              >
                {stepIndex} of {totalSteps}
              </AppText>
            </PageTransition>
          )
        )}
      </PageTransition>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: totalSteps, now: stepIndex }}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={stepIndex}
        accessibilityLabel="Setup progress"
        style={{
          height: 3,
          backgroundColor: colors.muted,
          opacity: stepIndex === 0 ? 0 : 1,
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              height: 3,
              backgroundColor: colors.primary,
            },
            progressStyle,
          ]}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 72,
    padding: spacing.layout,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.layout,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
});

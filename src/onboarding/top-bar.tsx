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
import { Button } from "./controls";

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
  const progress = useSharedValue(stepIndex / 6);
  useEffect(() => {
    progress.set(
      withTiming(stepIndex / 6, {
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
        <AppText variant="label">KineVault Track</AppText>
        {editing ? (
          <Button label="Cancel" secondary disabled={saving} onPress={cancel} />
        ) : (
          stepIndex > 0 && (
            <PageTransition key={stepIndex} direction={0}>
              <AppText
                variant="caption"
                muted
                accessibilityLabel={`Step ${stepIndex} of 6`}
              >
                {stepIndex} of 6
              </AppText>
            </PageTransition>
          )
        )}
      </PageTransition>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 6, now: stepIndex }}
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
});

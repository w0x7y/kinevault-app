import { View } from "react-native";
import { useTheme } from "../theme/provider";
import { AppText } from "../components/ui";

export function WaterGoalCup({ progress }: { progress: number | null }) {
  const { colors } = useTheme();
  const percent = progress === null ? null : Math.round(progress * 100);
  return progress === null ? (
    <View
      testID="water-cup-unavailable"
      accessibilityLabel="Progress unavailable"
      style={{
        width: 48,
        height: 60,
        flexShrink: 0,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <AppText variant="title" muted accessible={false}>
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
      style={{ width: 48, height: 60, flexShrink: 0 }}
    >
      <View
        style={{
          position: "absolute",
          top: 14,
          right: 0,
          width: 12,
          height: 28,
          borderWidth: 2,
          borderColor: colors.primary,
          borderRadius: 7,
        }}
      />
      <View
        style={{
          width: 40,
          height: 60,
          overflow: "hidden",
          borderWidth: 2,
          borderColor: colors.primary,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
          backgroundColor: colors.card,
        }}
      >
        <View
          testID="water-cup-fill"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${progress * 100}%`,
            backgroundColor: colors.protein,
            opacity: 0.8,
          }}
        />
      </View>
    </View>
  );
}

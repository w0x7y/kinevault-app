import { View } from "react-native";
import Svg, { Circle, type CircleProps } from "react-native-svg";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import type { ReactNode } from "react";
import { useProgressValue, useReducedMotion } from "../components/motion";
import { Icon } from "../components/icon";
import { Tappable } from "../components/tappable";
import { AppText, Overline, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import type { NutritionProgress } from "./activity";

/** The day's energy card: total against goal and its detail (Home's ring and macros). */
export function CalorieWidget({
  calories,
  children,
}: {
  calories: NutritionProgress["calories"];
  children?: ReactNode;
}) {
  return (
    <Panel testID="home-calories" style={{ gap: spacing.card }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: spacing.md,
          flexWrap: "wrap",
        }}
      >
        <Overline accessibilityRole="header">Calories</Overline>
        <AppText
          variant="caption"
          muted
          selectable
          style={{ fontFamily: fonts.semibold, fontVariant: ["tabular-nums"] }}
        >
          {calories.figure}
        </AppText>
      </View>
      {children}
      {calories.target === null && <GoalsLink />}
    </Panel>
  );
}

/** A quiet pill that opens Settings while the day has no calorie goal. `onPress` runs first,
 * for a page that must close before Settings opens behind it. */
export function GoalsLink({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Tappable
      role="link"
      href="/settings"
      onPress={onPress}
      label="Set calorie and macro goals in Settings"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        paddingHorizontal: spacing.md + 4,
        borderRadius: radius.pill,
        backgroundColor: pressed ? colors.accent : colors.secondary,
      })}
    >
      <Icon name="flag" size={15} color={colors.secondaryForeground} />
      <AppText
        variant="label"
        style={{ color: colors.secondaryForeground, fontFamily: fonts.bold, fontSize: 14 }}
      >
        Set your goals
      </AppText>
    </Tappable>
  );
}

/** Remaining energy at a glance. The ring fills with each macro's share of the calories
 * eaten (energy without macro data in the foreground color) and carries the accessible
 * calorie progress. */
export function CalorieRing({
  calories,
  size,
  testID,
}: {
  calories: NutritionProgress["calories"];
  size: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const stroke = Math.max(8, Math.round(size * 0.075));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const { balance, percentage, overFraction } = calories;
  // Past the goal the ring stays full and the excess laps it in the danger color.
  const over = balance.caption === "over";
  const digits = balance.value.length;
  const figureSize = Math.min(size * 0.22, (size - stroke * 2 - 16) / (digits * 0.62));
  const center = size / 2;
  const segments = calories.segments.reduce<
    (NutritionProgress["calories"]["segments"][number] & { start: number; length: number })[]
  >((arcs, segment) => {
    const previous = arcs.at(-1);
    const start = previous ? previous.start + previous.length : 0;
    return [...arcs, { ...segment, start, length: circumference * segment.fraction }];
  }, []);
  return (
    <View testID={testID} style={{ width: size, height: size, flexShrink: 0 }}>
      <View
        testID="home-calorie-track"
        accessibilityRole="progressbar"
        accessibilityLabel={calories.label}
        accessibilityValue={{ min: 0, max: 100, now: percentage }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        style={{ width: size, height: size }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={colors.muted}
            strokeWidth={stroke}
            fill="none"
          />
          {segments.map((segment) =>
            segment.length > 0 ? (
              <RingArc
                key={segment.key}
                testID={`home-calorie-${segment.key}`}
                cx={center}
                cy={center}
                r={r}
                stroke={segment.key === "other" ? colors.foreground : colors[segment.key]}
                strokeWidth={stroke}
                length={segment.length}
                start={segment.start}
                circumference={circumference}
                fill="none"
                transform={`rotate(-90 ${center} ${center})`}
              />
            ) : null,
          )}
          {overFraction > 0 && (
            <RingArc
              cx={center}
              cy={center}
              r={r}
              stroke={colors.danger}
              strokeWidth={stroke}
              strokeLinecap="round"
              length={circumference * overFraction}
              start={0}
              circumference={circumference}
              fill="none"
              transform={`rotate(-90 ${center} ${center})`}
            />
          )}
        </Svg>
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: stroke + 4,
          pointerEvents: "none",
        }}
      >
        <AppText
          numberOfLines={1}
          style={{
            fontFamily: fonts.extrabold,
            fontSize: figureSize,
            lineHeight: figureSize * 1.15,
            letterSpacing: -0.04 * figureSize,
            fontVariant: ["tabular-nums"],
            color: over ? colors.danger : colors.foreground,
          }}
        >
          {balance.value}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
          {`kcal ${balance.caption}`}
        </AppText>
      </View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * One arc of the calorie ring, `length` long from `start` along the circle. Arcs sweep in from
 * nothing when the ring first shows and glide to their new share when food is logged, so the
 * change reads as the day filling up. Reduced motion draws the final arc straight away.
 */
function RingArc({
  length,
  start,
  circumference,
  ...circle
}: Omit<CircleProps, "strokeDasharray" | "strokeDashoffset"> & {
  length: number;
  start: number;
  circumference: number;
}) {
  const reduced = useReducedMotion();
  // Shares of the circle, so a resized ring doesn't animate.
  const share = useProgressValue(length / circumference);
  const offset = useProgressValue(start / circumference);
  const animatedProps = useAnimatedProps(
    () => ({
      // A negative dash is invalid SVG and would draw the whole circle.
      strokeDasharray: [Math.max(0, share.get()) * circumference, circumference],
      strokeDashoffset: -offset.get() * circumference,
    }),
    [circumference],
  );
  return reduced ? (
    <Circle {...circle} strokeDasharray={`${length} ${circumference}`} strokeDashoffset={-start} />
  ) : (
    <AnimatedCircle {...circle} animatedProps={animatedProps} />
  );
}

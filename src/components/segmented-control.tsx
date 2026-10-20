import { useEffect, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Icon, type IconName } from "./icon";
import { motionDuration, motionEaseInOut, useReducedMotion } from "./motion";
import { disabledOpacity, Tappable } from "./tappable";
import { AppText } from "./ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

export type SegmentOption<Value> = {
  value: Value;
  /** The visible text and the accessible name. */
  label: string;
  /** Visible text on a narrow track; the accessible name stays `label`. */
  short?: string;
  /** Shown before the text, except on a narrow track. */
  icon?: IconName;
};

/** Where a segment's raised fill sits inside the track. */
export type Frame = { x: number; y: number; width: number; height: number };

/** The visible height of a `small` segment, centered in its 44 pt hit area. */
const smallHeight = 36;
/** A track narrower than this per option shows short labels and drops icons. */
const narrowPerOption = 100;
/** The light raised fill's lift; dark mode relies on the fill alone. */
const lightShadow = "0px 1px 2px rgba(22, 24, 28, 0.08), 0px 2px 8px rgba(22, 24, 28, 0.06)";

/**
 * Two or more exclusive options on a sunken track; the chosen one lifts onto a raised fill that
 * slides to a new choice (180 ms; under reduced motion, and until the segments are measured,
 * the chosen segment draws the fill itself).
 *
 * - `semantics` is what assistive tech hears: `toggle` = a labeled group of pressed-state
 *   buttons, `radio` = a radio group, `tabs` = a tab list whose tabs are selected.
 * - `shape` rounds the track like other controls or as a pill; `size` `small` draws a 36 pt
 *   segment inside the 44 pt hit area and lets each segment take its text's width.
 * - On a narrow track (under 100 pt per option), options show their `short` text and no icon.
 * - `onChange` is called on every press, including the chosen option.
 */
export function SegmentedControl<Value extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  semantics = "toggle",
  shape = "rounded",
  size = "regular",
  testID,
}: {
  /** Names the group. */
  label: string;
  options: readonly SegmentOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  disabled?: boolean;
  semantics?: "toggle" | "radio" | "tabs";
  shape?: "rounded" | "pill";
  size?: "regular" | "small";
  testID?: string;
}) {
  const { colors, appearance } = useTheme();
  const reduced = useReducedMotion();
  const [narrow, setNarrow] = useState(false);
  const [frames, setFrames] = useState<Record<string, Frame>>({});
  const frame = frames[String(value)];
  const sliding = !reduced && frame !== undefined;
  const small = size === "small";
  const raised = {
    backgroundColor: appearance === "dark" ? colors.accent : colors.card,
    boxShadow: appearance === "dark" ? undefined : lightShadow,
    borderRadius: shape === "pill" ? radius.pill : radius.control - 4,
  };
  const measure = (key: Value, next: Frame) =>
    setFrames((current) => {
      const previous = current[String(key)];
      if (
        previous &&
        previous.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width &&
        previous.height === next.height
      )
        return current;
      return { ...current, [String(key)]: next };
    });
  return (
    <View
      testID={testID}
      role={semantics === "radio" ? "radiogroup" : semantics === "tabs" ? "tablist" : "group"}
      accessibilityLabel={label}
      onLayout={({ nativeEvent }) =>
        setNarrow(nativeEvent.layout.width < narrowPerOption * options.length)
      }
      style={{
        flexDirection: "row",
        gap: 4,
        padding: 4,
        borderRadius: shape === "pill" ? radius.pill : radius.control,
        backgroundColor: colors.muted,
      }}
    >
      {sliding && (
        <Indicator frame={frame} style={[raised, disabled && { opacity: disabledOpacity }]} />
      )}
      {options.map((option) => {
        const selected = option.value === value;
        const text = narrow ? (option.short ?? option.label) : option.label;
        const color = selected ? colors.foreground : colors.mutedForeground;
        const fill = ({ pressed }: { pressed: boolean }) => [
          {
            flexDirection: "row" as const,
            alignItems: "center" as const,
            justifyContent: "center" as const,
            gap: 6,
            paddingHorizontal: spacing.sm,
            borderRadius: raised.borderRadius,
          },
          selected && !sliding
            ? raised
            : { backgroundColor: pressed && !selected ? colors.accent : "transparent" },
        ];
        return (
          <Tappable
            key={option.value}
            role={semantics === "radio" ? "radio" : semantics === "tabs" ? "tab" : "button"}
            label={option.label}
            selected={semantics === "radio" ? undefined : selected}
            checked={semantics === "radio" ? selected : undefined}
            disabled={disabled}
            feedback="none"
            onPress={() => onChange(option.value)}
            onLayout={({ nativeEvent: { layout } }) =>
              measure(
                option.value,
                small
                  ? {
                      ...layout,
                      y: layout.y + (layout.height - smallHeight) / 2,
                      height: smallHeight,
                    }
                  : layout,
              )
            }
            style={
              small
                ? { flexGrow: 1, flexBasis: "auto", minWidth: 0 }
                : (state) => [{ flex: 1, minWidth: 0 }, fill(state)]
            }
            surface={small ? fill : undefined}
            surfaceHeight={small ? smallHeight : undefined}
          >
            {option.icon && !narrow && <Icon name={option.icon} size={16} color={color} />}
            <AppText
              variant="label"
              numberOfLines={1}
              style={[
                {
                  flexShrink: 1,
                  textAlign: "center",
                  color,
                  fontFamily: selected ? fonts.bold : fonts.semibold,
                },
                small && { fontSize: 13, lineHeight: 18 },
              ]}
            >
              {text}
            </AppText>
          </Tappable>
        );
      })}
    </View>
  );
}

/**
 * The chosen segment's raised fill. It is absolutely positioned and childless, so its frame can
 * animate without re-laying-out the labels; it renders as the track's first child. The tab bar's
 * highlight slides the same way.
 */
export function Indicator({ frame, style }: { frame: Frame; style: StyleProp<ViewStyle> }) {
  const x = useSharedValue(frame.x);
  const y = useSharedValue(frame.y);
  const width = useSharedValue(frame.width);
  const height = useSharedValue(frame.height);
  useEffect(() => {
    const timing = {
      duration: motionDuration.toggle,
      easing: motionEaseInOut,
      reduceMotion: ReduceMotion.Never,
    };
    x.set(withTiming(frame.x, timing));
    y.set(withTiming(frame.y, timing));
    width.set(withTiming(frame.width, timing));
    height.set(withTiming(frame.height, timing));
  }, [frame.x, frame.y, frame.width, frame.height, x, y, width, height]);
  const animated = useAnimatedStyle(() => ({
    width: width.get(),
    height: height.get(),
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, top: 0 }, style, animated]}
    />
  );
}

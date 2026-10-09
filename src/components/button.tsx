import { Children, useState, type Ref } from "react";
import { Pressable, View, type ViewProps } from "react-native";
import { AppText } from "./ui";
import { Icon, type IconName } from "./icon";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

export function AppButton({
  label,
  accessibilityLabel = label,
  accessibilityHint,
  onPress,
  onBlur,
  disabled = false,
  busy = false,
  selected,
  expanded,
  primary = false,
  destructive = false,
  fill = false,
  testID,
  ref,
}: {
  label: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  busy?: boolean;
  selected?: boolean;
  expanded?: boolean;
  primary?: boolean;
  destructive?: boolean;
  fill?: boolean;
  testID?: string;
  ref?: Ref<View>;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const filled = primary || destructive;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy, selected, expanded }}
      aria-pressed={selected}
      aria-expanded={expanded}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 0,
        flexGrow: fill ? 1 : undefined,
        padding: spacing.layout,
        borderWidth: 1,
        borderRadius: radius.control,
        borderColor:
          focused || selected ? colors.ring : destructive ? colors.destructive : colors.border,
        backgroundColor: destructive
          ? colors.destructive
          : primary
            ? colors.primary
            : pressed || selected
              ? colors.accent
              : colors.secondary,
        justifyContent: "center",
        opacity: disabled ? 0.5 : pressed && filled ? 0.8 : 1,
      })}
    >
      <AppText
        variant="label"
        style={{
          textAlign: "center",
          color: destructive
            ? colors.destructiveForeground
            : primary
              ? colors.primaryForeground
              : colors.secondaryForeground,
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/** Buttons use `fill` so each equal-width cell also fills the row's tallest height. */
export function ButtonRow({ children, style, ...props }: ViewProps) {
  return (
    <View {...props} style={[{ flexDirection: "row", gap: spacing.sm, minWidth: 0 }, style]}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={{ flex: 1, minWidth: 0 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function IconButton({
  label,
  icon,
  onPress,
  disabled = false,
  destructive = false,
  appearance = "plain",
  expanded,
  ref,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  appearance?: "plain" | "secondary";
  expanded?: boolean;
  ref?: Ref<View>;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, expanded }}
      aria-expanded={expanded}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderRadius: radius.control,
        borderColor: focused
          ? colors.ring
          : appearance === "secondary"
            ? colors.border
            : "transparent",
        backgroundColor:
          pressed || expanded
            ? colors.accent
            : appearance === "secondary"
              ? colors.secondary
              : "transparent",
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Icon
        name={icon}
        size={17}
        color={
          destructive
            ? colors.error
            : appearance === "secondary"
              ? colors.secondaryForeground
              : colors.primary
        }
      />
    </Pressable>
  );
}

import { useFocusRing } from "./focus-ring";
import { Children, type Ref } from "react";
import { Pressable, View, type ViewProps } from "react-native";
import { AppText } from "./ui";
import { Icon, type IconName } from "./icon";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

/**
 * One hierarchy: `primary` is filled slate, the default is tinted, `danger` is red text that
 * becomes `destructive` (filled red) only when it asks for confirmation, and `link` is a
 * text action for Back, Cancel and similar navigation.
 */
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
  danger = false,
  link = false,
  icon,
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
  danger?: boolean;
  link?: boolean;
  icon?: IconName;
  fill?: boolean;
  testID?: string;
  ref?: Ref<View>;
}) {
  const { colors } = useTheme();
  const ring = useFocusRing(onBlur);
  const focused = ring.focused;
  const filled = primary || destructive;
  const foreground = destructive
    ? colors.destructiveForeground
    : primary
      ? colors.primaryForeground
      : danger
        ? colors.danger
        : link
          ? colors.primary
          : colors.secondaryForeground;
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
      aria-busy={busy || undefined}
      disabled={disabled}
      onPress={onPress}
      onFocus={ring.onFocus}
      onBlur={ring.onBlur}
      style={({ pressed }) => ({
        minHeight: link ? 44 : 48,
        minWidth: 0,
        flexGrow: fill ? 1 : undefined,
        alignSelf: link && !fill ? "flex-start" : undefined,
        paddingVertical: link ? spacing.sm : spacing.layout - 2,
        paddingHorizontal: link ? spacing.sm : spacing.layout,
        marginHorizontal: link && !fill ? -spacing.sm : undefined,
        borderWidth: 2,
        borderRadius: radius.control,
        borderColor: focused ? colors.ring : selected ? colors.primary : "transparent",
        backgroundColor: destructive
          ? colors.destructive
          : primary
            ? colors.primary
            : pressed || selected
              ? colors.accent
              : link
                ? "transparent"
                : colors.secondary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: link && !fill ? "flex-start" : "center",
        gap: spacing.sm,
        opacity: disabled ? 0.5 : pressed && filled ? 0.8 : 1,
      })}
    >
      {icon && <Icon name={icon} size={14} color={foreground} />}
      <AppText
        variant="label"
        style={{ textAlign: link && !fill ? "left" : "center", flexShrink: 1, color: foreground }}
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
  const { focused, onFocus, onBlur } = useFocusRing();
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, expanded }}
      aria-expanded={expanded}
      disabled={disabled}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderRadius: radius.control,
        borderColor: focused ? colors.ring : "transparent",
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
          destructive && expanded
            ? colors.danger
            : destructive
              ? colors.mutedForeground
              : appearance === "secondary"
                ? colors.secondaryForeground
                : colors.primary
        }
      />
    </Pressable>
  );
}

import { Children, type Ref } from "react";
import { View, type ViewProps } from "react-native";
import { AppText } from "./ui";
import { Icon, type IconName } from "./icon";
import { Tappable } from "./tappable";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

type ButtonTone = "primary" | "secondary" | "danger" | "destructive" | "link";
type ButtonSize = "regular" | "compact" | "small";

/**
 * The one button. Tones form one hierarchy: `primary` is filled, `secondary` (the default) is a
 * quiet sunken fill, `danger` is red text on a soft red fill that becomes `destructive` (filled
 * red) only when it asks for confirmation, and `link` is a text action for Back, Cancel and
 * similar navigation. A selected or expanded secondary or danger button reads as a raised
 * outline.
 *
 * Sizes: `regular` is a 50 pt action; `compact` is a 44 pt pill for an action inside a card row
 * or beside other content; `small` is a 32 pt pill in a 44 pt hit area for a card's quiet
 * secondary action. Pills and links hug their content unless `fill` stretches them, as in a
 * ButtonRow. Links have one size.
 */
export function AppButton({
  label,
  accessibilityLabel = label,
  accessibilityHint,
  onPress,
  onBlur,
  tone = "secondary",
  size = "regular",
  icon,
  disabled = false,
  busy = false,
  selected,
  expanded,
  fill = false,
  testID,
  ref,
}: {
  label: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
  onBlur?: () => void;
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: IconName;
  disabled?: boolean;
  /** Working: announced as busy and unavailable until the work ends. */
  busy?: boolean;
  selected?: boolean;
  expanded?: boolean;
  fill?: boolean;
  testID?: string;
  ref?: Ref<View>;
}) {
  const { colors } = useTheme();
  const link = tone === "link";
  const pill = !link && size !== "regular";
  const filled = tone === "primary" || tone === "destructive";
  const raised = (selected || expanded) && (tone === "secondary" || tone === "danger");
  const hug = (link || pill) && !fill;
  const foreground =
    tone === "destructive"
      ? colors.destructiveForeground
      : tone === "primary"
        ? colors.primaryForeground
        : tone === "danger"
          ? colors.danger
          : link
            ? colors.brand
            : colors.secondaryForeground;
  const background =
    tone === "destructive"
      ? colors.destructive
      : tone === "primary"
        ? colors.primary
        : raised
          ? colors.card
          : tone === "danger"
            ? colors.dangerSoft
            : link
              ? "transparent"
              : colors.secondary;
  const geometry = link
    ? { minHeight: 44, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: spacing.sm }
    : size === "compact"
      ? { minHeight: 44, paddingVertical: spacing.sm, paddingHorizontal: spacing.md + 4, gap: 6 }
      : size === "small"
        ? { paddingHorizontal: spacing.md, gap: 6 }
        : {
            minHeight: 50,
            paddingVertical: spacing.md - 1,
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
          };
  const look = ({ pressed }: { pressed: boolean }) => ({
    ...geometry,
    borderRadius: pill ? radius.pill : radius.control,
    borderColor: raised ? colors.primary : "transparent",
    backgroundColor: pressed && tone === "secondary" && !raised ? colors.accent : background,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: hug && link ? ("flex-start" as const) : ("center" as const),
    opacity: pressed && (filled || tone === "danger") ? 0.86 : 1,
  });
  // Where the button sits. A small pill is drawn inside its 44 pt hit area, which carries this.
  const layout = {
    minWidth: 0,
    flexGrow: fill ? 1 : undefined,
    alignSelf: hug ? ("flex-start" as const) : undefined,
    marginHorizontal: hug && link ? -spacing.sm : undefined,
  };
  const small = size === "small" && !link;
  const iconMark = icon && <Icon name={icon} size={pill ? 15 : 17} color={foreground} />;
  return (
    <Tappable
      ref={ref}
      testID={testID}
      label={accessibilityLabel}
      hint={accessibilityHint}
      disabled={disabled}
      busy={busy}
      selected={selected}
      expanded={expanded}
      onPress={onPress}
      onBlur={onBlur}
      feedback={link ? "fill" : "scale"}
      style={small ? layout : (state) => [layout, look(state)]}
      surface={small ? look : undefined}
      surfaceHeight={small ? 32 : undefined}
    >
      {iconMark}
      <AppText
        variant="label"
        style={{
          textAlign: hug && link ? "left" : "center",
          flexShrink: 1,
          color: foreground,
          fontFamily: link ? fonts.semibold : fonts.bold,
          fontSize: small ? 13 : link || pill ? 14 : 15,
          lineHeight: small ? 18 : undefined,
        }}
      >
        {label}
      </AppText>
    </Tappable>
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

/** A round 48 pt icon-only action; `label` names it. */
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
  return (
    <Tappable
      ref={ref}
      label={label}
      disabled={disabled}
      expanded={expanded}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        backgroundColor:
          pressed || expanded
            ? colors.accent
            : appearance === "secondary"
              ? colors.secondary
              : "transparent",
      })}
    >
      <Icon
        name={icon}
        size={19}
        color={
          destructive && expanded
            ? colors.danger
            : appearance === "secondary" && !destructive
              ? colors.secondaryForeground
              : colors.mutedForeground
        }
      />
    </Tappable>
  );
}

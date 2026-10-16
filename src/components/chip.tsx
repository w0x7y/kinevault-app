import { Icon, type IconName } from "./icon";
import { Tappable } from "./tappable";
import { AppText } from "./ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

/**
 * A pill choice: sunken when idle, filled ink when chosen; the fill eases between the two.
 *
 * - `role` is what assistive tech hears: `button` is a toggle (`aria-pressed`), `radio` one of a
 *   radio group's options, `checkbox` one of several independent options (`aria-checked`).
 * - `detail` is quieter text after the label, e.g. ", 225 g"; the accessible name is
 *   `label` + `detail` unless `accessibilityLabel` is given.
 * - The chip hugs its text; `fill` grows it into its row's free space and `singleLine` keeps it
 *   on one line, at most 200 pt wide, for chips in a scrolling bar. `small` trims the side
 *   padding for narrow grid cells.
 */
export function Chip({
  label,
  detail,
  accessibilityLabel = `${label}${detail ?? ""}`,
  icon,
  role = "button",
  selected,
  disabled = false,
  onPress,
  fill = false,
  singleLine = false,
  size = "regular",
}: {
  label: string;
  detail?: string;
  accessibilityLabel?: string;
  icon?: IconName;
  role?: "button" | "radio" | "checkbox";
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  fill?: boolean;
  singleLine?: boolean;
  size?: "regular" | "small";
}) {
  const { colors } = useTheme();
  const foreground = selected ? colors.primaryForeground : colors.foreground;
  return (
    <Tappable
      role={role}
      label={accessibilityLabel}
      selected={role === "button" ? selected : undefined}
      checked={role === "button" ? undefined : selected}
      disabled={disabled}
      onPress={onPress}
      eases={["backgroundColor"]}
      style={({ pressed }) => ({
        flexGrow: fill ? 1 : 0,
        flexShrink: 1,
        minWidth: 0,
        maxWidth: singleLine ? 200 : undefined,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingHorizontal: size === "small" ? spacing.md - 2 : spacing.md + 2,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : pressed ? colors.accent : colors.muted,
      })}
    >
      {icon && <Icon name={icon} size={16} color={foreground} />}
      <AppText
        variant="label"
        numberOfLines={singleLine ? 1 : undefined}
        style={{
          flexShrink: 1,
          color: foreground,
          fontFamily: selected ? fonts.bold : fonts.semibold,
        }}
      >
        {label}
        {detail ? (
          <AppText
            variant="label"
            style={{
              color: selected ? colors.primaryForeground : colors.mutedForeground,
              fontFamily: fonts.medium,
              opacity: selected ? 0.75 : 1,
            }}
          >
            {detail}
          </AppText>
        ) : null}
      </AppText>
    </Tappable>
  );
}

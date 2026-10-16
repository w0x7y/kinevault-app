import type { ReactNode } from "react";
import { View } from "react-native";
import { Icon, type IconName } from "./icon";
import { useTheme } from "../theme/provider";
import { radius } from "../theme/tokens";

const sizes = {
  /** Rows in a list or card. */
  regular: { well: 38, icon: 18 },
  /** The lead of a card or a tile-sized row. */
  large: { well: 42, icon: 19 },
} as const;

/**
 * The small rounded square that holds a row's or card's leading icon. `children` replace the
 * icon for a mark that isn't one (a macro's color dot). On a muted surface the well takes the
 * card color.
 */
export function IconWell({
  icon,
  color,
  background = "muted",
  size = "regular",
  children,
}: {
  icon?: IconName;
  color?: string;
  background?: "muted" | "card";
  size?: keyof typeof sizes;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const { well, icon: iconSize } = sizes[size];
  return (
    <View
      style={{
        width: well,
        height: well,
        borderRadius: radius.tile,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors[background],
        flexShrink: 0,
      }}
    >
      {children ??
        (icon && <Icon name={icon} size={iconSize} color={color ?? colors.foreground} />)}
    </View>
  );
}

import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import type glyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/FontAwesome6Free.json";
import type { TextProps } from "react-native";

export type IconName = keyof typeof glyphMap;

export type IconProps = Omit<TextProps, "children"> & {
  name: IconName;
  size?: number;
  color?: string;
  solid?: boolean;
};

// Icons next to labels are decorative. Supply a label for a standalone icon.
export function Icon({
  name,
  size = 20,
  color,
  solid = true,
  accessibilityLabel,
  ...props
}: IconProps) {
  const decorative = !accessibilityLabel;
  return (
    <FontAwesome6
      {...props}
      name={name}
      size={size}
      color={color}
      solid={solid}
      accessible={!decorative}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no" : "auto"}
      aria-hidden={decorative}
    />
  );
}

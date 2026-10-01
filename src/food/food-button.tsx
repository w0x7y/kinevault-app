import { useState } from "react";
import { Pressable } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

export function FoodButton({ label, accessibilityLabel = label, onPress, selected, disabled, primary }: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }} aria-pressed={selected} disabled={disabled} onPress={onPress}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => ({ minHeight: 44, padding: spacing.layout, borderWidth: 1,
        borderRadius: radius.control, borderColor: focused || selected ? colors.ring : colors.border,
        backgroundColor: primary ? colors.primary : pressed || selected ? colors.accent : colors.secondary,
        justifyContent: "center", opacity: disabled ? 0.5 : pressed && primary ? 0.8 : 1 })}>
      <AppText variant="label" style={{ color: primary ? colors.primaryForeground : colors.secondaryForeground, textAlign: "center" }}>{label}</AppText>
    </Pressable>
  );
}

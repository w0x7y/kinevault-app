import { Check } from "lucide-react-native";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius } from "../theme/tokens";

export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: 20,
        paddingVertical: 14,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: radius.control,
        borderWidth: 2,
        borderColor: focused
          ? colors.ring
          : secondary
            ? colors.border
            : colors.primary,
        backgroundColor: secondary
          ? pressed
            ? colors.accent
            : colors.card
          : colors.primary,
        opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
      })}
    >
      <AppText
        variant="label"
        style={{
          color: secondary ? colors.foreground : colors.primaryForeground,
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        {...props}
        accessibilityLabel={label}
        aria-invalid={Boolean(error)}
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.ring}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: error
              ? colors.error
              : focused
                ? colors.ring
                : colors.input,
            borderWidth: focused ? 2 : 1,
          },
        ]}
      />
      {error && (
        <AppText
          variant="caption"
          accessibilityRole="alert"
          style={{ color: colors.error }}
        >
          {error}
        </AppText>
      )}
    </View>
  );
}

export function Choice({
  label,
  description,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 58,
        padding: 16,
        borderRadius: radius.control,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        borderWidth: focused ? 2 : 1,
        borderColor: focused
          ? colors.ring
          : selected
            ? colors.primary
            : colors.border,
        backgroundColor: selected || pressed ? colors.accent : colors.card,
      })}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="label">{label}</AppText>
        {description && (
          <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
            {description}
          </AppText>
        )}
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && (
          <Check
            size={14}
            color={colors.primaryForeground}
            aria-hidden={true}
          />
        )}
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  input: {
    outlineWidth: 0,
    outlineStyle: "solid",
    fontFamily: fonts.regular,
    fontSize: 18,
    minHeight: 56,
    borderRadius: radius.control,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});

export function ErrorText({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <AppText
      variant="caption"
      accessibilityRole="alert"
      style={{ color: colors.error }}
    >
      {message}
    </AppText>
  );
}

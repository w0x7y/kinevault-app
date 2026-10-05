import { Icon, type IconName } from "../components/icon";
import { useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 52,
        padding: spacing.layout,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
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
      {icon && (
        <Icon
          name={icon}
          size={16}
          color={secondary ? colors.foreground : colors.primaryForeground}
        />
      )}
      <AppText
        variant="label"
        style={{
          color: secondary ? colors.foreground : colors.primaryForeground,
          flexShrink: 1,
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
  inputMode,
  onChangeText,
  trailing,
  ...props
}: TextInputProps & { label: string; error?: string; trailing?: ReactNode }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.error
    : focused
      ? colors.ring
      : colors.input;
  const input = (
    <TextInput
      {...props}
      inputMode={inputMode}
      onChangeText={(text) => {
        // Keyboard hints do not restrict hardware typing or pasted text.
        if (inputMode === "numeric" && !/^\d*$/.test(text)) return;
        if (inputMode === "decimal" && !/^\d*(?:[.,]\d*)?$/.test(text)) return;
        onChangeText?.(text);
      }}
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
          borderColor,
          borderWidth: focused ? 2 : 1,
        },
        trailing
          ? { flex: 1, minWidth: 0, borderWidth: 0, backgroundColor: "transparent" }
          : undefined,
      ]}
    />
  );
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{label}</AppText>
      {trailing ? (
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: radius.control,
          borderColor,
          borderWidth: focused ? 2 : 1,
          backgroundColor: colors.card,
          paddingRight: spacing.sm,
        }}>
          {input}
          {trailing}
        </View>
      ) : input}
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
        padding: spacing.layout,
        borderRadius: radius.control,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.layout,
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
          <Icon
            name="check"
            size={14}
            color={colors.primaryForeground}
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
    padding: spacing.layout,
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

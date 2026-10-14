import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

export function ExerciseField({
  label,
  value,
  onChange,
  numeric,
  disabled = false,
  multiline = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  /** Focus on mount, or as soon as the field becomes editable if it starts disabled. */
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const focusPending = useRef(autoFocus);
  // Phones refuse to focus a field that isn't editable, so the platform's own
  // autoFocus would be lost while the field is disabled at mount.
  useEffect(() => {
    if (!focusPending.current || disabled) return;
    focusPending.current = false;
    input.current?.focus();
  }, [disabled]);
  return (
    <View style={{ gap: spacing.xs, minWidth: 0 }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        inputMode={numeric ? "decimal" : "text"}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        maxLength={numeric ? 32 : multiline ? 4000 : 400}
        selectTextOnFocus={numeric}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={colors.ring}
        style={{
          minHeight: multiline ? 96 : 48,
          minWidth: 0,
          padding: spacing.layout,
          borderWidth: 1,
          borderRadius: radius.control,
          borderColor: focused ? colors.ring : colors.border,
          backgroundColor: colors.background,
          color: colors.foreground,
          fontFamily: fonts.regular,
          fontSize: 16,
        }}
      />
    </View>
  );
}

export function ExerciseError({ message }: { message: string | null }) {
  const { colors } = useTheme();
  return message ? (
    <AppText accessibilityRole="alert" style={{ color: colors.error }}>
      {message}
    </AppText>
  ) : null;
}
